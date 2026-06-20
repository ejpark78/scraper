# 📋 Plan: Add Daily Crawl Statistics Dashboard & Rich Diagnostic MCP Tools

이 계획은 뷰어 대시보드 및 MCP(Model Context Protocol) 서버에 **날짜 범위별 수집 현황판 (Crawl Volume in Range)** 기능(Major)을 구현하고, 코딩 에이전트의 로컬 데이터베이스(MongoDB, Meilisearch, Redis) 진단 편의성을 극대화하기 위해 **범용 DB 진단 MCP 도구군**을 추가하기 위한 아키텍처 확장 계획입니다.

## 1. 아키텍처 및 디자인 설계

### 백엔드 (Express API & MongoDB)
- **엔드포인트**: `GET /api/site-stats/search`
- **쿼리 파라미터**: 
  - `startDate`: 조회 시작 날짜 (포맷: `YYYY-MM-DD`, 필수)
  - `endDate`: 조회 종료 날짜 (포맷: `YYYY-MM-DD`, 필수)
- **집계 방식**: MongoDB의 `silver` 데이터베이스에서 각 사이트별 실버 컬렉션을 돌며 `collectedAt` 날짜 필드를 한국 표준시(KST, `Asia/Seoul` 타임존) 기준 `YYYY-MM-DD` 포맷으로 `$group` 집계하여 반환합니다.

### MCP (Model Context Protocol) 도구 추가
- **`get_crawl_stats_in_range`**: 날짜 범위(`startDate`, `endDate`)를 인자로 받아 사이트별/날짜별 수집 현황 마크다운 리포트를 반환합니다.
- **`run_mongo_query`**:
  - 인자: `dbName` (database명, 기본 'silver'), `collection` (컬렉션명), `query` (JSON 객체 문자열), `projection` (선택, JSON 객체 문자열), `limit` (선택, 기본 10)
  - 역할: MongoDB에 질의를 직접 수행하여 결과를 반환합니다.
- **`run_meili_query`**:
  - 인자: `index` (인덱스명), `query` (검색어), `options` (선택, Meilisearch 검색 옵션 JSON 객체 문자열)
  - 역할: Meilisearch 인덱스 조회를 수행합니다.
- **`run_redis_query`**:
  - 인자: `command` (실행할 명령어: 'KEYS', 'GET', 'LLEN', 'LRANGE', 'SMEMBERS' 등), `key` (대상 키), `args` (선택, 추가 인자 배열)
  - 역할: Redis 캐시 및 큐 상태를 직접 쿼리합니다.

### 프론트엔드 (Vue/CSS Dashboard)
- **컴포넌트**: `apps/viewer/src/frontend/src/views/DashboardView.vue`
- **동적 질의**: 기본적으로 최근 일주일(예: 오늘 - 6일부터 오늘까지) 범위의 통계 데이터를 조회하여 컴포넌트에 시각화하고, 사용자가 날짜 범위를 동적으로 조절(일주일 단위로 이동 등)하여 조회할 수 있는 UI를 탑재합니다.
- **Pure CSS Bar Chart**: 외부 차트 라이브러리 추가 없이, CSS 변수와 Vue 바인딩을 이용해 동적으로 높이가 조절되는 Stacked Bar Chart를 구현합니다. (HSL 테마 색상, 마우스 호버 시 툴팁 팝업, 부드러운 애니메이션 적용)

---

## 2. 작업 계획

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/viewer/src/api/server.ts` | Modify | `GET /api/site-stats/search` API 추가 (startDate, endDate 파라미터 질의 및 MongoDB 집계) |
| `apps/viewer/src/mcp/mcp.ts` | Modify | 신규 4종 MCP 도구 (`get_crawl_stats_in_range`, `run_mongo_query`, `run_meili_query`, `run_redis_query`)를 `ListTools` 및 `CallTool` 핸들러에 신규 등록 |
| `apps/viewer/src/frontend/src/views/DashboardView.vue` | Modify | 날짜별 통계 로드, 날짜 선택 인터페이스 및 CSS 차트 UI 컴포넌트 추가 |

---

## 3. 변경 예정 코드 상세

### MCP 도구 등록 예시 (`apps/viewer/src/mcp/mcp.ts`)
```typescript
// ListTools에 추가될 도구 정의들
[
  {
    name: 'get_crawl_stats_in_range',
    description: 'Retrieve daily crawl document counts for all scraper sites over a specific date range',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' }
      },
      required: ['startDate', 'endDate']
    }
  },
  {
    name: 'run_mongo_query',
    description: 'Execute a read-only query on MongoDB',
    inputSchema: {
      type: 'object',
      properties: {
        dbName: { type: 'string', description: 'Database name (e.g. silver, bronze)' },
        collection: { type: 'string', description: 'Collection name' },
        query: { type: 'string', description: 'JSON string of the query filter' },
        projection: { type: 'string', description: 'JSON string of fields to include/exclude' },
        limit: { type: 'number', description: 'Limit results (default 10)' }
      },
      required: ['collection', 'query']
    }
  }
]
```
*(자세한 수집 통계 계산 로직은 server.ts 와 공유되거나 MongoDatabase/MeiliSearchDatabase/Redis 모듈을 사용해 구현됩니다.)*
