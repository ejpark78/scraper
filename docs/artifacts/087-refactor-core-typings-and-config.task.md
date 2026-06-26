# 📝 [Task] 코어 모듈 타입 복구 및 뷰어 설정 통합 작업 목록

본 문서는 이번 3차 개선 세션에서 수행한 작업 목록과 상태를 정리합니다.

---

## 📋 세부 작업 이력

- [x] **SiteRegistry 타입 상향 개선**
  - [x] [SiteRegistry.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/core/SiteRegistry.ts) 내 `fields`, `options`, `generateUrls`, `buildDocument`, `extractId` 등 전역 any 타입 제거 및 Record/제네릭 타입 적용
  - [x] 에러 `catch` 블록 `any` ➡️ `unknown` 정형화

- [x] **BasePipeline 레거시 any 타입 해소**
  - [x] [BasePipeline.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/core/BasePipeline.ts) 내 `redisInstance` 및 로컬 `redis` 인스턴스의 any 지정을 `Redis | null` 구체 타입으로 매핑
  - [x] `catch` 구절의 `any` 에러 인스턴스 타입 검사 적용 (`err: unknown`)

- [x] **뷰어 Joplin 설정 중앙화 및 정적 바인딩 이행**
  - [x] [AppConfig.ts](file:///Users/ejpark/workspace/scraper/apps/viewer/src/config/AppConfig.ts) 에 `JOPLIN_API_URL` 상수 정식 등록
  - [x] [joplin.ts](file:///Users/ejpark/workspace/scraper/apps/viewer/src/exporter/export/joplin.ts) 내 환경변수 하드코딩 제거 및 `let bookFolder` 에 명시적 타입(`{ id: string }`) 바인딩

---

## 🚀 후속 검증 계획
- [x] 크롤러 패키지 컴파일 테스트 (`npx tsc --noEmit` in `apps/crawler`)
- [x] 뷰어 패키지 컴파일 테스트 (`npx tsc --noEmit` in `apps/viewer`)
