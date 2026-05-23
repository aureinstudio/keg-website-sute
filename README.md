# Homepage Generator

AI 기반 홈페이지 자동 생성 웹 애플리케이션

## 설치 방법

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
```bash
cp .env.local.example .env.local
# .env.local 파일을 열어 각 키를 입력하세요
```

필요한 API 키:
- **Supabase**: [supabase.com](https://supabase.com) — 프로젝트 생성 후 URL, anon key, service role key
- **Anthropic**: [console.anthropic.com](https://console.anthropic.com) — Claude API 키
- **OpenAI**: [platform.openai.com](https://platform.openai.com) — GPT 및 임베딩용
- **Browserless**: [browserless.io](https://browserless.io) — HTML→스크린샷 변환

### 3. Supabase 마이그레이션 실행
```bash
# Supabase CLI 설치 후
npx supabase db reset
# 또는 supabase/migrations/ 폴더의 SQL을 Supabase 대시보드에서 직접 실행
```

### 4. 개발 서버 실행
```bash
npm run dev
```

## 사용 방법

### 관리자 (스타일 학습)
1. `http://localhost:3000/admin/templates/new` 접속
2. 학습시킬 사이트 URL 입력
3. AI가 자동으로 디자인 스타일 분석 및 저장

### 사용자 (홈페이지 생성)
1. `http://localhost:3000/projects/new` 접속
2. 프로젝트 정보 입력
3. 디자인 스타일 선택
4. 메뉴 구조 설정
5. 각 페이지별 설명 입력 → 시안 확인 → 승인
6. ZIP 다운로드

## 아키텍처

```
Style Engine      → 기존 사이트 학습 → Supabase pgvector 저장
Generation Engine → Claude HTML 생성 → Browserless PNG 변환
App UI            → 관리자(템플릿 관리) + 사용자(Wizard)
```

## 기술 스택

- **Next.js 15** (App Router + TypeScript)
- **Supabase** (pgvector + Storage)
- **Claude API** (HTML 생성)
- **OpenAI** (임베딩 + 이미지 생성)
- **Browserless.io** (HTML→스크린샷)
- **Tailwind CSS**
