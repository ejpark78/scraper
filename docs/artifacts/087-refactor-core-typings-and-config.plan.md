# 📝 [Plan] 코어 모듈 타입 복구 및 뷰어 설정 통합 계획서 (3차)

본 계획서는 1차 리팩터링에서의 `any` 개선 타겟 범위와 비타겟 범위에 대한 사실관계를 정립하고, 크롤러의 중추 역할을 하는 핵심 Core 모듈(`BasePipeline`, `SiteRegistry` 등)에 잔존해 있는 `any` 타입을 일괄 정비하여 완벽한 Strict Typing을 실현하기 위한 구체적인 이행 방안을 기술합니다.

---

## 🔍 1. "any 타입이 또 나온 원인" 상세 해명

* **1차 리팩터링 범위**: `ConverterWorker.ts`, `mongo.ts` 및 개별 사이트 `Converter`에 국한되었습니다.
* **미해결 영역 (누락이 아닌 당시 타겟 외 영역)**:
  * 크롤러 동작의 근간인 `BasePipeline`, `BaseListService`, `SiteRegistry` 등 핵심 기반 모듈과 다수의 보조 스크립트에는 여전히 `any`가 존재합니다.
  * 특히 `SiteRegistry.ts`의 메타데이터 인터페이스에 `any`가 쓰이면서, 이를 구현하는 개별 사이트 설정 파일들 전체로 `any` 타입이 전파되는 구조적 안티패턴이 유지되고 있었습니다.

따라서 3차 리팩터링을 통해 **크롤러 공통 코어 모듈**의 `any` 타입을 완전히 제거하고, 앞서 기획한 **뷰어 익스포터 설정 및 타입 개선** 작업을 통합 수행합니다.

---

## 📅 2. 3차 작업 범위 및 대상 파일

1. **크롤러 코어 모듈의 Strict Typing 적용**
   - 대상:
     - [apps/crawler/src/core/SiteRegistry.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/core/SiteRegistry.ts)
     - [apps/crawler/src/core/BasePipeline.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/core/BasePipeline.ts)
   - 작업: 
     - `SiteRegistry` 내 `options?: any`, `meta: any` 등을 구체적 타입(제네릭 또는 `Record<string, unknown>`)으로 정밀 전환.
     - `BasePipeline` 내 `redisInstance?: any`, `jobIds: any[]` 등의 레거시 `any`를 `Redis | null`, `string[]` 등으로 타입 상향.

2. **뷰어 Joplin 설정 중앙화 및 익스포터 정적 바인딩**
   - 대상:
     - [apps/viewer/src/config/AppConfig.ts](file:///Users/ejpark/workspace/scraper/apps/viewer/src/config/AppConfig.ts)
     - [apps/viewer/src/exporter/export/joplin.ts](file:///Users/ejpark/workspace/scraper/apps/viewer/src/exporter/export/joplin.ts)
   - 작업: `JOPLIN_API_URL` 환경 변수 통합 및 `let bookFolder;` 암묵적 any 선언부 명시적 타입 부여.

---

## 🛠️ 3. 상세 구현 설계

### SiteRegistry.ts 핵심 타입 개선안
```typescript
export interface SiteDescription<TListMeta = Record<string, unknown>, TMeta = Record<string, unknown>> {
    key: string;
    domain?: string;
    // ...
    scraper?: {
        generateUrls?: (config: Record<string, unknown>, options?: Record<string, unknown>) => string[];
        // ...
    };
    targetLoader?: {
        buildDocument: (id: string, meta: TMeta) => Record<string, unknown>;
        // ...
    };
}
```

---

## 📈 4. 검증 계획

- **빌드 테스트**: `apps/crawler` 및 `apps/viewer` 프로젝트의 컴파일 성공 여부 진단 (`npx tsc --noEmit --project tsconfig.json` 각각 실행)
