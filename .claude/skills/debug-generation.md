---
name: debug-generation
description: "페이지 생성 실패 또는 품질 문제를 단계별로 진단하고 수정한다. HTML 생성 실패, 스크린샷 오류, 스타일 불일치 등 모든 생성 관련 이슈에 사용."
---

# Debug Generation — 페이지 생성 디버깅

## 진단 트리

```
페이지 생성 실패
  ├── HTML이 생성되지 않음
  │     ├── Claude API 오류? → API 키 확인, 응답 로그 확인
  │     ├── 프로젝트/페이지 레코드 없음? → DB 확인
  │     └── 템플릿 없음? → template_id 확인
  ├── HTML은 있는데 스크린샷 없음
  │     ├── Browserless API 오류? → API 키 + URL 확인
  │     └── Supabase Storage 업로드 실패? → 버킷 퍼미션 확인
  └── 생성됐는데 품질 문제
        ├── 스타일이 템플릿과 다름 → css_snippets 확인
        └── 한국어 콘텐츠 없음 → 시스템 프롬프트 확인
```

## Step 1: DB 상태 확인

```sql
-- 특정 프로젝트의 모든 페이지 상태 확인
SELECT id, page_name, status, screenshot_url, created_at
FROM pages
WHERE project_id = 'YOUR_PROJECT_ID'
ORDER BY page_order;

-- status별 의미:
-- 'pending'    → 생성 요청 전
-- 'generating' → Claude/Browserless 처리 중 (stuck이면 오류)
-- 'generated'  → HTML 생성 완료, 스크린샷 대기 중
-- 'approved'   → 사용자 승인 완료
```

## Step 2: HTML 생성 직접 테스트

```bash
# 페이지 ID로 직접 HTML 재생성 요청
curl -X POST http://localhost:3000/api/generate/html \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "PROJECT_UUID",
    "pageId": "PAGE_UUID"
  }'
```

에러 응답 예시:
```json
{ "error": "Project or page not found" }     // DB 레코드 없음
{ "error": "Generated content is not valid HTML" } // Claude 응답 파싱 실패
```

## Step 3: 스크린샷 직접 테스트

```bash
curl -X POST http://localhost:3000/api/generate/screenshot \
  -H "Content-Type: application/json" \
  -d '{ "pageId": "PAGE_UUID" }'
```

에러 응답:
```json
{ "error": "Page not found or HTML not generated yet" } // HTML 먼저 생성 필요
{ "error": "Browserless screenshot failed: 401" }       // API 키 오류
```

## Step 4: stuck 페이지 복구

```sql
-- 'generating' 상태로 멈춘 페이지를 'pending'으로 리셋
UPDATE pages
SET status = 'pending', html_content = NULL
WHERE status = 'generating'
  AND created_at < NOW() - INTERVAL '5 minutes';
```

## Step 5: 스타일 품질 문제

생성된 HTML이 템플릿 스타일을 따르지 않는 경우:

```sql
-- 템플릿의 css_snippets 확인
SELECT name, css_snippets FROM templates WHERE id = 'TEMPLATE_UUID';
```

css_snippets가 비어있거나 너무 짧으면 템플릿을 재분석해야 함:
```bash
curl -X POST http://localhost:3000/api/templates/analyze \
  -d '{"url": "원본URL", "name": "템플릿명"}'
```

## Step 6: Claude 프롬프트 직접 테스트

`src/lib/generation-engine/html-generator.ts`의 `buildSystemPrompt()`를 확인.

개선이 필요하면:
1. `ANALYSIS_SYSTEM_PROMPT` (analyzer.ts) — 스타일 추출 지침 수정
2. `buildSystemPrompt()` (html-generator.ts) — HTML 생성 지침 수정
3. `buildUserPrompt()` — 사용자 입력 포맷 수정

## 공통 에러 코드

| 에러 | 원인 | 해결 |
|------|------|------|
| `CrawlError: Invalid URL` | URL 형식 오류 | `https://` 포함 여부 확인 |
| `AnalysisError: Failed to parse` | Claude가 JSON 아닌 텍스트 반환 | 프롬프트 끝에 "Return ONLY JSON" 강화 |
| `ScreenshotError: 401` | Browserless 키 오류 | `.env.local` BROWSERLESS_API_KEY 확인 |
| `Vector search failed` | pgvector RPC 미설치 | `002_match_templates.sql` 재실행 |
| `Storage upload failed` | 버킷 없음 또는 퍼미션 오류 | Supabase Storage에서 `screenshots` 버킷 확인 |
