# 📊 [Review] 코어 모듈 타입 복구 및 뷰어 설정 통합 검토서 (3차)

본 문서는 크롤러 코어 모듈의 타입 개선 및 뷰어 설정 중앙화 작업의 변경 전/후 상태를 대조 검토합니다.

---

## 🔍 변경 대조표

| 파일 경로 | 변경 전 | 변경 후 | 개선 목적 |
| :--- | :--- | :--- | :--- |
| `apps/crawler/src/core/SiteRegistry.ts` | `fields: Record<string, any>`, `options?: any`, `generateUrls?: (config: any, options?: any)`, `IConverter<any>` 등 다량의 `any` 방치 | `fields: Record<string, unknown>`, `options?: object`, `generateUrls?: (config: Record<string, unknown>, ...)`, `IConverter<unknown>` | 코어 타입 엄격화 및 any 전파 차단 |
| `apps/crawler/src/core/BasePipeline.ts` | `redisInstance?: any` 매개변수 및 `let redis: any = null` 내부 변수 any 선언 | `redisInstance?: Redis | null`, `let redis: Redis | null = null` 로 명확한 정적 바인딩 | ioredis 타입 보장 및 컴파일러 안전성 복구 |
| `apps/viewer/src/config/AppConfig.ts` | `JOPLIN_API_URL` 환경 변수 관리 누락 | `AppConfig.JOPLIN_API_URL` 상수를 새로 추가하여 중앙 제어 | 환경 설정 통합 관리 |
| `apps/viewer/src/exporter/export/joplin.ts` | process.env 하드코딩 참조, `let bookFolder` 암묵적 any 지정 | `AppConfig.JOPLIN_API_URL` 호출 변경, `let bookFolder: { id: string }` 명시적 바인딩 | 하드코딩 제거 및 strict typing 보강 |

---

## 🛠️ 검증 대상 테스트
- `npx tsc --noEmit`을 통해 크롤러와 뷰어 패키지가 타입 에러 없이 성공적으로 컴파일되는지 점검합니다.
