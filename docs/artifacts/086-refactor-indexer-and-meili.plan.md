# 📝 [Plan] 인덱서 워커 및 Meilisearch 어댑터 2차 리팩터링 계획서

본 계획서는 식별된 2차 안티패턴인 `IndexerWorker`의 자원 회수(Graceful Shutdown) 도입, 환경 변수 통합 및 `MeilisearchDatabase` 내의 `any` 타입 지정을 개선하기 위한 세부 로드맵을 정의합니다.

---

## 📅 1. 작업 범위 및 대상 파일

1. **`IndexerWorker` 안정성 확보**
   - 대상: [apps/crawler/src/workers/IndexerWorker.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/workers/IndexerWorker.ts)
   - 작업:
     - `REDIS_URL`을 `AppConfig.REDIS_URL`로 결합.
     - `SIGINT`, `SIGTERM` 이벤트 리스너를 구현하여 프로세스 퇴장 시 MongoDB 및 Redis 커넥션 해제 보장.
     - 예외 처리 구절의 `any` 타입을 `unknown`으로 변경.

2. **`MeilisearchDatabase` 타입 엄격화**
   - 대상: [apps/crawler/src/database/meili.ts](file:///Users/ejpark/workspace/scraper/apps/crawler/src/database/meili.ts)
   - 작업:
     - `request<T = unknown>(..., body?: unknown)` 으로 제네릭 및 매개변수 타입 제한.
     - `addDocuments(..., documents: Record<string, unknown>[])`으로 타입 사양 상향.
     - `search<T = unknown>(..., options: Record<string, unknown> = {})`으로 `any` 완전 소멸.

---

## 🛠️ 2. 상세 구현 설계

### A. `MeilisearchDatabase` 타입 치환 (예시)
```typescript
export class MeiliSearchDatabase {
    // ...
    private async request<T = unknown>(path: string, method: string = 'GET', body?: unknown): Promise<T> {
        // ...
    }

    public async addDocuments(indexName: string, documents: Record<string, unknown>[]): Promise<void> {
        // ...
    }

    public async search<T = unknown>(
        indexName: string,
        query: string,
        options: Record<string, unknown> = {}
    ): Promise<{
        hits: T[];
        offset: number;
        limit: number;
        estimatedTotalHits: number;
        processingTimeMs: number;
        query: string;
    }> {
        // ...
    }
}
```

---

## 📈 3. 검증 계획

- **빌드 검증**: `apps/crawler` 디렉토리 빌드 테스트를 실행하여 컴파일 에러 유무 확인 (`npx tsc --noEmit --project tsconfig.json`)
- **단위 테스트**: 기존 단위 테스트 재수행을 통한 정합성 검증 (`npm run test:sites`)
