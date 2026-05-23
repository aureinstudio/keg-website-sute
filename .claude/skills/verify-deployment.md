---
name: verify-deployment
description: "Vercel 배포 후 모든 핵심 기능이 정상 동작하는지 체계적으로 검증한다. 배포할 때마다 실행."
---

# Verify Deployment — 배포 검증 체크리스트

배포 URL: (매번 업데이트)

## Phase 1: 기본 페이지 로드

- [ ] `GET /` → 메인 랜딩 페이지 정상 렌더링
- [ ] `GET /admin/templates` → 템플릿 목록 페이지 정상 렌더링
- [ ] `GET /admin/templates/new` → 템플릿 추가 폼 정상 렌더링
- [ ] `GET /projects/new` → Wizard Step 1 정상 렌더링

## Phase 2: API 헬스체크

```bash
BASE_URL=https://your-deployment.vercel.app

# 템플릿 목록 API
curl "$BASE_URL/api/templates"
# 기대값: [] 또는 [{id, name, ...}] 배열

# 프로젝트 목록 API
curl "$BASE_URL/api/projects"
# 기대값: [] 또는 [{id, name, ...}] 배열
```

## Phase 3: Style Engine 검증

```bash
# 테스트 URL로 템플릿 분석 (실제 분석 발생, API 비용 소모)
curl -X POST "$BASE_URL/api/templates/analyze" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "name": "검증용 테스트"}'

# 기대값: {"templateId": "uuid", "thumbnailUrl": "https://..."}
# 실패: {"error": "..."} → 에러 메시지로 원인 파악
```

**확인 항목:**
- [ ] Supabase 연결 정상 (templateId 반환)
- [ ] Browserless 연결 정상 (thumbnailUrl에 이미지 URL 존재)
- [ ] OpenAI 임베딩 정상 (DB에 embedding IS NOT NULL)
- [ ] Claude 분석 정상 (keywords 배열에 값 존재)

```sql
-- Supabase SQL Editor에서 확인
SELECT name, keywords, (embedding IS NOT NULL) as embedded, thumbnail_url
FROM templates
WHERE name = '검증용 테스트';
```

## Phase 4: Generation Engine 검증

Phase 3에서 생성된 templateId 사용:

```bash
TEMPLATE_ID=위에서_받은_templateId

# 1. 프로젝트 생성
PROJECT=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"검증 프로젝트\",\"templateId\":\"$TEMPLATE_ID\",\"menuStructure\":[{\"id\":\"1\",\"name\":\"홈\",\"path\":\"/\"}]}")
PROJECT_ID=$(echo $PROJECT | python3 -c "import sys,json; print(json.load(sys.stdin)['projectId'])")

# 2. 페이지 생성
PAGE=$(curl -s -X POST "$BASE_URL/api/projects/$PROJECT_ID/pages" \
  -H "Content-Type: application/json" \
  -d '{"pageName":"홈","pageOrder":0,"prompt":"IT 스타트업 홈페이지, 히어로에 CTA 버튼 포함"}')
PAGE_ID=$(echo $PAGE | python3 -c "import sys,json; print(json.load(sys.stdin)['pageId'])")

# 3. HTML 생성 (최대 30초 소요)
curl -X POST "$BASE_URL/api/generate/html" \
  -H "Content-Type: application/json" \
  -d "{\"projectId\":\"$PROJECT_ID\",\"pageId\":\"$PAGE_ID\"}"

# 4. 스크린샷 생성
curl -X POST "$BASE_URL/api/generate/screenshot" \
  -H "Content-Type: application/json" \
  -d "{\"pageId\":\"$PAGE_ID\"}"
```

**확인 항목:**
- [ ] HTML 생성 정상 (html 필드에 `<!DOCTYPE html>`로 시작하는 내용)
- [ ] 스크린샷 생성 정상 (screenshotUrl에 `.png` URL)
- [ ] Vercel 타임아웃 없음 (30초 이내 응답)

## Phase 5: 다운로드 검증

```bash
# 페이지 approved 상태로 변경 후 ZIP 다운로드
# (Supabase에서 직접)
UPDATE pages SET status = 'approved' WHERE id = 'PAGE_ID';

curl -O "$BASE_URL/api/projects/$PROJECT_ID/download"
# 기대값: website-UUID.zip 파일 다운로드
```

- [ ] ZIP 파일 다운로드 정상
- [ ] ZIP 내 `index.html` 존재
- [ ] HTML 파일 브라우저에서 열기 가능

## Phase 6: Vercel 환경변수 확인

Vercel 대시보드 → Settings → Environment Variables:

- [ ] `NEXT_PUBLIC_SUPABASE_URL` 설정됨
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` 설정됨
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 설정됨
- [ ] `ANTHROPIC_API_KEY` 설정됨
- [ ] `OPENAI_API_KEY` 설정됨
- [ ] `BROWSERLESS_API_KEY` 설정됨
- [ ] `BROWSERLESS_URL` 설정됨

## 검증 완료 기준

모든 Phase 체크박스 통과 시 배포 성공.
실패 항목 있으면 `debug-generation` 스킬 참조.

## 정리 (검증 후)

```sql
-- 검증용 데이터 삭제
DELETE FROM templates WHERE name = '검증용 테스트';
DELETE FROM projects WHERE name = '검증 프로젝트';
```
