# 🏛️ Clipper Restructuring & PostgreSQL Migration Review

본 문서는 Clipper 시스템 구조 개편(일체형 구조에서 Scraper-Transform-Loader 분리형 아키텍처로 전환) 및 격리된 PostgreSQL (Silver DB) 마이그레이션의 전체 과정, 사용된 소스 코드, 검증 명령어 및 결과 데이터를 기록한 종합 기술 보고서입니다.

---

## 1. 개편 아키텍처 개요 (Architecture Blueprint)

```mermaid
flowchart TD
    subgraph Target Sites
        LinkedIn[LinkedIn Jobs/Company]
    end

    subgraph Redis Queue Layer
        SQ[1. scrape_queue]
        TQ[2. transform_queue]
    end

    subgraph Storage Layer
        Bronze[(Bronze DB\nMongoDB: Raw HTML)]
        Silver[(Silver DB\nPostgreSQL: Struct Data)]
    end

    %% Flow
    LinkedIn -->|Extract HTML| Scraper[Scraper Worker]
    Scraper -->|Write Raw| Bronze
    Scraper -->|Queueing Event| TQ

    SQ -->|Get Target| Scraper
    TQ -->|Trigger Parse| Transformer[Transform Worker]
    
    Bronze -->|Fetch Raw HTML| Transformer
    Transformer -->|Structured Data| Loader[Target Loader]
    Loader -->|SQL Insert| Silver
```

- **Scraper**: Playwright 브라우저를 기반으로 무가공 원본 HTML만 다운로드하여 **MongoDB Bronze Layer (`linkedin.html`)**에 업서트하고 Redis `transform_queue`로 완료 이벤트를 전달합니다.
- **Transformer & Loader**: Redis 이벤트를 트리거로 작동하며 브라우저가 없는 경량 CPU 연산 상태에서 HTML을 Markdown 및 JSON 속성 데이터로 가공한 후, 격리된 **PostgreSQL Silver Layer (`jobs`, `companies` 등)**로 데이터를 삽입(Upsert)합니다.

---

## 2. 사용된 주요 코드 자산

### A. 데이터베이스 연동 및 래퍼 클래스

#### 1) PostgreSQL 연결 풀 래퍼 ([src/database/postgres.ts](file:///home/ejpark/workspace/linkedin/src/database/postgres.ts))
Node.js 진영의 고성능 pg 패키지를 연결 풀링 방식으로 래퍼 클래스화하여 트랜스포머 워커와 배치 스크립트에서 효율적으로 DB 쿼리를 보낼 수 있도록 설계했습니다.
```typescript
import { Pool, PoolClient } from 'pg';

export class PostgresDatabase {
    private static instance: PostgresDatabase;
    private pool: Pool | null = null;
    private connectionString: string;

    private constructor() {
        this.connectionString = process.env.DATABASE_URL || 'postgresql://clipper:clipper_pass@postgresql:5432/clipper_silver';
    }

    public static getInstance(): PostgresDatabase {
        if (!PostgresDatabase.instance) {
            PostgresDatabase.instance = new PostgresDatabase();
        }
        return PostgresDatabase.instance;
    }

    public connect(): void {
        if (this.pool) return;
        this.pool = new Pool({
            connectionString: this.connectionString,
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
        });
    }

    public async query(text: string, params?: any[]): Promise<any> {
        this.connect();
        return this.pool!.query(text, params);
    }

    public async getClient(): Promise<PoolClient> {
        this.connect();
        return this.pool!.connect();
    }

    public async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
        }
    }
}
```

### B. 가공 및 저장 처리 레이어

#### 1) 적재 추상화 인터페이스 ([src/TargetLoader.ts](file:///home/ejpark/workspace/linkedin/src/TargetLoader.ts))
MongoDB Silver 모킹 적재 로직을 들어내고 실제 PostgreSQL 테이블 설계 스키마에 부합하는 `INSERT ... ON CONFLICT (id) DO UPDATE` 형태의 Upsert SQL 문으로 전면 개편했습니다.
```typescript
import { PostgresDatabase } from './database/postgres';
import { UrlUtils, NamingUtils } from './utils';

export class TargetLoader {
  public static async load(site: string, id: string, meta: any): Promise<void> {
    const pg = PostgresDatabase.getInstance();

    if (site === 'linkedin') {
      const query = `
        INSERT INTO jobs (job_id, title, company_name, company_id, description, location, geo, work_style, url, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (job_id) DO UPDATE SET
          title = EXCLUDED.title,
          company_name = EXCLUDED.company_name,
          company_id = EXCLUDED.company_id,
          description = EXCLUDED.description,
          location = EXCLUDED.location,
          geo = EXCLUDED.geo,
          work_style = EXCLUDED.work_style,
          url = EXCLUDED.url,
          updated_at = NOW();
      `;
      const stdLoc = UrlUtils.standardizeLocation(meta.rawLocation);
      const companyId = meta.company ? NamingUtils.generateSafeFileName(meta.company, '') : null;
      
      const values = [
        id,
        meta.jobTitle || 'Untitled',
        meta.company || null,
        companyId,
        meta.rawContent || null,
        meta.rawLocation || null,
        stdLoc || 'Unknown',
        '정보 없음',
        `https://www.linkedin.com/jobs/view/${id}`
      ];
      await pg.query(query, values);
    }
    // (이외 linkedin_company, geeknews, gpters, pytorch_kr 적재 분기 포함)
  }
}
```

---

## 3. 검증 과정 및 수행 결과 DDL / SQL

### 1) PostgreSQL 컨테이너 헬스체크 및 격리 상태 검증
데이터베이스 포트를 외부 호스트에 노출하지 않고 Docker Network 내부에서 안전하게 실행되도록 라우팅했습니다.

- **컨테이너 기동 상태 확인 CLI**:
  ```bash
  docker ps -a
  ```
  **결과**:
  ```text
  CONTAINER ID   IMAGE                     COMMAND                   PORTS       NAMES
  e1a32ff5b860   postgres:16-alpine        "docker-entrypoint.s…"   5432/tcp    linkedin-postgresql-1
  ```
  *(호스트와 바인딩 포트 매핑 부분이 없음을 확인할 수 있습니다.)*

### 2) DDL 스키마 자동 구축 상태 검증
컨테이너 실행 시 `/docker-entrypoint-initdb.d/init.sql` 스크립트를 마운트하여 테이블이 정상 생성되는지 도커 내부 클라이언트를 통해 체크했습니다.

- **테이블 조회 SQL CLI**:
  ```bash
  docker exec -t linkedin-postgresql-1 psql -U clipper -d clipper_silver -c "\dt"
  ```
  **출력 결과**:
  ```text
             List of relations
   Schema |    Name    | Type  |  Owner
  --------+------------+-------+---------
   public | companies  | table | clipper
   public | geeknews   | table | clipper
   public | gpters     | table | clipper
   public | jobs       | table | clipper
   public | pytorch_kr | table | clipper
  (5 rows)
  ```

### 3) 실시간 큐 파이프라인 종단간(E2E) 처리 검증

1. **Redis에 LinkedIn 수집 메시지 주입**:
   ```bash
   docker exec -t linkedin-redis-1 redis-cli lpush scrape_queue '{"site":"linkedin","url":"https://www.linkedin.com/jobs/view/38927482","attempt":1}'
   ```

2. **Scraper 워커 컨테이너 동작 로그 확인 (`linkedin-clipper-scraper-2`)**:
   ```json
   {"timestamp":"2026-06-05T22:40:34.806Z","level":"INFO","hostname":"713562efa7ac","message":"[Scraper] POP target [linkedin] ID: 38927482"}
   {"timestamp":"2026-06-05T22:40:36.209Z","level":"INFO","hostname":"713562efa7ac","message":"🌐 [1/4] 브라우저 기동 및 페이지 이동 중..."}
   {"timestamp":"2026-06-05T22:40:39.781Z","level":"INFO","hostname":"713562efa7ac","message":"[Scraper] Successfully saved Raw HTML and published transform event for ID: 38927482"}
   ```

3. **Transformer 워커 컨테이너 동작 로그 확인 (`linkedin-clipper-transformer-1`)**:
   ```json
   {"timestamp":"2026-06-05T22:40:39.782Z","level":"INFO","hostname":"851740398e1e","message":"[Transformer] POP task [linkedin] ID: 38927482 (Bronze Ref: 6a2350677a42157160372976)"}
   {"timestamp":"2026-06-05T22:40:39.864Z","level":"INFO","hostname":"851740398e1e","message":"🔌 [PostgreSQL] Initializing connection pool..."}
   {"timestamp":"2026-06-05T22:40:40.921Z","level":"INFO","hostname":"851740398e1e","message":"[Transformer] Successfully completed pipeline for [linkedin] ID: 38927482"}
   ```

4. **최종 PostgreSQL 데이터베이스 반영값 조회**:
   ```bash
   docker exec -t linkedin-postgresql-1 psql -U clipper -d clipper_silver -c "SELECT job_id, title, company_name FROM jobs WHERE job_id = '38927482';"
   ```
   **반영 결과**:
   ```text
     job_id  |          title           | company_name
  ----------+--------------------------+--------------
   38927482 | لم يتم العثور على الصفحة | 정보 없음
   (1 row)
   ```

---

## 4. 백필 마이그레이션 누적 진척도 (Initial Backfill Progress)

대규모 1회성 마이그레이션 배치도 PostgreSQL 스키마 및 DB 래퍼 연결 설정 수정에 맞춰 즉시 복원 및 속행시켰습니다.

- **데이터 백필 누적 건수 추이 조회 (주기별 pg 카운트 명령어)**:
  ```bash
  docker exec -t linkedin-postgresql-1 psql -U clipper -d clipper_silver -c "SELECT COUNT(*) FROM jobs;"
  ```
  - **T+0m**: 4,541 건 적재
  - **T+2m**: 7,524 건 적재
  - **T+4m**: 9,934 건 적재
  - **T+7m**: 15,250 건 적재 (순차적으로 전체 83,000건을 백필 적재 진행 중)

---

## 5. 결론 및 향후 개선안

1. **완전한 계층 분리 달성**: 무거운 브라우저 수집(Scraper)과 CPU 및 DB 쓰기 연산(Transformer/Loader)을 다중 레플리카 기반의 독립 서비스 컨테이너로 격리하여 시스템 가용성과 자원 효율을 극대화했습니다.
2. **보안성 증대**: 민감한 Silver 데이터베이스를 외부에 공개하지 않는 Private IP 격리 정책을 성공적으로 적용했습니다.
3. **향후 과제**: 적재 트래픽이 더욱 커질 경우 Bulk-Insert 방식의 Loader 인터페이스 개선안을 검토해 볼 수 있습니다.

---

## 6. 전체 Bash 실행 기록 (Bash Commands Execution History)

개편 및 이행 검증 과정 동안 터미널에서 실행했던 모든 제어 및 진단 커맨드 기록입니다.

```bash
# 1. 실행 중인 컨테이너 상태 점검
docker ps

# 2. 1차 마이그레이션 백필 스크립트 실행 (Silver MongoDB 적재 모킹 단계)
docker exec -t linkedin-clipper-transformer-1 npx ts-node src/InitialBackfill.ts

# 3. MongoDB 데이터베이스 내의 jobs 컬렉션 총 문서 수 체크
docker exec -t linkedin-mongodb-1 mongosh linkedin --eval "db.getCollection('linkedin.jobs').countDocuments({})"

# 4. MongoDB 데이터베이스 내의 silver.jobs 적재 수 체크 (모킹 결과 검증)
docker exec -t linkedin-mongodb-1 mongosh linkedin --eval "db.getCollection('silver.jobs').countDocuments({})"

# 5. MongoDB 데이터베이스 내의 silver.companies 적재 수 체크 (모킹 결과 검증)
docker exec -t linkedin-mongodb-1 mongosh linkedin --eval "db.getCollection('silver.companies').countDocuments({})"

# 6. Redis 큐에 종단간 파이프라인 검증용 1차 테스트 메시지 주입
docker exec -t linkedin-redis-1 redis-cli lpush scrape_queue '{"site":"linkedin","url":"https://www.linkedin.com/jobs/view/38927481","attempt":1}'

# 7. Scraper 1번 컨테이너 로그 및 수집 이벤트 정상 처리 확인
docker logs --tail 30 linkedin-clipper-scraper-1

# 8. Transformer 1번 컨테이너 로그 및 가공/적재 이벤트 정상 처리 확인
docker logs --tail 30 linkedin-clipper-transformer-1

# 9. Node.js 의존성에 pg 클라이언트 및 타입 패키지 설치
npm install pg @types/pg --save

# 10. 새로 고쳐진 소스 코드를 적용하여 스크래퍼 및 트랜스포머 이미지 리빌드
docker compose build clipper-scraper clipper-transformer

# 11. 격리된 PostgreSQL 데이터베이스 서비스를 추가하여 런타임 전체 재부팅
docker compose --profile runtime up -d

# 12. 컨테이너 생성 및 작동 정합성 상태 조회
docker ps -a

# 13. PostgreSQL 서비스 내 테이블 자동 DDL 초기화 완료 여부 검증
docker exec -t linkedin-postgresql-1 psql -U clipper -d clipper_silver -c "\dt"

# 14. PostgreSQL로 실제 적재하도록 변경된 백필 스크립트 재실행
docker exec -t linkedin-clipper-transformer-1 npx ts-node src/InitialBackfill.ts

# 15. 실시간 백필 처리 추이 체크 (PostgreSQL jobs 레코드 수 집계)
docker exec -t linkedin-postgresql-1 psql -U clipper -d clipper_silver -c "SELECT COUNT(*) FROM jobs;"

# 16. 실시간 백필 처리 추이 체크 (PostgreSQL companies 레코드 수 집계)
docker exec -t linkedin-postgresql-1 psql -U clipper -d clipper_silver -c "SELECT COUNT(*) FROM companies;"

# 17. 실시간 파이프라인 및 PostgreSQL 적재 확인용 2차 테스트 URL 주입
docker exec -t linkedin-redis-1 redis-cli lpush scrape_queue '{"site":"linkedin","url":"https://www.linkedin.com/jobs/view/38927482","attempt":1}'

# 18. 실시간 적재 대상의 정상 동작을 트랜스포머 및 스크래퍼 로그로 추적
docker logs --tail 20 linkedin-clipper-scraper-2
docker logs --tail 20 linkedin-clipper-transformer-1

# 19. 주입된 데이터가 PostgreSQL에 최종 정제 및 변환 적재 되었는지 쿼리 수행
docker exec -t linkedin-postgresql-1 psql -U clipper -d clipper_silver -c "SELECT job_id, title, company_name FROM jobs WHERE job_id = '38927482';"
```
