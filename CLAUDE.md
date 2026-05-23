# Project-Specific Guide: Homepage Generator
> Inherits: ../../CLAUDE.md (S.G.G Framework)
> Scope: ./website_sute/
> Stack: Next.js 15 · TypeScript · Supabase (pgvector) · Claude API · OpenAI · Browserless.io

---

## 1. 프로젝트 개요

**목적:** 작업자의 기존 홈페이지를 AI가 학습해 디자인 스타일 템플릿을 생성하고,
사용자가 프롬프트를 입력하면 해당 스타일로 페이지 시안(PNG) + HTML을 자동 생성하는 웹앱.

**3개 서브시스템:**
- `Style Engine` — 기존 사이트 크롤 → Claude 분석 → Supabase pgvector 저장
- `Generation Engine` — Claude HTML 생성 → Browserless PNG 변환
- `App UI` — 관리자(/admin) + 사용자 Wizard(/projects/new)

---

## 2. 핵심 파일 맵

```
src/
├── lib/
│   ├── types.ts                    — StyleProfile, MenuItem, GenerationContext (공통 타입)
│   ├── claude.ts                   — claudeGenerate(), claudeAnalyzeImage()
│   ├── openai.ts                   — createEmbedding(), generateImage()
│   ├── supabase/client.ts          — createClient(), createServerSupabaseClient(), createServiceClient()
│   ├── style-engine/
│   │   ├── crawler.ts              — crawlUrl(url), crawlHtml(html) → CrawlResult
│   │   ├── analyzer.ts             — analyzeStyle(html, css) → StyleProfile
│   │   └── vector-store.ts         — saveTemplate(), searchSimilarTemplates()
│   └── generation-engine/
│       ├── html-generator.ts       — generatePageHtml(ctx, retryFeedback?) → string
│       └── screenshot.ts           — htmlToScreenshot(html, filename) → string (URL)
├── app/api/
│   ├── templates/analyze/route.ts  — POST: {url|html, name} → {templateId, thumbnailUrl}
│   ├── templates/route.ts          — GET: 템플릿 목록
│   ├── generate/html/route.ts      — POST: {projectId, pageId, retryFeedback?} → {html}
│   ├── generate/screenshot/route.ts— POST: {pageId} → {screenshotUrl}
│   ├── projects/route.ts           — GET/POST 프로젝트
│   ├── projects/[id]/pages/route.ts— GET/POST 페이지
│   └── projects/[id]/download/route.ts — GET: ZIP 다운로드
└── components/
    ├── admin/TemplateUploader.tsx  — URL 입력 → 분석 진행 → 완료
    ├── admin/TemplateCard.tsx      — 썸네일 + 키워드 배지
    └── user/
        ├── WizardLayout.tsx        — Step 진행 표시
        ├── TemplateSelector.tsx    — 썸네일 그리드 선택
        ├── MenuBuilder.tsx         — 페이지 목록 추가/삭제/순서
        ├── PromptInput.tsx         — 프롬프트 + 힌트
        └── PagePreview.tsx         — PNG 시안 + 승인/재생성
```

---

## 3. Supabase 스키마

```sql
templates  (id, name, thumbnail_url, colors, fonts, layout, css_snippets, keywords, embedding vector(1536))
projects   (id, user_id, name, industry, template_id, menu_structure jsonb, status)
pages      (id, project_id, page_name, page_order, prompt, html_content, screenshot_url, status)
```

**RPC:** `match_templates(query_embedding, match_count)` — 벡터 유사도 검색

---

## 4. 환경변수

```bash
NEXT_PUBLIC_SUPABASE_URL        # Supabase 프로젝트 URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon key
SUPABASE_SERVICE_ROLE_KEY       # Supabase service role key (서버 전용)
ANTHROPIC_API_KEY               # Claude API (HTML 생성 + 스타일 분석)
OPENAI_API_KEY                  # 임베딩(text-embedding-3-small) + 이미지(gpt-image-1)
BROWSERLESS_API_KEY             # HTML → PNG 스크린샷
BROWSERLESS_URL                 # https://chrome.browserless.io
```

---

## 5. 주요 명령어

```bash
npm run dev          # 개발 서버 (localhost:3000)
npm run build        # 프로덕션 빌드
npm run test         # vitest 테스트 실행
npx tsc --noEmit     # 타입 체크
```

---

## 6. 개발 패턴 & 규칙

### API 라우트 패턴
```typescript
// 항상 try/catch + 의미있는 에러 메시지
export async function POST(req: NextRequest) {
  try {
    const { field } = await req.json()
    if (!field) return NextResponse.json({ error: 'field is required' }, { status: 400 })
    // ...
    return NextResponse.json({ result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[route-name]', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

### Supabase 클라이언트 선택 기준
- **서버 컴포넌트**: `createServerSupabaseClient()` (쿠키 기반, Auth 포함)
- **API 라우트 (관리자 작업)**: `createServiceClient()` (RLS 우회, service role)
- **클라이언트 컴포넌트**: `createClient()` (브라우저)

### Claude API 사용
```typescript
// claude.ts의 claudeGenerate() 항상 사용, 직접 호출 금지
const result = await claudeGenerate(systemPrompt, userPrompt, maxTokens)
```

### StyleProfile 타입 — 변경 시 전체 영향 범위 확인
`src/lib/types.ts` → `analyzer.ts` → `vector-store.ts` → `html-generator.ts` → DB

---

## 7. 페이지 생성 플로우 (디버깅 기준점)

```
POST /api/projects/{id}/pages    → pages 테이블에 status='pending' 레코드 생성
POST /api/generate/html          → Claude HTML 생성 → status='generated'
POST /api/generate/screenshot    → Browserless PNG → screenshot_url 저장
PATCH /api/projects/{id}/pages   → status='approved'
GET  /api/projects/{id}/download → JSZip으로 approved 페이지만 묶어서 반환
```

---

## 8. 알려진 제약사항

- **Browserless 무료 플랜:** 월 6,000 유닛. 스크린샷 1회 ≈ 1~2 유닛.
- **Claude 컨텍스트 제한:** HTML/CSS 분석 시 각각 8,000/4,000자로 truncate.
- **Vercel 서버리스 타임아웃:** 기본 10초. HTML 생성은 최대 30초 소요 가능
  → `next.config.ts`에 `maxDuration: 60` 설정 필요 시 추가.
- **pgvector ivfflat:** 템플릿 100개 이하에서는 정확도 낮을 수 있음. 데이터 쌓이면 인덱스 재생성.

---

## 9. 자주 쓰는 디버그 쿼리 (Supabase SQL Editor)

```sql
-- 전체 템플릿 확인
SELECT id, name, keywords, created_at FROM templates ORDER BY created_at DESC;

-- 특정 프로젝트 페이지 상태 확인
SELECT page_name, status, screenshot_url FROM pages WHERE project_id = 'UUID';

-- 임베딩 저장 확인
SELECT id, name, (embedding IS NOT NULL) as has_embedding FROM templates;
```

---

## 10. Agent Skills (이 프로젝트 전용)

| 스킬 | 경로 | 용도 |
|------|------|------|
| `add-template` | `.claude/skills/add-template.md` | 새 스타일 템플릿 학습 워크플로우 |
| `debug-generation` | `.claude/skills/debug-generation.md` | 페이지 생성 실패 디버깅 |
| `verify-deployment` | `.claude/skills/verify-deployment.md` | Vercel 배포 후 검증 체크리스트 |

---

*Homepage Generator v0.1.0 — S.G.G Framework 상속*
