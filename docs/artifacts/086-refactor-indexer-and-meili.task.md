# 📝 [Task] 인덱서 워커 및 Meilisearch 어댑터 2차 리팩터링 작업 목록

본 문서는 이번 2차 개선 세션에서 수행한 작업 목록과 상태를 정리합니다.

---

## 📋 세부 작업 이력

- [x] **IndexerWorker 자원 관리 및 환경 설정 결합**
  - [x] [IndexerWorker.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/workers/IndexerWorker.ts) 에 SIGINT, SIGTERM 리스너 장착 및 Graceful Shutdown 루틴 구성
  - [x] `process.env.REDIS_URL` 제거 및 `AppConfig.REDIS_URL` 통합 바인딩
  - [x] `any` 에러 catch 구절을 `unknown` 및 에러 메시지 추출 가드로 보강

- [x] **MeiliSearchDatabase 타입 엄격화 이행**
  - [x] [meili.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/database/meili.ts)의 `request` 제네릭 및 Body 매개변수를 `unknown`으로 치환
  - [x] `addDocuments` 의 `any[]`를 `Record<string, unknown>[]` 형식으로 수정
  - [x] `search` 의 `any`를 `unknown` 및 `Record<string, unknown>`으로 변경하여 strict typing 준수

---

## 🚀 후속 검증 계획
- [x] 2차 리팩터링 소스 컴파일 검증 (`npx tsc --noEmit`)
