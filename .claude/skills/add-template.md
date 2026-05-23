---
name: add-template
description: "새 디자인 스타일 템플릿을 학습하고 저장하는 전체 워크플로우. URL 또는 HTML 파일로 기존 사이트를 분석해서 Supabase에 벡터 저장한다."
---

# Add Template — 스타일 템플릿 학습 워크플로우

새 디자인 스타일을 시스템에 추가할 때 사용한다.

## 실행 전 체크리스트

- [ ] `.env.local`에 `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `BROWSERLESS_API_KEY` 설정됨
- [ ] Supabase `templates` 테이블과 `screenshots` 버킷 존재 확인
- [ ] 추가할 사이트 URL 또는 HTML 파일 준비됨

## 방법 1: API 직접 호출 (개발 서버 실행 중)

```bash
curl -X POST http://localhost:3000/api/templates/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://학습할사이트.com",
    "name": "템플릿 이름 (예: 클린 코퍼레이트)"
  }'
```

성공 응답:
```json
{ "templateId": "uuid", "thumbnailUrl": "https://...supabase.co/..." }
```

## 방법 2: 관리자 UI 사용

1. `/admin/templates/new` 접속
2. 템플릿 이름 + URL 입력
3. "분석 시작" 클릭 → 진행 바 확인 (1~2분 소요)
4. `/admin/templates` 에서 새 카드 확인

## 방법 3: HTML 파일 직접 업로드

```bash
curl -X POST http://localhost:3000/api/templates/analyze \
  -H "Content-Type: application/json" \
  -d "{
    \"html\": \"$(cat your-file.html | sed 's/\"/\\\"/g')\",
    \"name\": \"로컬 HTML 템플릿\"
  }"
```

## 파이프라인 내부 흐름

```
URL/HTML 입력
  → crawler.ts: crawlUrl() or crawlHtml()
      → Browserless 스크린샷 → Supabase Storage 업로드
  → analyzer.ts: analyzeStyle(html, css)
      → Claude API → StyleProfile JSON 추출
  → vector-store.ts: saveTemplate()
      → OpenAI text-embedding-3-small → pgvector 저장
```

## 디버깅

**크롤링 실패 시:**
```sql
-- Supabase에서 저장된 스크린샷 확인
SELECT id, name, thumbnail_url FROM templates ORDER BY created_at DESC LIMIT 5;
```

**분석 결과 확인:**
```sql
SELECT name, colors, fonts, keywords FROM templates WHERE name = '템플릿명';
```

**임베딩 누락 확인:**
```sql
SELECT id, name, (embedding IS NOT NULL) as has_embedding FROM templates;
-- has_embedding이 false면 벡터 검색에서 제외됨
```

## 완료 후 검증

```bash
# 유사 템플릿 검색 테스트 (직접 쿼리)
# Supabase SQL Editor에서:
SELECT name, keywords, similarity
FROM match_templates(
  (SELECT embedding FROM templates ORDER BY created_at DESC LIMIT 1),
  3
);
```
