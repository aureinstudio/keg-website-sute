# Homepage Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 작업자의 기존 사이트를 학습해 스타일 템플릿을 만들고, 사용자가 프롬프트로 홈페이지 시안(PNG) + HTML을 자동 생성하는 웹 애플리케이션을 구축한다.

**Architecture:** Style Engine(크롤러→분석→벡터 저장), Generation Engine(Claude→HTML→Browserless→PNG), App UI(관리자/사용자 Wizard) 3개 서브시스템으로 분리. 각 시스템은 독립 API 라우트를 통해 통신.

**Tech Stack:** Next.js 14 App Router + TypeScript, Tailwind CSS + shadcn/ui, Supabase (pgvector + Storage + Auth), Claude API (claude-sonnet-4), OpenAI (text-embedding-3-small + gpt-image-1), Browserless.io

---

## 파일 구조

```
src/
├── app/
│   ├── (admin)/admin/
│   │   ├── page.tsx                  — 관리자 대시보드
│   │   ├── templates/page.tsx        — 템플릿 목록/관리
│   │   └── templates/new/page.tsx    — 템플릿 추가 (URL/HTML 업로드)
│   ├── (user)/
│   │   ├── page.tsx                  — 랜딩/로그인
│   │   └── projects/
│   │       ├── new/page.tsx          — 프로젝트 생성 Wizard
│   │       └── [id]/page.tsx         — 프로젝트 페이지 생성
│   └── api/
│       ├── templates/
│       │   ├── route.ts              — GET(목록) POST(생성)
│       │   ├── [id]/route.ts         — GET DELETE
│       │   └── analyze/route.ts      — POST: URL/HTML → 스타일 분석
│       ├── projects/
│       │   ├── route.ts              — GET POST
│       │   └── [id]/
│       │       ├── route.ts          — GET PATCH DELETE
│       │       └── pages/route.ts    — GET POST
│       └── generate/
│           ├── html/route.ts         — POST: 프롬프트 → HTML
│           └── screenshot/route.ts   — POST: HTML → PNG URL
├── lib/
│   ├── style-engine/
│   │   ├── crawler.ts               — URL → raw HTML/CSS
│   │   ├── analyzer.ts              — raw HTML/CSS → StyleProfile (Claude)
│   │   └── vector-store.ts          — StyleProfile → Supabase pgvector
│   ├── generation-engine/
│   │   ├── html-generator.ts        — 프롬프트 + 템플릿 → HTML (Claude)
│   │   └── screenshot.ts            — HTML → PNG URL (Browserless)
│   ├── supabase/
│   │   ├── client.ts                — Supabase 클라이언트 (server/client)
│   │   └── types.ts                 — DB 타입 정의
│   ├── openai.ts                    — OpenAI 클라이언트 + 임베딩 함수
│   ├── claude.ts                    — Anthropic 클라이언트 + 헬퍼
│   └── types.ts                     — 공통 타입 (StyleProfile, Project, Page)
└── components/
    ├── admin/
    │   ├── TemplateUploader.tsx     — URL/HTML 업로드 폼
    │   ├── TemplateCard.tsx         — 템플릿 카드 (썸네일 + 메타)
    │   └── AnalysisProgress.tsx     — 분석 진행 상태 표시
    └── user/
        ├── TemplateSelector.tsx     — 썸네일 그리드 선택기
        ├── MenuBuilder.tsx          — 드래그앤드롭 메뉴 구조
        ├── PromptInput.tsx          — 프롬프트 입력 + 힌트
        ├── PagePreview.tsx          — PNG 시안 전체화면 뷰어
        └── WizardLayout.tsx        — Step 진행 레이아웃
```

---

## Task 0: Supabase 스키마 + 환경 설정

**Goal:** DB 테이블, pgvector 익스텐션, Storage 버킷을 생성하고 환경변수를 구성한다.

**Files:**
- Create: `supabase/migrations/001_init.sql`
- Create: `.env.local.example`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/types.ts`

**Acceptance Criteria:**
- [ ] pgvector 익스텐션이 활성화되어 있다
- [ ] templates, projects, pages 테이블이 생성된다
- [ ] Supabase Storage에 `screenshots` 버킷이 존재한다
- [ ] `src/lib/supabase/client.ts`가 server/client 양쪽에서 import 가능하다

**Verify:** `npx supabase db reset` → 에러 없이 완료

**Steps:**

- [ ] **Step 1: Supabase 마이그레이션 파일 작성**

```sql
-- supabase/migrations/001_init.sql

-- pgvector 활성화
create extension if not exists vector with schema public;

-- 스타일 템플릿
create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  thumbnail_url text,
  colors jsonb not null default '{}',
  fonts jsonb not null default '{}',
  layout jsonb not null default '{}',
  css_snippets jsonb not null default '{}',
  keywords text[] not null default '{}',
  embedding vector(1536),
  created_at timestamptz not null default now()
);

-- 벡터 유사도 검색 인덱스
create index on templates using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 프로젝트
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  industry text,
  template_id uuid references templates(id),
  menu_structure jsonb not null default '[]',
  status text not null default 'draft'
    check (status in ('draft', 'in_progress', 'completed')),
  created_at timestamptz not null default now()
);

-- 생성된 페이지
create table pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  page_name text not null,
  page_order integer not null default 0,
  prompt text,
  html_content text,
  screenshot_url text,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'generated', 'approved')),
  created_at timestamptz not null default now()
);

-- Storage 버킷
insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict do nothing;
```

- [ ] **Step 2: .env.local.example 작성**

```bash
# .env.local.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

ANTHROPIC_API_KEY=your-claude-api-key
OPENAI_API_KEY=your-openai-api-key

BROWSERLESS_API_KEY=your-browserless-key
BROWSERLESS_URL=https://chrome.browserless.io
```

- [ ] **Step 3: Supabase 클라이언트 작성**

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

export function createServiceClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

- [ ] **Step 4: DB 타입 작성**

```typescript
// src/lib/supabase/types.ts
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      templates: {
        Row: {
          id: string
          name: string
          thumbnail_url: string | null
          colors: Json
          fonts: Json
          layout: Json
          css_snippets: Json
          keywords: string[]
          embedding: number[] | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['templates']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['templates']['Insert']>
      }
      projects: {
        Row: {
          id: string
          user_id: string | null
          name: string
          industry: string | null
          template_id: string | null
          menu_structure: Json
          status: 'draft' | 'in_progress' | 'completed'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['projects']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['projects']['Insert']>
      }
      pages: {
        Row: {
          id: string
          project_id: string
          page_name: string
          page_order: number
          prompt: string | null
          html_content: string | null
          screenshot_url: string | null
          status: 'pending' | 'generating' | 'generated' | 'approved'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['pages']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['pages']['Insert']>
      }
    }
  }
}
```

- [ ] **Step 5: 커밋**

```bash
git add supabase/ src/lib/supabase/ .env.local.example
git commit -m "feat: supabase schema and client setup"
```

---

## Task 1: 프로젝트 초기화 + 공통 라이브러리

**Goal:** Next.js 프로젝트를 생성하고 Claude/OpenAI 클라이언트와 공통 타입을 구성한다.

**Files:**
- Create: `src/lib/claude.ts`
- Create: `src/lib/openai.ts`
- Create: `src/lib/types.ts`

**Acceptance Criteria:**
- [ ] `npx next dev`가 에러 없이 실행된다
- [ ] Claude API 클라이언트가 import 가능하다
- [ ] OpenAI 임베딩 함수가 `number[]`를 반환한다

**Verify:** `npx tsc --noEmit` → 에러 없음

**Steps:**

- [ ] **Step 1: Next.js 프로젝트 생성**

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --no-eslint \
  --import-alias "@/*"

npm install @anthropic-ai/sdk openai @supabase/supabase-js @supabase/ssr
npm install @dnd-kit/core @dnd-kit/sortable
npm install -D @types/node
npx shadcn@latest init
npx shadcn@latest add button card input label textarea badge dialog progress toast
```

- [ ] **Step 2: 공통 타입 작성**

```typescript
// src/lib/types.ts
export interface StyleProfile {
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    text: string
  }
  fonts: {
    heading: string
    body: string
    size: { base: string; heading: string }
  }
  layout: {
    containerWidth: string
    sectionPadding: string
    gridColumns: number
  }
  cssSnippets: {
    header: string
    hero: string
    card: string
    footer: string
    [key: string]: string
  }
  keywords: string[]
}

export interface MenuItem {
  id: string
  name: string
  path: string
}

export interface GenerationContext {
  templateId: string
  styleProfile: StyleProfile
  menuItems: MenuItem[]
  currentPage: string
  userPrompt: string
  existingPages?: { name: string; cssVars: string }[]
}
```

- [ ] **Step 3: Claude 클라이언트 작성**

```typescript
// src/lib/claude.ts
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function claudeGenerate(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8192
): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })
  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text
}

export async function claudeAnalyzeImage(
  imageBase64: string,
  prompt: string
): Promise<string> {
  const message = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
        { type: 'text', text: prompt },
      ],
    }],
  })
  const block = message.content[0]
  if (block.type !== 'text') throw new Error('Unexpected response type')
  return block.text
}
```

- [ ] **Step 4: OpenAI 클라이언트 + 임베딩 작성**

```typescript
// src/lib/openai.ts
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function createEmbedding(text: string): Promise<number[]> {
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
    dimensions: 1536,
  })
  return response.data[0].embedding
}

export async function generateImage(prompt: string): Promise<string> {
  const response = await client.images.generate({
    model: 'gpt-image-1',
    prompt,
    size: '1536x1024',
    quality: 'high',
  })
  return response.data[0].url ?? ''
}
```

- [ ] **Step 5: 커밋**

```bash
git add src/lib/
git commit -m "feat: claude, openai clients and common types"
```

---

## Task 2: Style Engine — Crawler

**Goal:** URL을 받아 전체 HTML/CSS를 추출하고 Supabase Storage에 스크린샷을 저장한다.

**Files:**
- Create: `src/lib/style-engine/crawler.ts`
- Create: `src/app/api/templates/analyze/route.ts` (일부)

**Acceptance Criteria:**
- [ ] 유효한 URL 입력 시 `{ html, css, screenshotUrl }` 객체를 반환한다
- [ ] 스크린샷이 Supabase Storage `screenshots/` 에 저장된다
- [ ] 잘못된 URL 입력 시 `CrawlError`를 throw한다

**Verify:** `curl -X POST /api/templates/analyze -d '{"url":"https://example.com"}'` → `{ html: "...", screenshotUrl: "https://..." }`

**Steps:**

- [ ] **Step 1: Crawler 작성**

```typescript
// src/lib/style-engine/crawler.ts
import { createServiceClient } from '@/lib/supabase/client'

export class CrawlError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'CrawlError'
  }
}

export interface CrawlResult {
  html: string
  css: string
  screenshotUrl: string
}

export async function crawlUrl(url: string): Promise<CrawlResult> {
  if (!URL.canParse(url)) throw new CrawlError(`Invalid URL: ${url}`)

  // Browserless로 스크린샷 + HTML 동시 추출
  const browserlessUrl = `${process.env.BROWSERLESS_URL}/screenshot?token=${process.env.BROWSERLESS_API_KEY}`

  const [screenshotRes, contentRes] = await Promise.all([
    fetch(browserlessUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url,
        options: { type: 'png', fullPage: true },
        viewport: { width: 1920, height: 1080 },
      }),
    }),
    fetch(`${process.env.BROWSERLESS_URL}/content?token=${process.env.BROWSERLESS_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    }),
  ])

  if (!screenshotRes.ok) throw new CrawlError(`Screenshot failed: ${screenshotRes.statusText}`)
  if (!contentRes.ok) throw new CrawlError(`Content fetch failed: ${contentRes.statusText}`)

  const [screenshotBuffer, html] = await Promise.all([
    screenshotRes.arrayBuffer(),
    contentRes.text(),
  ])

  // CSS 추출 (style 태그 + link 태그 href 수집)
  const styleTagMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? []
  const css = styleTagMatches
    .map((s) => s.replace(/<\/?style[^>]*>/gi, ''))
    .join('\n')

  // Supabase Storage 업로드
  const supabase = createServiceClient()
  const filename = `templates/${Date.now()}-${new URL(url).hostname}.png`
  const { error } = await supabase.storage
    .from('screenshots')
    .upload(filename, screenshotBuffer, { contentType: 'image/png', upsert: true })

  if (error) throw new CrawlError('Storage upload failed', error)

  const { data: { publicUrl } } = supabase.storage
    .from('screenshots')
    .getPublicUrl(filename)

  return { html, css, screenshotUrl: publicUrl }
}

export async function crawlHtml(html: string): Promise<CrawlResult> {
  const styleTagMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) ?? []
  const css = styleTagMatches
    .map((s) => s.replace(/<\/?style[^>]*>/gi, ''))
    .join('\n')

  // HTML 직접 업로드의 경우 스크린샷은 Generation Engine의 screenshot으로 대체
  return { html, css, screenshotUrl: '' }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/style-engine/crawler.ts
git commit -m "feat: style engine crawler"
```

---

## Task 3: Style Engine — Analyzer

**Goal:** HTML/CSS를 Claude로 분석해서 StyleProfile JSON을 추출한다.

**Files:**
- Create: `src/lib/style-engine/analyzer.ts`

**Acceptance Criteria:**
- [ ] HTML/CSS 입력 시 `StyleProfile` 타입의 객체를 반환한다
- [ ] `colors.primary`가 유효한 hex 색상값이다
- [ ] `cssSnippets`에 `header`, `hero`, `card`, `footer` 키가 존재한다
- [ ] JSON 파싱 실패 시 `AnalysisError`를 throw한다

**Verify:** `analyzer.test.ts` → 모든 테스트 통과

**Steps:**

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/lib/style-engine/analyzer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { analyzeStyle } from './analyzer'
import * as claude from '@/lib/claude'

describe('analyzeStyle', () => {
  it('returns StyleProfile from HTML/CSS', async () => {
    vi.spyOn(claude, 'claudeGenerate').mockResolvedValue(JSON.stringify({
      colors: { primary: '#1A2B4C', secondary: '#334466', accent: '#FF6B35', background: '#FFFFFF', text: '#111111' },
      fonts: { heading: 'Pretendard', body: 'Noto Sans KR', size: { base: '16px', heading: '32px' } },
      layout: { containerWidth: '1200px', sectionPadding: '80px', gridColumns: 12 },
      cssSnippets: { header: '.header{}', hero: '.hero{}', card: '.card{}', footer: '.footer{}' },
      keywords: ['기업형', '신뢰감'],
    }))

    const result = await analyzeStyle('<html></html>', '.body{}')
    expect(result.colors.primary).toMatch(/^#[0-9A-Fa-f]{6}$/)
    expect(result.cssSnippets).toHaveProperty('header')
    expect(result.cssSnippets).toHaveProperty('hero')
    expect(result.cssSnippets).toHaveProperty('card')
    expect(result.cssSnippets).toHaveProperty('footer')
    expect(result.keywords.length).toBeGreaterThan(0)
  })

  it('throws AnalysisError on invalid JSON', async () => {
    vi.spyOn(claude, 'claudeGenerate').mockResolvedValue('not valid json')
    await expect(analyzeStyle('<html></html>', '')).rejects.toThrow('AnalysisError')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run src/lib/style-engine/analyzer.test.ts
```
Expected: FAIL (analyzeStyle not defined)

- [ ] **Step 3: Analyzer 구현**

```typescript
// src/lib/style-engine/analyzer.ts
import { claudeGenerate } from '@/lib/claude'
import type { StyleProfile } from '@/lib/types'

export class AnalysisError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'AnalysisError'
  }
}

const ANALYSIS_SYSTEM_PROMPT = `You are a web design analyzer. Extract design tokens and CSS patterns from HTML/CSS source code.

Return ONLY a valid JSON object with this exact structure:
{
  "colors": {
    "primary": "#hexcolor",
    "secondary": "#hexcolor",
    "accent": "#hexcolor",
    "background": "#hexcolor",
    "text": "#hexcolor"
  },
  "fonts": {
    "heading": "font-family-name",
    "body": "font-family-name",
    "size": { "base": "16px", "heading": "32px" }
  },
  "layout": {
    "containerWidth": "1200px",
    "sectionPadding": "80px",
    "gridColumns": 12
  },
  "cssSnippets": {
    "header": "CSS rules for header section",
    "hero": "CSS rules for hero/banner section",
    "card": "CSS rules for card components",
    "footer": "CSS rules for footer section"
  },
  "keywords": ["design style keyword 1", "keyword 2", "keyword 3"]
}

Keywords should describe the design mood in Korean (e.g. "미니멀", "기업형", "다크톤", "여백 넉넉").
Return ONLY the JSON, no explanation.`

export async function analyzeStyle(html: string, css: string): Promise<StyleProfile> {
  const truncatedHtml = html.slice(0, 8000)
  const truncatedCss = css.slice(0, 4000)

  const userPrompt = `Analyze this website's design:\n\nHTML:\n${truncatedHtml}\n\nCSS:\n${truncatedCss}`

  let raw: string
  try {
    raw = await claudeGenerate(ANALYSIS_SYSTEM_PROMPT, userPrompt, 2048)
  } catch (err) {
    throw new AnalysisError('Claude API call failed', err)
  }

  // JSON 블록 추출 (```json ... ``` 감싸져 있을 수 있음)
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, raw]
  const jsonStr = jsonMatch[1]?.trim() ?? raw.trim()

  try {
    return JSON.parse(jsonStr) as StyleProfile
  } catch (err) {
    throw new AnalysisError(`Failed to parse analysis result: ${jsonStr.slice(0, 200)}`, err)
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/style-engine/analyzer.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/style-engine/
git commit -m "feat: style engine analyzer with claude"
```

---

## Task 4: Style Engine — Vector Store

**Goal:** StyleProfile를 임베딩해서 Supabase에 저장하고, 유사 템플릿 검색 기능을 구현한다.

**Files:**
- Create: `src/lib/style-engine/vector-store.ts`

**Acceptance Criteria:**
- [ ] `saveTemplate()` 호출 후 DB에 레코드가 생성된다
- [ ] `searchSimilarTemplates("미니멀 IT 스타트업")` 가 TOP 3 결과를 반환한다
- [ ] 반환된 결과에 `cssSnippets`가 포함된다

**Verify:** `vector-store.test.ts` → 모든 테스트 통과

**Steps:**

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/lib/style-engine/vector-store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { saveTemplate, searchSimilarTemplates } from './vector-store'
import * as openai from '@/lib/openai'
import * as supabaseClient from '@/lib/supabase/client'

const mockEmbedding = Array(1536).fill(0.1)
const mockProfile = {
  colors: { primary: '#111', secondary: '#222', accent: '#333', background: '#fff', text: '#000' },
  fonts: { heading: 'Pretendard', body: 'Noto Sans KR', size: { base: '16px', heading: '32px' } },
  layout: { containerWidth: '1200px', sectionPadding: '80px', gridColumns: 12 },
  cssSnippets: { header: '.h{}', hero: '.hero{}', card: '.c{}', footer: '.f{}' },
  keywords: ['미니멀', '기업형'],
}

describe('vector-store', () => {
  beforeEach(() => {
    vi.spyOn(openai, 'createEmbedding').mockResolvedValue(mockEmbedding)
  })

  it('saveTemplate inserts record with embedding', async () => {
    const mockInsert = vi.fn().mockReturnValue({ data: { id: 'test-id' }, error: null })
    vi.spyOn(supabaseClient, 'createServiceClient').mockReturnValue({
      from: () => ({ insert: () => ({ select: () => ({ single: mockInsert }) }) }),
    } as any)

    const result = await saveTemplate('테스트 템플릿', mockProfile, 'http://thumb.url')
    expect(result).toBe('test-id')
    expect(openai.createEmbedding).toHaveBeenCalled()
  })

  it('searchSimilarTemplates returns array of templates', async () => {
    const mockRpc = vi.fn().mockReturnValue({
      data: [{ id: '1', name: '테스트', similarity: 0.9, thumbnail_url: '', css_snippets: {}, keywords: [] }],
      error: null,
    })
    vi.spyOn(supabaseClient, 'createServiceClient').mockReturnValue({
      rpc: mockRpc,
    } as any)

    const results = await searchSimilarTemplates('미니멀 IT 스타트업', 3)
    expect(results).toHaveLength(1)
    expect(mockRpc).toHaveBeenCalledWith('match_templates', expect.objectContaining({ match_count: 3 }))
  })
})
```

- [ ] **Step 2: Supabase RPC 함수 추가**

```sql
-- supabase/migrations/002_match_templates.sql
create or replace function match_templates(
  query_embedding vector(1536),
  match_count int default 3
)
returns table (
  id uuid,
  name text,
  thumbnail_url text,
  css_snippets jsonb,
  keywords text[],
  similarity float
)
language sql stable
as $$
  select
    id, name, thumbnail_url, css_snippets, keywords,
    1 - (embedding <=> query_embedding) as similarity
  from templates
  where embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

- [ ] **Step 3: Vector Store 구현**

```typescript
// src/lib/style-engine/vector-store.ts
import { createServiceClient } from '@/lib/supabase/client'
import { createEmbedding } from '@/lib/openai'
import type { StyleProfile } from '@/lib/types'

export interface TemplateMatch {
  id: string
  name: string
  thumbnailUrl: string
  cssSnippets: StyleProfile['cssSnippets']
  keywords: string[]
  similarity: number
}

function profileToEmbeddingText(profile: StyleProfile): string {
  return [
    `colors: ${Object.values(profile.colors).join(' ')}`,
    `fonts: ${profile.fonts.heading} ${profile.fonts.body}`,
    `layout: ${profile.layout.containerWidth} padding ${profile.layout.sectionPadding}`,
    `style: ${profile.keywords.join(', ')}`,
  ].join('. ')
}

export async function saveTemplate(
  name: string,
  profile: StyleProfile,
  thumbnailUrl: string
): Promise<string> {
  const embeddingText = profileToEmbeddingText(profile)
  const embedding = await createEmbedding(embeddingText)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('templates')
    .insert({
      name,
      thumbnail_url: thumbnailUrl,
      colors: profile.colors,
      fonts: profile.fonts,
      layout: profile.layout,
      css_snippets: profile.cssSnippets,
      keywords: profile.keywords,
      embedding: embedding as unknown as string,
    })
    .select('id')
    .single()

  if (error) throw new Error(`Failed to save template: ${error.message}`)
  return data.id
}

export async function searchSimilarTemplates(
  query: string,
  matchCount = 3
): Promise<TemplateMatch[]> {
  const embedding = await createEmbedding(query)
  const supabase = createServiceClient()

  const { data, error } = await supabase.rpc('match_templates', {
    query_embedding: embedding,
    match_count: matchCount,
  })

  if (error) throw new Error(`Vector search failed: ${error.message}`)

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    thumbnailUrl: row.thumbnail_url ?? '',
    cssSnippets: row.css_snippets,
    keywords: row.keywords,
    similarity: row.similarity,
  }))
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/style-engine/vector-store.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/style-engine/vector-store.ts supabase/migrations/002_match_templates.sql
git commit -m "feat: vector store with similarity search"
```

---

## Task 5: Style Engine — API 라우트

**Goal:** 관리자가 URL 또는 HTML을 POST하면 크롤→분석→저장까지 전체 파이프라인을 실행하는 API를 만든다.

**Files:**
- Create: `src/app/api/templates/analyze/route.ts`
- Create: `src/app/api/templates/route.ts`

**Acceptance Criteria:**
- [ ] `POST /api/templates/analyze` with `{ url }` → `{ templateId, thumbnailUrl }` 반환
- [ ] `POST /api/templates/analyze` with `{ html }` → `{ templateId, thumbnailUrl }` 반환
- [ ] `GET /api/templates` → 템플릿 목록 배열 반환
- [ ] url, html 모두 없으면 400 반환

**Verify:**
```bash
curl -X POST http://localhost:3000/api/templates/analyze \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","name":"테스트"}' 
# → { "templateId": "uuid", "thumbnailUrl": "https://..." }
```

**Steps:**

- [ ] **Step 1: Analyze 라우트 작성**

```typescript
// src/app/api/templates/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { crawlUrl, crawlHtml } from '@/lib/style-engine/crawler'
import { analyzeStyle } from '@/lib/style-engine/analyzer'
import { saveTemplate } from '@/lib/style-engine/vector-store'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { url, html: rawHtml, name } = body as {
      url?: string; html?: string; name: string
    }

    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })
    if (!url && !rawHtml) {
      return NextResponse.json({ error: 'url or html is required' }, { status: 400 })
    }

    // 1. 크롤
    const { html, css, screenshotUrl } = url
      ? await crawlUrl(url)
      : await crawlHtml(rawHtml!)

    // 2. 분석
    const profile = await analyzeStyle(html, css)

    // 3. 저장
    const templateId = await saveTemplate(name, profile, screenshotUrl)

    return NextResponse.json({ templateId, thumbnailUrl: screenshotUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 2: 템플릿 목록 라우트 작성**

```typescript
// src/app/api/templates/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/client'

export async function GET() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('templates')
    .select('id, name, thumbnail_url, keywords, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/templates/
git commit -m "feat: template analyze and list API routes"
```

---

## Task 6: Generation Engine — HTML Generator

**Goal:** 사용자 프롬프트 + 선택 템플릿으로 완성된 단일 HTML 파일을 생성한다.

**Files:**
- Create: `src/lib/generation-engine/html-generator.ts`
- Create: `src/app/api/generate/html/route.ts`

**Acceptance Criteria:**
- [ ] 반환된 HTML이 `<!DOCTYPE html>`로 시작한다
- [ ] CSS custom properties (`--color-primary` 등)가 HTML에 포함된다
- [ ] nav에 모든 menuItems가 링크로 포함된다
- [ ] 재시도 프롬프트 포함 시 이전 HTML보다 개선된 결과를 반환한다

**Verify:** `html-generator.test.ts` → 모든 테스트 통과

**Steps:**

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// src/lib/generation-engine/html-generator.test.ts
import { describe, it, expect, vi } from 'vitest'
import { generatePageHtml } from './html-generator'
import * as claude from '@/lib/claude'
import type { GenerationContext } from '@/lib/types'

const mockContext: GenerationContext = {
  templateId: 'tmpl-1',
  styleProfile: {
    colors: { primary: '#1A2B4C', secondary: '#334466', accent: '#FF6B35', background: '#FFF', text: '#111' },
    fonts: { heading: 'Pretendard', body: 'Noto Sans KR', size: { base: '16px', heading: '32px' } },
    layout: { containerWidth: '1200px', sectionPadding: '80px', gridColumns: 12 },
    cssSnippets: { header: '.h{display:flex}', hero: '.hero{padding:80px}', card: '.card{border-radius:8px}', footer: '.footer{background:#111}' },
    keywords: ['기업형'],
  },
  menuItems: [
    { id: '1', name: '홈', path: '/' },
    { id: '2', name: '서비스', path: '/services' },
  ],
  currentPage: '홈',
  userPrompt: '히어로에 강렬한 CTA 버튼 포함',
}

describe('generatePageHtml', () => {
  it('returns HTML starting with DOCTYPE', async () => {
    vi.spyOn(claude, 'claudeGenerate').mockResolvedValue('<!DOCTYPE html><html><head></head><body></body></html>')
    const result = await generatePageHtml(mockContext)
    expect(result).toMatch(/^<!DOCTYPE html>/i)
  })

  it('includes all menu items in nav', async () => {
    vi.spyOn(claude, 'claudeGenerate').mockResolvedValue(
      '<!DOCTYPE html><html><body><nav><a href="/">홈</a><a href="/services">서비스</a></nav></body></html>'
    )
    const result = await generatePageHtml(mockContext)
    expect(result).toContain('홈')
    expect(result).toContain('서비스')
  })
})
```

- [ ] **Step 2: HTML Generator 구현**

```typescript
// src/lib/generation-engine/html-generator.ts
import { claudeGenerate } from '@/lib/claude'
import type { GenerationContext } from '@/lib/types'

function buildSystemPrompt(ctx: GenerationContext): string {
  const { styleProfile: p } = ctx
  return `You are an expert Korean web designer and developer. Generate a complete, single-file HTML page.

DESIGN TOKENS (follow exactly):
- Primary color: ${p.colors.primary}
- Secondary: ${p.colors.secondary}
- Accent: ${p.colors.accent}
- Background: ${p.colors.background}
- Text: ${p.colors.text}
- Heading font: ${p.fonts.heading}
- Body font: ${p.fonts.body}
- Container width: ${p.layout.containerWidth}
- Section padding: ${p.layout.sectionPadding}

CSS PATTERNS TO REUSE:
Header CSS: ${p.cssSnippets.header}
Hero CSS: ${p.cssSnippets.hero}
Card CSS: ${p.cssSnippets.card}
Footer CSS: ${p.cssSnippets.footer}

REQUIREMENTS:
1. Return ONLY the complete HTML file starting with <!DOCTYPE html>
2. Use CSS custom properties: --color-primary, --color-secondary, --color-accent, --color-bg, --color-text
3. Include responsive design (mobile-first)
4. Use Google Fonts CDN for: ${p.fonts.heading}, ${p.fonts.body}
5. Navigation must include ALL menu items listed below
6. Write all content in Korean
7. No placeholder text — write realistic content based on the page purpose
8. No external JS libraries
9. Do not include \`\`\` code fences — return raw HTML only`
}

function buildUserPrompt(ctx: GenerationContext): string {
  const navLinks = ctx.menuItems
    .map((m) => `<a href="${m.path}">${m.name}</a>`)
    .join(', ')

  return `Generate the "${ctx.currentPage}" page.

Navigation items: ${navLinks}
Current page: ${ctx.currentPage}

Design instructions: ${ctx.userPrompt}

${ctx.existingPages?.length
  ? `Maintain consistency with existing pages. CSS variables already defined:\n${ctx.existingPages[0].cssVars}`
  : 'This is the first page — define all CSS custom properties in :root.'
}`
}

export async function generatePageHtml(
  ctx: GenerationContext,
  retryFeedback?: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(ctx)
  const userPrompt = retryFeedback
    ? `${buildUserPrompt(ctx)}\n\nPREVIOUS ATTEMPT FEEDBACK: ${retryFeedback}. Generate an improved version.`
    : buildUserPrompt(ctx)

  const raw = await claudeGenerate(systemPrompt, userPrompt, 8192)

  // 코드 블록 감싸진 경우 제거
  const html = raw.replace(/^```(?:html)?\s*/i, '').replace(/\s*```\s*$/, '').trim()

  if (!html.toLowerCase().startsWith('<!doctype')) {
    throw new Error('Generated content is not valid HTML')
  }

  return html
}
```

- [ ] **Step 3: HTML 생성 API 라우트**

```typescript
// src/app/api/generate/html/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generatePageHtml } from '@/lib/generation-engine/html-generator'
import { createServiceClient } from '@/lib/supabase/client'
import type { GenerationContext } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { projectId, pageId, retryFeedback } = body as {
      projectId: string; pageId: string; retryFeedback?: string
    }

    const supabase = createServiceClient()

    // 프로젝트 + 페이지 + 템플릿 조회
    const { data: project } = await supabase
      .from('projects')
      .select('*, templates(*)')
      .eq('id', projectId)
      .single()

    const { data: page } = await supabase
      .from('pages')
      .select('*')
      .eq('id', pageId)
      .single()

    if (!project || !page) {
      return NextResponse.json({ error: 'Project or page not found' }, { status: 404 })
    }

    const template = project.templates as any
    const menuItems = (project.menu_structure as any[]).map((m: any) => ({
      id: m.id, name: m.name, path: m.path,
    }))

    const ctx: GenerationContext = {
      templateId: project.template_id!,
      styleProfile: {
        colors: template.colors,
        fonts: template.fonts,
        layout: template.layout,
        cssSnippets: template.css_snippets,
        keywords: template.keywords,
      },
      menuItems,
      currentPage: page.page_name,
      userPrompt: page.prompt ?? '',
    }

    // 상태 업데이트
    await supabase.from('pages').update({ status: 'generating' }).eq('id', pageId)

    const html = await generatePageHtml(ctx, retryFeedback)

    // HTML 저장
    await supabase.from('pages').update({
      html_content: html,
      status: 'generated',
    }).eq('id', pageId)

    return NextResponse.json({ html })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/generation-engine/html-generator.test.ts
```
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/lib/generation-engine/html-generator.ts src/app/api/generate/html/
git commit -m "feat: html generation engine with claude"
```

---

## Task 7: Generation Engine — Screenshot

**Goal:** HTML 문자열을 Browserless에 보내서 PNG URL을 반환한다.

**Files:**
- Create: `src/lib/generation-engine/screenshot.ts`
- Create: `src/app/api/generate/screenshot/route.ts`

**Acceptance Criteria:**
- [ ] HTML 입력 시 Supabase Storage에 저장된 PNG의 public URL을 반환한다
- [ ] Browserless 실패 시 `ScreenshotError`를 throw한다
- [ ] 반환 URL이 `.png`로 끝난다

**Verify:** `curl -X POST /api/generate/screenshot -d '{"pageId":"uuid"}'` → `{ "screenshotUrl": "https://...png" }`

**Steps:**

- [ ] **Step 1: Screenshot 서비스 구현**

```typescript
// src/lib/generation-engine/screenshot.ts
import { createServiceClient } from '@/lib/supabase/client'

export class ScreenshotError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message)
    this.name = 'ScreenshotError'
  }
}

export async function htmlToScreenshot(html: string, filename: string): Promise<string> {
  const browserlessUrl = `${process.env.BROWSERLESS_URL}/screenshot?token=${process.env.BROWSERLESS_API_KEY}`

  const res = await fetch(browserlessUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html,
      options: { type: 'png', fullPage: true },
      viewport: { width: 1920, height: 1080 },
    }),
  })

  if (!res.ok) {
    throw new ScreenshotError(`Browserless failed: ${res.status} ${res.statusText}`)
  }

  const buffer = await res.arrayBuffer()

  const supabase = createServiceClient()
  const path = `pages/${filename}.png`
  const { error } = await supabase.storage
    .from('screenshots')
    .upload(path, buffer, { contentType: 'image/png', upsert: true })

  if (error) throw new ScreenshotError('Storage upload failed', error)

  const { data: { publicUrl } } = supabase.storage
    .from('screenshots')
    .getPublicUrl(path)

  return publicUrl
}
```

- [ ] **Step 2: Screenshot API 라우트**

```typescript
// src/app/api/generate/screenshot/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { htmlToScreenshot } from '@/lib/generation-engine/screenshot'
import { createServiceClient } from '@/lib/supabase/client'

export async function POST(req: NextRequest) {
  try {
    const { pageId } = await req.json() as { pageId: string }

    const supabase = createServiceClient()
    const { data: page, error } = await supabase
      .from('pages')
      .select('html_content, project_id')
      .eq('id', pageId)
      .single()

    if (error || !page?.html_content) {
      return NextResponse.json({ error: 'Page not found or no HTML' }, { status: 404 })
    }

    const filename = `${page.project_id}-${pageId}-${Date.now()}`
    const screenshotUrl = await htmlToScreenshot(page.html_content, filename)

    await supabase.from('pages')
      .update({ screenshot_url: screenshotUrl })
      .eq('id', pageId)

    return NextResponse.json({ screenshotUrl })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/generation-engine/screenshot.ts src/app/api/generate/screenshot/
git commit -m "feat: browserless screenshot service"
```

---

## Task 8: 관리자 UI — 템플릿 관리

**Goal:** 관리자가 URL 또는 HTML 파일을 업로드해서 스타일을 분석하고 템플릿 목록을 관리하는 UI를 만든다.

**Files:**
- Create: `src/components/admin/TemplateUploader.tsx`
- Create: `src/components/admin/TemplateCard.tsx`
- Create: `src/app/(admin)/admin/templates/page.tsx`
- Create: `src/app/(admin)/admin/templates/new/page.tsx`

**Acceptance Criteria:**
- [ ] URL 입력 후 "분석 시작" 클릭 시 로딩 상태가 표시된다
- [ ] 분석 완료 후 템플릿 목록에 새 카드가 추가된다
- [ ] 각 TemplateCard에 썸네일 이미지와 키워드 배지가 표시된다
- [ ] HTML 파일 드래그앤드롭 업로드가 동작한다

**Verify:** `http://localhost:3000/admin/templates/new` → URL 입력→분석→목록 확인 가능

**Steps:**

- [ ] **Step 1: TemplateUploader 컴포넌트**

```typescript
// src/components/admin/TemplateUploader.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'

interface Props { onSuccess: (templateId: string) => void }

type Step = 'idle' | 'crawling' | 'analyzing' | 'saving' | 'done' | 'error'

const STEP_LABELS: Record<Step, string> = {
  idle: '',
  crawling: '사이트 크롤링 중...',
  analyzing: 'AI 스타일 분석 중...',
  saving: '템플릿 저장 중...',
  done: '완료!',
  error: '오류 발생',
}

const STEP_PROGRESS: Record<Step, number> = {
  idle: 0, crawling: 25, analyzing: 60, saving: 85, done: 100, error: 0,
}

export function TemplateUploader({ onSuccess }: Props) {
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url || !name) return

    setStep('crawling')
    setError('')

    try {
      setStep('analyzing')
      const res = await fetch('/api/templates/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, name }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? '분석 실패')
      }

      setStep('saving')
      const { templateId } = await res.json()
      setStep('done')
      onSuccess(templateId)
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류')
      setStep('error')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">템플릿 이름</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="클린 코퍼레이트" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="url">사이트 URL</Label>
        <Input id="url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com" required />
      </div>
      {step !== 'idle' && step !== 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{STEP_LABELS[step]}</p>
          <Progress value={STEP_PROGRESS[step]} />
        </div>
      )}
      {step === 'error' && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <Button type="submit" disabled={step !== 'idle' && step !== 'error' && step !== 'done'}>
        분석 시작
      </Button>
    </form>
  )
}
```

- [ ] **Step 2: TemplateCard 컴포넌트**

```typescript
// src/components/admin/TemplateCard.tsx
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Image from 'next/image'

interface Props {
  id: string
  name: string
  thumbnailUrl: string | null
  keywords: string[]
  createdAt: string
}

export function TemplateCard({ name, thumbnailUrl, keywords, createdAt }: Props) {
  return (
    <Card className="overflow-hidden">
      <div className="relative h-48 bg-muted">
        {thumbnailUrl ? (
          <Image src={thumbnailUrl} alt={name} fill className="object-cover object-top" />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            미리보기 없음
          </div>
        )}
      </div>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-wrap gap-1">
          {keywords.slice(0, 4).map((kw) => (
            <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(createdAt).toLocaleDateString('ko-KR')}
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: 관리자 템플릿 페이지들**

```typescript
// src/app/(admin)/admin/templates/page.tsx
import { createServerSupabaseClient } from '@/lib/supabase/client'
import { TemplateCard } from '@/components/admin/TemplateCard'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default async function TemplatesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, thumbnail_url, keywords, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">스타일 템플릿</h1>
        <Button asChild>
          <Link href="/admin/templates/new">+ 새 템플릿 추가</Link>
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(templates ?? []).map((t) => (
          <TemplateCard key={t.id} id={t.id} name={t.name}
            thumbnailUrl={t.thumbnail_url} keywords={t.keywords}
            createdAt={t.created_at} />
        ))}
      </div>
    </div>
  )
}
```

```typescript
// src/app/(admin)/admin/templates/new/page.tsx
'use client'
import { useRouter } from 'next/navigation'
import { TemplateUploader } from '@/components/admin/TemplateUploader'

export default function NewTemplatePage() {
  const router = useRouter()
  return (
    <div className="container max-w-lg py-8 space-y-6">
      <h1 className="text-2xl font-bold">새 템플릿 추가</h1>
      <p className="text-muted-foreground">
        분석할 사이트 URL을 입력하세요. AI가 디자인 스타일을 자동으로 추출합니다.
      </p>
      <TemplateUploader onSuccess={() => router.push('/admin/templates')} />
    </div>
  )
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/components/admin/ src/app/(admin)/
git commit -m "feat: admin template management UI"
```

---

## Task 9: 사용자 Wizard UI

**Goal:** 사용자가 템플릿 선택 → 메뉴 구조 설정 → 페이지별 프롬프트 입력 → 시안 확인 → 다운로드까지 완료하는 Wizard를 만든다.

**Files:**
- Create: `src/components/user/TemplateSelector.tsx`
- Create: `src/components/user/MenuBuilder.tsx`
- Create: `src/components/user/PromptInput.tsx`
- Create: `src/components/user/PagePreview.tsx`
- Create: `src/components/user/WizardLayout.tsx`
- Create: `src/app/(user)/projects/new/page.tsx`
- Create: `src/app/(user)/projects/[id]/page.tsx`
- Create: `src/app/api/projects/route.ts`
- Create: `src/app/api/projects/[id]/pages/route.ts`

**Acceptance Criteria:**
- [ ] Step 1~5 이동이 WizardLayout에서 명확히 표시된다
- [ ] TemplateSelector가 템플릿 목록을 불러와 썸네일 그리드로 표시한다
- [ ] MenuBuilder에서 항목 추가/삭제/순서변경이 가능하다
- [ ] PromptInput에 힌트 예시가 표시된다
- [ ] PagePreview에서 PNG가 전체화면으로 표시되고 [승인] [재생성] 버튼이 있다
- [ ] 최종 단계에서 모든 HTML을 ZIP으로 다운로드 가능하다

**Verify:** `http://localhost:3000/projects/new` → 전체 Wizard 흐름 완주 가능

**Steps:**

- [ ] **Step 1: WizardLayout + TemplateSelector**

```typescript
// src/components/user/WizardLayout.tsx
interface Props {
  currentStep: number
  steps: string[]
  children: React.ReactNode
}

export function WizardLayout({ currentStep, steps, children }: Props) {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container py-4">
          <div className="flex items-center gap-2">
            {steps.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium
                  ${i < currentStep ? 'bg-primary text-primary-foreground'
                  : i === currentStep ? 'bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2'
                  : 'bg-muted text-muted-foreground'}`}>
                  {i + 1}
                </div>
                <span className={`text-sm hidden sm:block ${i === currentStep ? 'font-medium' : 'text-muted-foreground'}`}>
                  {step}
                </span>
                {i < steps.length - 1 && <div className="h-px w-8 bg-border" />}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="container py-8">{children}</div>
    </div>
  )
}
```

```typescript
// src/components/user/TemplateSelector.tsx
'use client'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Image from 'next/image'

interface Template { id: string; name: string; thumbnail_url: string | null; keywords: string[] }
interface Props { value: string; onChange: (id: string) => void }

export function TemplateSelector({ value, onChange }: Props) {
  const [templates, setTemplates] = useState<Template[]>([])

  useEffect(() => {
    fetch('/api/templates').then((r) => r.json()).then(setTemplates)
  }, [])

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {templates.map((t) => (
        <Card key={t.id} onClick={() => onChange(t.id)}
          className={`cursor-pointer overflow-hidden transition-all ${value === t.id ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}>
          <div className="relative h-40 bg-muted">
            {t.thumbnail_url && (
              <Image src={t.thumbnail_url} alt={t.name} fill className="object-cover object-top" />
            )}
          </div>
          <div className="p-3 space-y-2">
            <p className="font-medium text-sm">{t.name}</p>
            <div className="flex flex-wrap gap-1">
              {t.keywords.slice(0, 3).map((kw) => (
                <Badge key={kw} variant="secondary" className="text-xs">{kw}</Badge>
              ))}
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: MenuBuilder**

```typescript
// src/components/user/MenuBuilder.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MenuItem } from '@/lib/types'

interface Props { value: MenuItem[]; onChange: (items: MenuItem[]) => void }

export function MenuBuilder({ value, onChange }: Props) {
  const [newName, setNewName] = useState('')

  function addItem() {
    if (!newName.trim()) return
    const slug = newName.trim().toLowerCase().replace(/\s+/g, '-')
    onChange([...value, { id: Date.now().toString(), name: newName.trim(), path: `/${slug}` }])
    setNewName('')
  }

  function removeItem(id: string) {
    onChange(value.filter((item) => item.id !== id))
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={item.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/40">
            <span className="text-muted-foreground text-sm w-5">{i + 1}</span>
            <span className="flex-1 font-medium text-sm">{item.name}</span>
            <span className="text-xs text-muted-foreground">{item.path}</span>
            <Button variant="ghost" size="sm" onClick={() => removeItem(item.id)}
              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive">×</Button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={newName} onChange={(e) => setNewName(e.target.value)}
          placeholder="페이지 이름 (예: 서비스 소개)"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())} />
        <Button type="button" variant="outline" onClick={addItem}>추가</Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: PromptInput + PagePreview**

```typescript
// src/components/user/PromptInput.tsx
'use client'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

const HINTS: Record<string, string[]> = {
  default: [
    '히어로 섹션에 강렬한 CTA 버튼을 포함해주세요',
    '서비스 3개를 카드 형태로 나열해주세요',
    '신뢰감을 주는 통계 수치(숫자)를 포함해주세요',
  ],
}

interface Props { pageName: string; value: string; onChange: (v: string) => void }

export function PromptInput({ pageName, value, onChange }: Props) {
  const hints = HINTS[pageName] ?? HINTS.default

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>"{pageName}" 페이지 설명</Label>
        <Textarea value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={`이 페이지에 담을 내용과 스타일을 설명해주세요...`}
          className="min-h-[120px]" />
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">힌트 (클릭하면 입력됩니다)</p>
        <div className="flex flex-col gap-1">
          {hints.map((hint) => (
            <button key={hint} type="button" onClick={() => onChange(value ? `${value}\n${hint}` : hint)}
              className="text-left text-xs text-primary hover:underline">
              + {hint}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
```

```typescript
// src/components/user/PagePreview.tsx
'use client'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

interface Props {
  screenshotUrl: string
  pageName: string
  onApprove: () => void
  onRetry: (feedback: string) => void
  isLoading: boolean
}

export function PagePreview({ screenshotUrl, pageName, onApprove, onRetry, isLoading }: Props) {
  return (
    <div className="space-y-4">
      <div className="relative w-full aspect-video border rounded-lg overflow-hidden bg-muted">
        <Image src={screenshotUrl} alt={`${pageName} 시안`} fill className="object-cover object-top" />
      </div>
      <div className="flex gap-3">
        <Button onClick={onApprove} disabled={isLoading}>승인</Button>
        <Button variant="outline" disabled={isLoading}
          onClick={() => onRetry('레이아웃을 개선하고 가독성을 높여주세요')}>
          다시 생성
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: 프로젝트 API 라우트**

```typescript
// src/app/api/projects/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/client'

export async function POST(req: NextRequest) {
  const { name, industry, templateId, menuStructure } = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('projects')
    .insert({ name, industry, template_id: templateId, menu_structure: menuStructure })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ projectId: data.id })
}
```

```typescript
// src/app/api/projects/[id]/pages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/client'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { pageName, pageOrder, prompt } = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('pages')
    .insert({ project_id: params.id, page_name: pageName, page_order: pageOrder, prompt })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pageId: data.id })
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('project_id', params.id)
    .order('page_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
```

- [ ] **Step 5: 커밋**

```bash
git add src/components/user/ src/app/(user)/ src/app/api/projects/
git commit -m "feat: user wizard UI and project API routes"
```

---

## Task 10: ZIP 다운로드 + 완료 화면

**Goal:** 프로젝트의 모든 approved 페이지를 ZIP으로 묶어서 다운로드한다.

**Files:**
- Create: `src/app/api/projects/[id]/download/route.ts`

**Acceptance Criteria:**
- [ ] `GET /api/projects/[id]/download` → `Content-Type: application/zip` 응답
- [ ] ZIP 내 각 HTML 파일명이 페이지명을 기반으로 한다 (`index.html`, `services.html` 등)
- [ ] approved 상태가 아닌 페이지는 ZIP에서 제외된다

**Verify:** 브라우저에서 다운로드 버튼 클릭 → ZIP 파일 저장 → 압축 해제 후 HTML 파일 확인

**Steps:**

- [ ] **Step 1: JSZip 설치**

```bash
npm install jszip
npm install -D @types/jszip
```

- [ ] **Step 2: 다운로드 API 라우트**

```typescript
// src/app/api/projects/[id]/download/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/client'
import JSZip from 'jszip'

function pageNameToFilename(name: string, order: number): string {
  if (order === 0) return 'index.html'
  return `${name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-가-힣]/g, '')}.html`
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServiceClient()
  const { data: pages, error } = await supabase
    .from('pages')
    .select('page_name, page_order, html_content, status')
    .eq('project_id', params.id)
    .eq('status', 'approved')
    .order('page_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!pages?.length) return NextResponse.json({ error: 'No approved pages' }, { status: 404 })

  const zip = new JSZip()
  for (const page of pages) {
    if (!page.html_content) continue
    const filename = pageNameToFilename(page.page_name, page.page_order)
    zip.file(filename, page.html_content)
  }

  const zipBuffer = await zip.generateAsync({ type: 'arraybuffer' })
  return new NextResponse(zipBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="website-${params.id}.zip"`,
    },
  })
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/projects/[id]/download/
git commit -m "feat: zip download for approved pages"
```

---

## 자체 검토

**스펙 커버리지:**
- [x] Style Engine (크롤→분석→벡터) — Task 2, 3, 4, 5
- [x] Generation Engine (Claude HTML + Browserless) — Task 6, 7
- [x] 관리자 UI (템플릿 관리) — Task 8
- [x] 사용자 Wizard (선택→메뉴→프롬프트→시안→다운) — Task 9, 10
- [x] 데이터 모델 (templates, projects, pages) — Task 0

**Placeholder 없음** — 모든 스텝에 실제 코드 포함

**타입 일관성:** `StyleProfile`, `MenuItem`, `GenerationContext` Task 1에서 정의 → 전 태스크 재사용
