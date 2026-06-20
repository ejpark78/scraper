# 043-change-publishedat-to-date.task.md

본 문서는 `publishedAt` 필드 마이그레이션 작업을 수행하기 위한 세부 태스크 리스트입니다.

---

## Task List

- [ ] **1단계: 날짜 안전 파싱 헬퍼 작성**
  - [ ] `apps/crawler/src/utils/DateUtils.ts` (또는 유틸)에 입력받은 다양한 문자열을 감지하여 안전하게 `Date` 객체 또는 `null`을 반환하는 함수 작성.

- [ ] **2단계: 크롤러 공통/개별 타입 수정**
  - [ ] `apps/crawler/src/sites/*/site.config.ts` 파일들에서 `publishedAt` 속성의 타입을 `Date | null`로 변경.

- [ ] **3단계: 크롤러별 Converter 코드 수정**
  - [ ] `apps/crawler/src/sites/*/Converter.ts` 파일에서 정제 결과를 파싱하여 `Date` 객체로 주입하게 수정.
  - [ ] `apps/crawler/src/workers/ConverterWorker.ts` 등에서 정상 변환 처리 확인.

- [ ] **4단계: 백엔드 API 수정**
  - [ ] `apps/viewer/src/api/server.ts`의 일별 통계 API에서 `$dateFromString` 변환 로직 제거하고 직접 `Date` 대소 비교 쿼리(`$gte`, `$lte`)로 롤백.

- [ ] **5단계: 수동 마이그레이션 실행 요청**
  - [ ] 기존 데이터의 `publishedAt` 문자열을 `Date` 객체로 바꾸는 MongoDB Aggregation / Update 스크립트 작성 및 사용자 가이드 제공.

- [ ] **6단계: 컨테이너 재빌드 및 최종 동작 검증**
  - [ ] viewer 서비스 재시작 후 정상 동작 확인.
