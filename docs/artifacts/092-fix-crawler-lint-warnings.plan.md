# 092-fix-crawler-lint-warnings.plan.md

이 계획서는 `apps/crawler` 내부의 eslint 실행 시 발생하는 278개의 경고(warning)를 체계적으로 정리하여 ESLint 검사를 0 Warning 상태로 만드는 것을 목표로 합니다.

## 1. 🔍 경고의 주요 유형 분석 및 해결 전략

### A. `@typescript-eslint/no-explicit-any` (대다수 점유)
- **원인**: 타입을 구체적으로 정의하지 않고 임시로 `any`를 광범위하게 사용함.
- **해결**: 
  - 외부 API 응답 데이터나 MongoDB 도큐먼트처럼 불가피하게 가변적인 객체는 `Record<string, unknown>` 또는 전용 인터페이스(예: `UnknownRecord`, `ScrapedMetadata` 등)를 정의해 `any`를 안전한 타입으로 대체합니다.
  - 테스트 및 목(Mock) 객체 파일 등에서는 필요 시 특정 라인에만 `/* eslint-disable-next-line @typescript-eslint/no-explicit-any */` 주석을 한정 적용하여 린터를 통과시킵니다.

### B. `@typescript-eslint/no-unused-vars` (미사용 변수)
- **원인**: 함수 매개변수나 선언한 변수를 본문에서 참조하지 않음.
- **해결**:
  - 미사용 변수를 코드에서 안전하게 제거합니다.
  - 인터페이스 오버라이딩이나 시그니처 유지를 위해 불가피하게 남겨두어야 하는 매개변수는 이름 앞에 언더스코어(`_`) 접두사(예: `_redisInstance`, `_options`)를 붙여 린터가 예외 처리하도록 조치합니다.

### C. `prefer-const` (상수 선언 권장)
- **원인**: 재할당되지 않는 변수를 `let`으로 선언함.
- **해결**: 
  - 재할당이 필요 없는 `let` 선언 변수들을 일괄 `const`로 변경합니다.

---

## 2. 🛠️ 작업 파일 목록
경고가 집중된 주요 파일들을 점진적으로 나누어 일괄 교정합니다:
1. `apps/crawler/src/utils/Logger.ts` 및 공통 유틸
2. `apps/crawler/src/workers/ScraperWorker.ts` & `ConverterWorker.ts`
3. `apps/crawler/src/sites/*/Contents.ts` & `Converter.ts` & `List.ts`
4. `apps/crawler/tests/**/*.test.ts`

---

## 🏁 검증 계획
- `apps/crawler/scripts/test.sh`를 실행하여 `eslint` 0 Warning 및 TypeScript 컴파일 성공을 최종 확인합니다.
