# 📝 [Task] 컨버터 리팩터링 및 Graceful Shutdown 작업 목록

본 문서는 이번 개선 세션에서 수행한 작업 목록과 상태를 정리합니다.

---

## 📋 세부 작업 이력

- [x] **BaseConverter 설계 및 구현**
  - [x] [BaseConverter.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/core/BaseConverter.ts) 신설
  - [x] Prettify, PrettifyAndSave, htmlToMarkdown 기본 로직 공통화

- [x] **사이트별 Converter 리팩터링 및 상속 구조 전환**
  - [x] `aicasebook/Converter.ts` 리팩터링
  - [x] `dailydoseofds/Converter.ts` 리팩터링
  - [x] `geeknews/Converter.ts` 리팩터링
  - [x] `gpters/Converter.ts` 리팩터링
  - [x] `linkedin/company/Converter.ts` 리팩터링
  - [x] `linkedin/jobs/Converter.ts` 리팩터링
  - [x] `maily/josh/Converter.ts` 리팩터링
  - [x] `pytorch_kr/Converter.ts` 리팩터링
  - [x] `uppity/Converter.ts` 리팩터링
  - [x] `yozm/Converter.ts` 리팩터링

- [x] **워커 Graceful Shutdown 핸들링 구현**
  - [x] [ConverterWorker.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/workers/ConverterWorker.ts) 리액션 핸들러 및 리소스 회수 로직 추가
  - [x] [ScraperWorker.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/workers/ScraperWorker.ts) shutdown 기능 탑재 및 시그널 리스너 구성

- [x] **타입 사양 교정 및 `any` 제거**
  - [x] ConverterWorker 내 `fetchAndConvertFromJsonApi` 임시 캐스팅 우회 해결 (인터페이스 타입 가드 적용)
  - [x] `mongo.ts` 내 `createIdx` 매개변수 타입 엄격화 (`any` ➡️ `Document`/`object`)
  - [x] `catch` 구절의 `any` 에러 인스턴스 타입 검사 도입 (`err: unknown`)

---

## 🚀 후속 검증 계획
- [ ] 사이트 변환 검증 테스트 실행 (`npm run test:sites`)
- [ ] 전체 빌드 호환성 테스트 (`tsc --noEmit` 등 검증)
