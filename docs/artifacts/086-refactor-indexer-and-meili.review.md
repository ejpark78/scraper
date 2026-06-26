# 📊 [Review] 인덱서 워커 및 Meilisearch 어댑터 2차 리팩터링 검토서

본 문서는 인덱서 워커 및 Meilisearch 타입 보강 작업의 변경 전/후 상태를 대조 검토합니다.

---

## 🔍 변경 대조표

| 파일 경로 | 변경 전 | 변경 후 | 개선 목적 |
| :--- | :--- | :--- | :--- |
| `apps/crawler/src/workers/IndexerWorker.ts` | process.env 하드코딩, SIGINT/SIGTERM 무시, `any` 에러 catch | AppConfig.REDIS_URL 연동, shutdown 헬퍼 등록, `unknown` 타입 가드 에러 처리 | 자원 누수 차단 및 Strict Typing 준수 |
| `apps/crawler/src/database/meili.ts` | `request<T = any>`, `documents: any[]`, `search<T = any>` 및 `options: any` | `request<T = unknown>`, `documents: Record<string, unknown>[]`, `search<T = unknown>` 및 `options: Record<string, unknown>` | `any` 제거를 통한 정적 분석 및 안전성 복구 |

---

## 🛠️ 검증 대상 테스트
- `npx tsc --noEmit --project tsconfig.json` 실행을 통해 컴파일 에러 유무를 최종 점검합니다.
