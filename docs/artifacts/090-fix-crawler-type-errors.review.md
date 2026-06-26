# 090-fix-crawler-type-errors.review.md

이 문서는 `apps/crawler` 내의 TypeScript 타입 에러 및 컴파일 오류 변경 대비표를 기록한 리뷰서입니다.

## 🎯 Bugfix

이 작업은 TypeScript 6.0 컴파일러 사양 및 strict 컴파일러 점검을 도입함에 따라 발생한 여러 컴파일 버그들을 일괄 교정하는 **Bugfix** 성격의 마이너 패치입니다.

## 📊 변경 전/후 대비 검토서

| 대상 파일 | 변경 전 상태 | 변경 후 전략 |
| :--- | :--- | :--- |
| `src/scripts/diff_debug.ts` | 잘못된 상대 경로 모듈 임포트 (`../crawler/...`) | 올바른 내부 상대 경로 (`./...`)로 수정 |
| `src/scripts/extract_article.ts` | `unknown` 타입에 대한 direct 속성 접근 | `as any` 또는 명확한 캐스팅 단언 처리 |
| `src/workers/ConverterWorker.ts` | MongoDB/Redis 조회 레코드의 `unknown` 타입 | `as any` 혹은 레코드 인터페이스 캐스팅 |
| `src/sites/*/Contents.ts` | 유틸리티 모듈 (`imageDownloader`, `BasePipeline` 등) 경로 오류 | 올바른 프로젝트 상대경로 또는 tsconfig paths 정의 수정 |
| `src/sites/linkedin/jobs/Converter.ts` | 글로벌 네임스페이스 및 타입 누락 | 명시적 import 구문 또는 타입 단언 추가 |
| `tests/sites/**/*.test.ts` | Cheerio v1 네임스페이스(`cheerio.Element`) 참조 오류 | `import { Element } from 'domhandler'` 등 호환 타입으로 교체 |
| `tsconfig.json` | `baseUrl` 경고 발생 | `ignoreDeprecations` 추가 (완료) |
