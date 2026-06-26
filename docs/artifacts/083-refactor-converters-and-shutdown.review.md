# 📊 [Review] 컨버터 리팩터링 및 Graceful Shutdown 검토서

본 문서는 컨버터 리팩터링 및 Graceful Shutdown 작업의 변경 전/후의 상태를 대조하여 검증합니다.

---

## 🔍 변경 대조표

| 파일 경로 | 변경 전 | 변경 후 | 개선 목적 |
| :--- | :--- | :--- | :--- |
| `apps/crawler/src/core/BaseConverter.ts` | (없음) | 신설 (마크다운 포맷팅 및 Turndown 공통 로직 탑재) | DRY 원칙 실현 및 중복 최소화 |
| `apps/crawler/src/sites/*/Converter.ts` (10개 컨버터) | `implements IConverter<T>`, `prettify`, `prettifyAndSave`, `htmlToMarkdown` 각각 구현 | `extends BaseConverter<T>`, 공통 메소드 제거 및 필요 시 부분 override | 중복 코드 약 90% 제거, 전역 포맷팅 단일화 |
| `apps/crawler/src/workers/ConverterWorker.ts` | process.env 기반 하드코딩, SIGINT/SIGTERM 무시, `any` 캐스팅 다수 | AppConfig 활용, shutdown 리스너 등록, `unknown` 기반 타입 캐스팅 적용 | 자원 누수 원천 차단 및 Strict Typing 준수 |
| `apps/crawler/src/workers/ScraperWorker.ts` | SIGINT/SIGTERM 무시, 하드코딩, `any` 캐스팅 다수 | shutdown 메소드 도입, signal 핸들러 등록, AppConfig 결합 | Graceful Shutdown 체계 완성 |
| `apps/crawler/src/database/mongo.ts` | `createIdx` 매개변수로 `any` 사용 | `spec`에 `Document`, `opts`에 `object` 정적 타입 바인딩 | Strict Typing 가이드라인 준수 |

---

## 🛠️ 검증 대상 테스트
- `npm run test:sites` (in `apps/crawler`) 실행을 통해 각 사이트(`dailydoseofds`, `geeknews`, `maily/josh`, `pytorch_kr`, `yozm`) 컨버터 파싱 결과의 정합성을 검증합니다.
