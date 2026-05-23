# 홈페이지 생성 웹 애플리케이션 — 설계 문서

> 작성일: 2026-05-22  
> 접근법: Style Engine 우선 (Approach B)  
> 상태: 설계 승인 완료

---

## 1. 프로젝트 개요

작업자(관리자)의 기존 홈페이지 작업물을 AI가 학습해 디자인 스타일 템플릿을 생성하고, 사용자가 메뉴 구조와 프롬프트를 입력하면 해당 스타일로 페이지 시안(이미지)과 HTML을 자동 생성해주는 웹 애플리케이션.

**사용자 대상:** 처음엔 내부 툴(작업자 본인), 이후 클라이언트 셀프서비스 SaaS로 확장.

---

## 2. 기술 스택

| 레이어 | 기술 |
|--------|------|
| 풀스택 프레임워크 | Next.js 14+ (App Router) + TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| 데이터베이스 | Supabase (pgvector + Storage + Auth) |
| HTML→스크린샷 | Browserless.io API |
| HTML 생성 AI | Claude API (claude-sonnet-4) |
| 이미지 에셋 생성 | OpenAI gpt-image-1 |
| 임베딩 | OpenAI text-embedding-3-small |
| 배포 | Vercel (Next.js) + Supabase Cloud |

---

## 3. 전체 아키텍처

```
[사용자]
    │
    ▼
[Next.js App]
    ├── 관리자 영역 (/admin)
    │     ├── 기존 사이트 URL/HTML 업로드
    │     ├── 스타일 분석 실행
    │     └── 템플릿 관리
    │
    └── 사용자 영역 (/)
          ├── 메뉴 구조 입력
          ├── 페이지별 프롬프트 입력
          ├── 스타일 템플릿 선택
          └── 시안 확인 → HTML 다운로드

[Style Engine]                    [Generation Engine]
├── Crawler (URL → HTML/CSS)      ├── Claude API (HTML 생성)
├── Analyzer (스타일 추출)         ├── Browserless (HTML→PNG)
└── Supabase pgvector (저장)       └── gpt-image-1 (에셋 이미지)
```

**3개의 독립 서브시스템:**
1. **Style Engine** — 기존 작업물 학습 → 템플릿 저장
2. **Generation Engine** — 프롬프트 + 템플릿 → 페이지 생성
3. **App UI** — 관리자/사용자 인터페이스

---

## 4. Style Engine 설계

### 4-1. 파이프라인

```
입력 (URL 또는 HTML 파일)
    │
    ▼
[Crawler]
    ├── Puppeteer로 URL 접속 → 전체 페이지 스크린샷
    ├── HTML/CSS 전체 추출
    └── 이미지 에셋 목록 수집

    │
    ▼
[Analyzer] — Claude API
    ├── 색상 팔레트 추출 (primary, secondary, accent, background)
    ├── 타이포그래피 (폰트, 크기, 자간, 행간)
    ├── 레이아웃 패턴 (그리드, 섹션 구조, 여백 규칙)
    ├── 컴포넌트 패턴 (헤더, 히어로, 카드, 푸터 스타일)
    └── 디자인 키워드 추출

    │
    ▼
[Vector Store] — Supabase pgvector
    ├── 스타일 메타데이터 (JSON)
    ├── 대표 스크린샷 (Supabase Storage)
    ├── 원본 CSS 스니펫 (섹션별)
    └── 임베딩 벡터 (text-embedding-3-small)
```

### 4-2. 템플릿 저장 구조

```json
{
  "id": "template_001",
  "name": "클린 코퍼레이트",
  "thumbnail": "screenshot_url",
  "colors": { "primary": "#1A2B4C", "accent": "#FF6B35" },
  "fonts": { "heading": "Pretendard", "body": "Noto Sans KR" },
  "layout": "wide-container, section-padding-80px",
  "css_snippets": { "header": "...", "hero": "...", "card": "..." },
  "keywords": ["기업형", "신뢰감", "네이비"],
  "embedding": [0.023, -0.114, "..."]
}
```

---

## 5. Generation Engine 설계

### 5-1. 생성 흐름

```
사용자 입력
├── 메뉴 구조
├── 현재 페이지명
├── 프롬프트
└── 선택한 템플릿

    │
    ▼
[Step 1] 컨텍스트 조합
    ├── 선택 템플릿의 CSS 스니펫 로드
    ├── 전체 메뉴 구조 → 네비게이션 구성
    └── 기존 생성 페이지 스타일 참조 (일관성)

    │
    ▼
[Step 2] Claude API — HTML 생성
    ├── 시스템 프롬프트: 템플릿 CSS + 디자인 규칙
    ├── 유저 프롬프트: 사용자 입력
    └── 출력: 완성된 단일 HTML 파일 (인라인 CSS 포함)

    │
    ▼
[Step 3] Browserless API — 스크린샷
    ├── HTML을 1920px 너비로 렌더링
    ├── 풀페이지 PNG 생성
    └── Supabase Storage 임시 저장

    │
    ▼
[Step 4] 사용자에게 반환
    ├── 시안 이미지 (PNG 프리뷰)
    ├── 수정 요청 → Step 2로 재시도
    └── 승인 → HTML 다운로드 / 다음 페이지
```

### 5-2. 페이지 간 일관성 보장
- 헤더/푸터/네비는 최초 1회 생성 후 전 페이지 재사용
- 색상·폰트 변수를 CSS custom property로 통일

---

## 6. UI/UX 흐름

### 관리자 영역
```
/admin/templates   — 템플릿 목록, URL 입력/HTML 업로드, 분석 실행
/admin/projects    — 생성된 프로젝트 전체 관리
```

### 사용자 Wizard 흐름
```
Step 1. 프로젝트 생성     — 사이트명, 업종, 언어 입력
Step 2. 템플릿 선택       — 썸네일 그리드 → 상세 미리보기 → 선택
Step 3. 메뉴 구조 설정    — 드래그앤드롭 페이지 추가/순서 변경
Step 4. 페이지별 생성(반복) — 프롬프트 입력 → 생성 → 시안 확인 → 승인/재생성
Step 5. 완료              — 전체 페이지 ZIP 다운로드
```

**핵심 UX 원칙:**
- Wizard 형태로 단계 명확히 분리
- 프롬프트 입력창에 예시 힌트 제공
- 생성 중 진행 상태 실시간 표시

---

## 7. 데이터 모델

```sql
-- 스타일 템플릿
templates (id, name, thumbnail_url, colors jsonb, fonts jsonb,
           layout jsonb, css_snippets jsonb, keywords text[],
           embedding vector(1536))

-- 프로젝트
projects (id, user_id, name, industry, template_id,
          menu_structure jsonb, status, created_at)

-- 생성된 페이지
pages (id, project_id, page_name, page_order, prompt,
       html_content text, screenshot_url, status, created_at)
```

---

## 8. 에러 처리

| 상황 | 처리 방식 |
|------|-----------|
| Claude API 타임아웃 | 자동 1회 재시도 → 실패 시 사용자 안내 |
| Browserless 스크린샷 실패 | HTML 다운로드 버튼 직접 노출 |
| 스타일 크롤링 실패 | 관리자 오류 리포트, 수동 업로드 대체 |
| 생성 HTML 불완전 | Claude 재호출 + 불완전 안내 프롬프트 추가 |

---

## 9. 개발 우선순위

1. **Phase 1** — Style Engine (크롤러 + 분석기 + 벡터 저장)
2. **Phase 2** — Generation Engine (Claude HTML 생성 + Browserless 스크린샷)
3. **Phase 3** — 관리자 UI (템플릿 관리)
4. **Phase 4** — 사용자 UI (Wizard 플로우)
5. **Phase 5** — SaaS 확장 (Auth, 결제, 멀티 유저)
