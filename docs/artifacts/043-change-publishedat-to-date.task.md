# 043-change-publishedat-to-date.task.md

본 문서는 `publishedAt` 필드 마이그레이션 작업을 수행하기 위한 세부 태스크 리스트와 진행 결과 상태입니다.

---

## Task List

- [x] **1단계: 날짜 안전 파싱 헬퍼 작성**
  - [x] `apps/crawler/src/utils/DateUtils.ts`에 입력받은 다양한 문자열을 감지하여 안전하게 `Date` 객체 또는 `null`을 반환하는 `parseSafeDate` 정적 메서드 작성 완료.

- [x] **2단계: 크롤러 공통/개별 타입 수정**
  - [x] `apps/crawler/src/sites/*/site.config.ts` 파일들에서 `publishedAt` 속성의 타입을 `Date | null`로 변경 완료.
    - 대상 사이트: `yozm`, `geeknews`, `gpters` (news), `maily_josh`, `dailydose_ds`, `aicasebook`, `pytorch_kr`, `uppity`

- [x] **3단계: 크롤러별 Converter 코드 수정**
  - [x] `apps/crawler/src/sites/*/Converter.ts` 및 관련 파이프라인(`Contents.ts`, `List.ts` 등)에서 정제 결과를 파싱하여 `Date` 객체로 주입하게 수정 완료.
  - [x] 마크다운 조립 시 `publishedAt.toISOString()`을 렌더링하도록 갱신 완료.

- [x] **4단계: 백엔드 API 수정**
  - [x] `apps/viewer/src/api/server.ts`의 일별 통계 API에서 `$dateFromString` 변환 로직 제거하고 직접 `Date` 대소 비교 쿼리(`$gte`, `$lte`)로 롤백 및 인덱스 조회 최적화 완료.

- [x] **5단계: 수동 마이그레이션 실행**
  - [x] 기존 데이터의 `publishedAt` 문자열을 `Date` 객체로 바꾸는 MongoDB Aggregation 쿼리를 셸을 통해 7만여 건 일괄 변환 완료.

- [x] **6단계: 컨테이너 재빌드 및 최종 동작 검증**
  - [x] `viewer-api`, `viewer-fe`, `viewer-mcp` 서비스를 도커 재빌드하여 신규 수정본 배포 및 가동 확인 완료.
