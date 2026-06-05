# 🏛️ Clipper System Restructuring Plan: Scraper, Transform, Loader

본 문서는 일체형 스크래핑 시스템(`clipper-worker` + MongoDB 단일 아키텍처)을 보편적이고 확장성이 뛰어난 분산 파이프라인 구조인 **Scraper - Transform - Loader (TBD)** 컴포넌트 구조로 전면 개편하고, 데이터베이스 및 큐 레이어를 물리적으로 분리하기 위한 이행 계획서입니다.

> [!IMPORTANT]
> 본 마이그레이션은 시스템을 잠시 중단(Downtime)한 상태에서 안전하고 견고하게 개편을 진행하는 시나리오를 전제로 합니다.

---

## 1. 아키텍처 개요 (Architecture Blueprint)

역할에 따라 독립된 세 개의 컴포넌트와 전용 저장소 레이어로 아키텍처를 세분화합니다.

```mermaid
flowchart TD
    subgraph Target Sites
        LinkedIn[LinkedIn Jobs/Company]
        GeekNews[GeekNews]
        GPTERS[GPTERS]
        PyTorch[PyTorch KR]
    end

    subgraph Redis Queue Layer
        SQ[1. scrape_queue]
        TQ[2. transform_queue]
        DLQ[3. dead_letter_queue]
    end

    subgraph Storage Layer
        Bronze[(Bronze DB\nMongoDB: Raw HTML)]
        Silver[(Silver DB\nPostgreSQL: Struct Data)]
    end

    %% Flow
    Target Sites -->|Extract HTML| Scraper[Scraper Worker]
    Scraper -->|Write Raw| Bronze
    Scraper -->|Queueing Event| TQ

    SQ -->|Get Target| Scraper
    TQ -->|Trigger Parse| Transformer[Transform Worker]
    
    Bronze -->|Fetch Raw HTML| Transformer
    Transformer -->|Structured JSON/MD| Loader[Loader Module]
    Loader -->|Write Clean Data| Silver

    %% Errors
    Scraper -.->|Retry Fail| DLQ
    Transformer -.->|Retry Fail| DLQ
```

---

## 2. 역할 및 컴포넌트 상세

### 1) Scraper (HTML 수집기)
* **주요 역할**: 대상 사이트의 세션을 보존하며 목록/상세 페이지를 크롤링(Playwright)하고, 획득한 **무가공 원본 HTML**을 Bronze DB에 저장합니다.
* **성격**: 브라우저 인스턴스를 띄우는 메모리/네트워크 집약적인 무거운 프로세스입니다.
* **사이트별 분기 로직 (Site-Routing Execution)**:
  - **구현 방식**: 3개의 제한된 워커 컨테이너 환경에서 효율적인 메모리 운용을 위해, 소스 코드 레벨에서는 사이트 통합 엔트리포인트를 구성합니다.
  - **구현 메커니즘**: `ScraperWorker.ts`가 구동 시 고정된 환경 변수 대신 Redis `scrape_queue`에서 수집 태스크 메시지를 꺼내오며, **메시지 내에 포함된 `"site"` 속성 값(예: `"linkedin"`, `"geeknews"`)을 해석하여 런타임에 동적으로 크롤러 서브모듈을 라우팅하여 실행**합니다.
  - 이를 통해 사이트 수만큼 별도의 물리 컨테이너를 구동할 필요가 없어지며, 리소스가 제약된 상황에서 2개의 공통 `scraper` 워커만으로 가변적인 수집 부하를 효율적으로 분담하여 처리합니다.
  - **수집 동적 라우팅 흐름도 (ASCII Art Scraper Routing Flow)**:
    ```text
          [ Container Start / Listening ]
                         |
             (Redis POP scrape_queue)
                         |
                         v
              [ Parse Message Payload ]
           { "site": "...", "url": "..." }
                         |
           +-------------+-------------+
           | (site == "linkedin")      | (site == "geeknews")
           v                           v
     [ Instantiate ]             [ Instantiate ]
     new LinkedInScraper()       new GeekNewsScraper()
           |                           |
           |                           |
           v                           v
     [ Execute Start ]           [ Execute Start ]
     .startScraping(url)         .startScraping(url)
           |                           |
           +-------------+-------------+
                         |
                         v
              [ Save HTML to MongoDB ]
                 - Host: mongodb
                 - DB: clipper
                 - Collection: <site>.html (e.g., linkedin.jobs)
    ```
* **산출물**: `<site>.html` 컬렉션에 적재되는 HTML 문서.

### 2) Transform (데이터 가공기)
* **주요 역할**: Bronze DB에 새로 적재된 Raw HTML을 가져와 파싱(Cheerio/jsdom)하고, Markdown 문서 및 정제된 속성 정보(JSON)로 가공합니다.
* **성격**: 브라우저를 띄우지 않는 고속 CPU 집약적 메모리-프로세스입니다.
* **사이트별 가공 라우팅**: Scraper와 동일하게 `transform_queue` 메시지에 포함된 `site` 지시자를 기반으로 런타임에 동적 Converter/Pipeline 서브클래스를 호출합니다.

### 3) Loader (적재기 / TBD)
* **주요 역할**: 가공 완료된 구조화 데이터를 타겟 데이터베이스(Silver DB) 규격에 맞게 적재합니다.
* **성격**: RDBMS(PostgreSQL), NoSQL(MongoDB), 또는 Elasticsearch 등 타겟 기술셋이 변경되어도 Loader 레이어의 구현체만 교체하도록 추상화 인터페이스를 제공합니다.

---

## 3. 데이터베이스 및 저장 구조 설계

### 1) Bronze DB (Raw MongoDB)
* **역할**: 원본 소스 유실 방지 및 디버깅용 HTML 스토리지.
* **아스키 아트 저장소 구조 관계도 (ASCII Art MongoDB Collections)**:
  ```text
    +-----------------------------------------------------------------------------------------------------------------------------+
    |                                                          Bronze DB                                                          |
    +-----------------------------------------------------------------------------------------------------------------------------+
      [1. Target URLs & Status Tracking]
      +----------------------+      +----------------------+      +----------------------+      +----------------------+
      |  linkedin.job_urls   |      |    geeknews.urls     |      |     gpters.urls      |      |   pytorch_kr.urls    |
      +----------------------+      +----------------------+      +----------------------+      +----------------------+
      | - url (String)       |      | - url (String)       |      | - url (String)       |      | - url (String)       |
      | - status (String)    |      | - status (String)    |      | - status (String)    |      | - status (String)    |
      +----------------------+      +----------------------+      +----------------------+      +----------------------+
                 |                              |                              |                              |
                 | (Scrape)                     | (Scrape)                     | (Scrape)                     | (Scrape)
                 v                              v                              v                              v
      [2. Raw HTML Document Cache]
      +----------------------+      +----------------------+      +----------------------+      +----------------------+
      |    linkedin.jobs     |      |    geeknews.html     |      |     gpters.html      |      |  pytorch_kr.html     |
      +----------------------+      +----------------------+      +----------------------+      +----------------------+
      | - jobId (String)     |      | - topicId (String)   |      | - postId (String)    |      | - topicId (String)   |
      | - rawHtml (String)   |      | - rawHtml (String)   |      | - rawHtml (String)   |      | - rawHtml (String)   |
      +----------------------+      +----------------------+      +----------------------+      +----------------------+
                                                                                
      +----------------------+ 
      |  linkedin.companies  | 
      +----------------------+ 
      | - companyId (String) | 
      | - rawHtml (String)   | 
      +----------------------+ 
  ```
* **사이트별 세부 저장 구조 (MongoDB Collections)**:
  - **LinkedIn 수집 대상 관리 (`linkedin.job_urls` / `linkedin.company_urls`)**
    ```json
    {
      "_id": "ObjectId",
      "jobId": "38927481",
      "url": "https://www.linkedin.com/jobs/view/38927481",
      "geo": "South Korea",
      "status": "completed",       // new, processing, completed, failed
      "pushedToRedis": true,
      "createdAt": "ISODate",
      "updatedAt": "ISODate"
    }
    ```
  - **LinkedIn HTML 원본 백업 (`linkedin.lists` / `linkedin.jobs` / `linkedin.companies`)**
    ```json
    {
      "_id": "ObjectId",
      "jobId": "38927481",         // 혹은 companyId, listPageNumber
      "url": "https://www.linkedin.com/jobs/view/38927481",
      "rawHtml": "<html><body>...Raw LinkedIn Page HTML Content...</body></html>",
      "scrapedAt": "ISODate"
    }
    ```
  - **GeekNews 수집 및 원본 백업 (`geeknews.urls` / `geeknews.html`)**
    ```json
    // geeknews.urls
    {
      "_id": "ObjectId",
      "url": "https://news.hada.io/topic?id=32402",
      "status": "new",
      "createdAt": "ISODate"
    }
    // geeknews.html
    {
      "_id": "ObjectId",
      "topicId": "32402",
      "url": "https://news.hada.io/topic?id=32402",
      "rawHtml": "<html>...GeekNews Raw Topic Page Content...</html>",
      "scrapedAt": "ISODate"
    }
    ```
  - **GPTERS 커뮤니티 수집 및 원본 백업 (`gpters.urls` / `gpters.html`)**
    ```json
    // gpters.urls
    {
      "_id": "ObjectId",
      "url": "https://www.gpters.org/news/post/123",
      "status": "completed"
    }
    // gpters.html
    {
      "_id": "ObjectId",
      "postId": "123",
      "rawHtml": "<html>...GPTERS Article Raw Content...</html>",
      "scrapedAt": "ISODate"
    }
    ```
  - **PyTorch KR 포럼 수집 및 원본 백업 (`pytorch_kr.urls` / `pytorch_kr.html`)**
    ```json
    // pytorch_kr.urls
    {
      "_id": "ObjectId",
      "url": "https://discuss.pytorch.kr/t/topic/456",
      "status": "new"
    }
    // pytorch_kr.html
    {
      "_id": "ObjectId",
      "topicId": "456",
      "rawHtml": "<html>...PyTorch Discussion Forum Thread Raw HTML...</html>",
      "scrapedAt": "ISODate"
    }
    ```

### 2) Silver DB (PostgreSQL / RDBMS)
* **역할**: 서비스 서빙, 분석, API 조회 전용 데이터베이스.
* **아스키 아트 저장소 구조 관계도 (ASCII Art Schema ERD)**:
  ```text
    +----------------------------------+          +----------------------------------+
    |          linkedin_jobs           |          |        linkedin_companies        |
    +----------------------------------+          +----------------------------------+
    | PK | id (VARCHAR)                |          | PK | id (VARCHAR)                |
    |    | title (VARCHAR)             |          |    | name (VARCHAR)              |
    | FK | company_id (VARCHAR)  ------o--------->|    | industry (VARCHAR)          |
    |    | location (VARCHAR)          |          |    | size (VARCHAR)              |
    |    | country_code (VARCHAR)      |          |    | website (VARCHAR)           |
    |    | posted_at (TIMESTAMP)       |          |    | headquarters (VARCHAR)      |
    |    | body_markdown (TEXT)        |          |    | description (TEXT)          |
    |    | created_at/updated_at       |          |    | created_at (TIMESTAMP)      |
    +----------------------------------+          +----------------------------------+

    +----------------------------------+          +----------------------------------+
    |        geeknews_articles         |          |           gpters_posts           |
    +----------------------------------+          +----------------------------------+
    | PK | id (VARCHAR)                |          | PK | id (VARCHAR)                |
    |    | title (VARCHAR)             |          |    | title (VARCHAR)             |
    |    | url (VARCHAR)               |          |    | author (VARCHAR)            |
    |    | author (VARCHAR)            |          |    | view_count (INT)            |
    |    | posted_at (TIMESTAMP)       |          |    | like_count (INT)            |
    |    | comment_count (INT)         |          |    | body_markdown (TEXT)        |
    |    | body_markdown (TEXT)        |          |    | created_at (TIMESTAMP)      |
    |    | created_at (TIMESTAMP)      |          +----------------------------------+
    +----------------------------------+
                                                  +----------------------------------+
                                                  |          pytorch_posts           |
                                                  +----------------------------------+
                                                  | PK | id (VARCHAR)                |
                                                  |    | title (VARCHAR)             |
                                                  |    | category (VARCHAR)          |
                                                  |    | view_count (INT)            |
                                                  |    | reply_count (INT)           |
                                                  |    | body_markdown (TEXT)        |
                                                  |    | created_at (TIMESTAMP)      |
                                                  +----------------------------------+
  ```
* **사이트별 세부 저장 구조 (스키마 정의)**:
  - **LinkedIn Jobs (채용 정보 테이블 `linkedin_jobs`)**
    ```sql
    CREATE TABLE linkedin_jobs (
        id VARCHAR(50) PRIMARY KEY,       -- jobId (예: "38927481")
        title VARCHAR(255) NOT NULL,       -- 공고 제목
        company_id VARCHAR(50),            -- 회사 ID (F.K 관계)
        location VARCHAR(100),             -- 근무 지역 (South Korea 등)
        country_code VARCHAR(10),          -- 국가 코드 분류
        posted_at TIMESTAMP,               -- 공고 등록일자
        body_markdown TEXT NOT NULL,       -- 정제된 마크다운 본문
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );
    ```
  - **LinkedIn Company (회사 상세 테이블 `linkedin_companies`)**
    ```sql
    CREATE TABLE linkedin_companies (
        id VARCHAR(50) PRIMARY KEY,       -- companyId (예: "naver")
        name VARCHAR(255) NOT NULL,        -- 회사명
        industry VARCHAR(150),             -- 업종/산업군
        size VARCHAR(50),                  -- 사원 수 범위 (e.g. 500-1000)
        website VARCHAR(255),              -- 회사 공식 웹사이트 URL
        headquarters VARCHAR(255),         -- 본사 위치
        description TEXT,                  -- 회사 소개 요약 텍스트
        created_at TIMESTAMP DEFAULT NOW()
    );
    ```
  - **GeekNews (IT 뉴스 기사 테이블 `geeknews_articles`)**
    ```sql
    CREATE TABLE geeknews_articles (
        id VARCHAR(50) PRIMARY KEY,       -- topic ID (예: "32402")
        title VARCHAR(255) NOT NULL,       -- 기사 제목
        url VARCHAR(512) NOT NULL,         -- 원본 링크 URL
        author VARCHAR(100),               -- 게시자
        posted_at TIMESTAMP,               -- 등록 시간
        comment_count INT DEFAULT 0,       -- 댓글 수
        body_markdown TEXT,                -- 요약 및 기사 마크다운 본문
        created_at TIMESTAMP DEFAULT NOW()
    );
    ```
  - **GPTERS (커뮤니티 포스트 테이블 `gpters_posts`)**
    ```sql
    CREATE TABLE gpters_posts (
        id VARCHAR(50) PRIMARY KEY,       -- post ID
        title VARCHAR(255) NOT NULL,       -- 글 제목
        author VARCHAR(100),               -- 작성자닉네임
        view_count INT DEFAULT 0,          -- 조회수
        like_count INT DEFAULT 0,          -- 추천/좋아요 수
        body_markdown TEXT NOT NULL,       -- 정제된 본문 마크다운
        created_at TIMESTAMP DEFAULT NOW()
    );
    ```
  - **PyTorch KR (포럼 게시글 테이블 `pytorch_posts`)**
    ```sql
    CREATE TABLE pytorch_posts (
        id VARCHAR(50) PRIMARY KEY,       -- topic ID
        title VARCHAR(255) NOT NULL,       -- 글 제목
        category VARCHAR(100),             -- 카테고리 (e.g. 자유게시판, Q&A)
        view_count INT DEFAULT 0,          -- 조회수
        reply_count INT DEFAULT 0,         -- 댓글 수
        body_markdown TEXT NOT NULL,       -- 정제된 마크다운 본문
        created_at TIMESTAMP DEFAULT NOW()
    );
    ```

---

## 4. Redis Queue & 상태 제어 구조

* **레디스 큐 생명주기 및 처리 흐름도 (ASCII Art Redis Queue Pipeline)**:
  ```text
                                            [ 수집 스케줄러 등록 ]
                                                      |
                                                      v  1. 중복 검사 (SISMEMBER)
                                           +--------------------+
                                           | active_processing  |<------- (이미 존재하면 건너뜀)
                                           |    (Redis Set)     |
                                           +--------------------+
                                                      |
                                                      |  2. 수집 대상 등록 (SADD & LPUSH)
                                                      v
      =================== [수집 파이프라인] ===================   =================== [가공 파이프라인] ===================
      +-----------------------------------------------------+   +-----------------------------------------------------+
      | 1. scrape_queue (Redis List)                        |   | 2. transform_queue (Redis List)                     |
      |    - Payload: { url, site, attempt: 1 }             |   |    - Payload: { site, id, bronze_id }               |
      +-----------------------------------------------------+   +-----------------------------------------------------+
                                 |                                                         |
                                 | (POP) 3. 수집 실행                                      | (POP) 5. 마크다운 변환 및 정제 수행
                                 v                                                         v
                        [ Scraper Worker ]                                       [ Transformer Worker ]
                                 |                                                         |
                   (성공)        v        (실패)                                           v        (실패)
               +-----------------+-----------------+                                       +-----------------+
               |                                   |                                       |                 |
               v                                   v                                       v                 v
        [MongoDB HTML 적재]                 [재시도 3회 미만?]                       [Postgres 적재]   [재시도 3회 미만?]
               |                                   |                                       |                 |
               | 4. 가공 통보                       +----(Yes)--> [스크랩 대기열로 복귀]    | 6. SREM완료      +----(Yes)--> [가공 대기열로 복귀]
               v                                   |                                       v                 |
       [transform_queue 푸시]                      v                               [active_processing 제거]  v
                                           [재시도 3회 초과?]                                              |
                                                   |                                                       v
                                                   v                                               [재시도 3회 초과?]
                                           +-----------------------------------------------------+         |
                                           | 3. dead_letter_queue (Redis List)                   |<--------+
                                           |    - 영구 실패 건 격리 보관 (에러 원인 추적용)      |
                                           +-----------------------------------------------------+
  ```
### 1) `scrape_queue` (List 타입)
* **목적**: Scraper가 수집해야 할 신규 대상 작업 큐.
* **데이터 구조**:
  ```json
  {
    "site": "linkedin",
    "type": "job",
    "id": "12345678",
    "url": "https://www.linkedin.com/jobs/view/12345678",
    "attempt": 1
  }
  ```

### 2) `transform_queue` (List 타입)
* **목적**: 수집이 완료되어 가공을 대기 중인 대상 목록 통보 큐.
* **데이터 구조**:
  ```json
  {
    "site": "linkedin",
    "type": "job",
    "id": "12345678",
    "bronze_id": "mongodb_raw_html_document_id",
    "timestamp": "2026-06-05T21:08:00Z"
  }
  ```

### 3) `dead_letter_queue` (List 타입)
* **목적**: `attempt`가 일정 횟수(예: 3회) 이상 초과하여 영구 실패한 수집/가공 태스크 격리.

### 4) `active_processing` (Set 타입)
* **목적**: 동일 대상의 중복 큐 적재 방지 및 동시 처리 제어.

---

## 5. 단계별 전환 이행 시나리오 (Downtime Scenario)

시스템을 잠시 일시 정지(Downtime)하고 전체를 개편하는 단계별 과정입니다.

```mermaid
gantt
    title 이행 일정 및 작업 순서
    dateFormat  YYYY-MM-DD
    section 인프라 준비
    신규 Silver DB (PostgreSQL) 구성       :active, p1, 2026-06-06, 1d
    section 코드 리팩토링
    Scraper / Transform 로직 분리         :p2, after p1, 2d
    Loader 공통 인터페이스 구현            :p3, after p2, 1d
    section 배포 및 이행
    기존 컨테이너 정지 및 큐 정리           :p4, after p3, 1d
    신규 컨테이너 배포 및 구동             :p5, after p4, 1d
    초기 마이그레이션(Bronze -> Silver) 배칭 :p6, after p5, 1d
```

### [Step 1] 기존 시스템 안전 정지 및 MongoDB 컬렉션 Rename 준비
1. 현재 가동 중인 `clipper-worker` 컨테이너 및 Cron 스케줄러를 즉각 중지합니다.
2. Redis에서 아직 처리되지 않은 임시 대기열(`jobs_queue` 등) 데이터를 완전히 비우거나 임시 보존 백업합니다.
3. **MongoDB 컬렉션 Rename (옵션 1 적용)**:
   - 데이터 물리적 복사 없이 1초 이내에 완료되도록 동일 MongoDB 내에서 컬렉션명을 변경하는 명령어를 준비합니다.
   - **실행 대상 목록**:
     * `bronze.job_urls` ➡️ `linkedin.job_urls`
     * `bronze.jobs` ➡️ `linkedin.jobs`
     * `bronze.companies` ➡️ `linkedin.companies`
     * `bronze.geeknews_urls` ➡️ `geeknews.urls`
     * `bronze.geeknews` ➡️ `geeknews.html`
     * `bronze.gpters_urls` ➡️ `gpters.urls`
     * `bronze.gpters` ➡️ `gpters.html`
     * `bronze.pytorch_kr_urls` ➡️ `pytorch_kr.urls`
     * `bronze.pytorch_kr` ➡️ `pytorch_kr.html`
   - **MongoDB 쉘 명령문 예시**:
     ```javascript
     // mongosh 접속 후 실행
     db.getSiblingDB("admin").runCommand({ renameCollection: "clipper.bronze.jobs", to: "clipper.linkedin.jobs" });
     db.getSiblingDB("admin").runCommand({ renameCollection: "clipper.bronze.job_urls", to: "clipper.linkedin.job_urls" });
     // ... 타겟 사이트 전체 반복 수행
     ```

### [Step 2] 소스 코드 리팩토링 및 쪼개기
1. **Scraper 구축**: 기존 `Pipeline.ts`에서 변환기(`Converter.ts`) 호출부를 모두 거세하고, 오직 원본 HTML 파일 저장 및 `Bronze DB` 적재만 수행한 후 `transform_queue`에 이벤트를 전달하는 형태로 단순화합니다.
2. **Transform & Loader 구축**: 
   - `src/Transformer.ts` 워커를 새롭게 작성하여 `transform_queue`를 리스닝하도록 합니다.
   - `Loader` 클래스 인터페이스를 생성하여 정제된 데이터를 최종 PostgreSQL에 INSERT하는 동작을 작성합니다.
3. **Docker Compose 개편 (`docker/clipper/compose.yml`)**:
   - `clipper-worker` 서비스명을 `clipper-scraper`로 변경합니다. (Playwright 브라우저 가동을 위해 무거운 이미지 사용)
   - `clipper-transformer` 워커 서비스를 추가하고 가벼운 Node 환경으로 실행하며, 각각 레플리카 수를 조절합니다.
   - 신규 PostgreSQL(Silver DB) 컨테이너 정의를 추가합니다.
   - **노트북 리소스 제약(최대 3개 워커 한계) 고려**: `scraper`와 `transformer` 전체 복제본(replicas)의 합이 3개를 초과하지 않도록 컴팩트하게 구성합니다.

#### 📝 개편 예정인 `docker/clipper/compose.yml` 예시안
```yaml
services:
  # 1. Scraper Worker: 오직 HTML 원본 크롤링 및 수집만 수행 (Bronze MongoDB 적재)
  clipper-scraper:
    build:
      context: ../../
      dockerfile: docker/clipper/Dockerfile
    image: linkedin/clipper:latest
    command: ["npx", "ts-node", "src/ScraperWorker.ts"]
    deploy:
      replicas: 2 # 노트북 리소스 최적화: 수집 워커 2개 할당
    environment:
      - TZ=Asia/Seoul
      - REDIS_URL=redis://redis:6379
      - MONGO_URL=mongodb://mongodb:27017
    volumes:
      - ${HOST_PROJECT_PATH:-.}/data/sessions:/app/data/sessions
    restart: unless-stopped

  # 2. Transformer Worker: 큐 이벤트 감지하여 Raw HTML 변환 및 Load 수행 (Silver DB 적재)
  clipper-transformer:
    build:
      context: ../../
      dockerfile: docker/clipper/Dockerfile # 혹은 경량화된 Node 전용 Dockerfile
    image: linkedin/clipper:latest
    command: ["npx", "ts-node", "src/TransformerWorker.ts"]
    deploy:
      replicas: 1 # 노트북 리소스 최적화: 가벼운 파싱 변환 워커 1개 할당 (총 워커 3개)
    environment:
      - TZ=Asia/Seoul
      - REDIS_URL=redis://redis:6379
      - MONGO_URL=mongodb://mongodb:27017 # Bronze 읽기용
      - POSTGRES_URL=postgresql://user:pass@postgres:5432/silver # Silver 적재용
    restart: unless-stopped

  # 3. Silver PostgreSQL DB (최종 가공 정제 데이터 보관소 - 외부 노출 없이 내부 네트워크 통신만 수행)
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=silver
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```

### [Step 3] 통합 테스트 및 신규 아키텍처 배포
1. 모든 컨테이너 환경을 리빌드 후 실행(`make up`)합니다.
2. **기존 데이터 마이그레이션 (Initial Backfill)**:
   - **배경**: 기존에 수집된 수만 개의 HTML 원본 문서(`linkedin.jobs`, `geeknews.html` 등)가 MongoDB에 이미 보존되어 있습니다.
   - **이행 전략**: 기존 수집 사이클과 충돌 없이 안전하게 이관하기 위해, 백그라운드 일괄 마이그레이션 스크립트(`scripts/migration/InitialBackfill.ts`)를 작성하여 1회성 마이그레이션을 돌립니다.
   - **마이그레이션 데이터 흐름 관계도 (ASCII Art Data Flow)**:
     ```text
       [이관 대상 구 데이터 저장소]              [마이그레이션 스크립트 엔진]              [신규 실버 데이터 저장소]
       +-------------------------+              +-------------------------+              +-------------------------+
       |   MongoDB (Bronze)      |              |   InitialBackfill.ts    |              |   PostgreSQL (Silver)   |
       +-------------------------+              +-------------------------+              +-------------------------+
       |  - linkedin.jobs        |              |  1. Cursor Loop Read    |              |                         |
       |    (Raw HTML)           |------------->|     HTML String         |              |                         |
       |                         |              |                         |              |                         |
       |                         |              |  2. Convert & Refine    |              |                         |
       |                         |              |     - Parse metadata    |              |                         |
       |                         |              |     - HTML to Markdown  |              |                         |
       |                         |              |                         |              |  3. SQL Write (UPSERT)  |
       |                         |              |                         |------------->|  - linkedin_jobs        |
       |                         |              |                         |              |    (Clean MD & Fields)  |
       +-------------------------+              +-------------------------+              +-------------------------+
     ```
   - **스크립트 동작 예시**:
     ```typescript
     // scripts/migration/InitialBackfill.ts 예시안
     import { MongoDatabase } from '../../src/database/mongo';
     import { PostgreSQLConnection } from '../../src/database/postgres';
     import { LinkedInMarkdownConverter } from '../../src/sites/linkedin/jobs/Converter';

     async function migrateLinkedInJobs() {
         const mongo = MongoDatabase.getInstance();
         const pg = new PostgreSQLConnection();
         await mongo.connect();
         await pg.connect();

         const jobsHtmlCollection = await mongo.getCollection('linkedin.jobs');
         const cursor = jobsHtmlCollection.find({}); // 기존 MongoDB의 모든 HTML 문서 커서 확보
         const converter = new LinkedInMarkdownConverter();

         while (await cursor.hasNext()) {
             const doc = await cursor.next();
             if (!doc) continue;

             try {
                 // 1. HTML -> Markdown 변환 및 메타데이터 파싱
                 const parsed = converter.convert(doc.rawHtml);
                 
                 // 2. 신규 Silver DB (PostgreSQL) 적재 (UPSERT 구조로 멱등성 유지)
                 await pg.query(`
                     INSERT INTO linkedin_jobs (id, title, company_id, location, body_markdown)
                     VALUES ($1, $2, $3, $4, $5)
                     ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body_markdown = EXCLUDED.body_markdown
                 `, [doc.jobId, parsed.title, parsed.companyId, parsed.location, parsed.markdown]);
             } catch (err) {
                 console.error(`❌ Failed to migrate job ${doc.jobId}:`, err);
             }
         }
         console.log('🎉 LinkedIn Jobs 마이그레이션 완료!');
     }
     ```
3. 실시간 수집 및 가공이 차례대로 정상 수행되는지 로그 및 저장 데이터 정합성을 확인합니다.
4. **[Tip] 외부 포트 노출 없이 PostgreSQL 내부 데이터 CLI 검증**:
   - PostgreSQL 컨테이너 외부 포트를 열지 않았으므로, 동일 도커 네트워크 안에서 임시 클라이언트 컨테이너를 구동해 콘솔 창(psql)으로 데이터를 조회하고 검증합니다.
   - **실행 명령어**:
     ```bash
     # postgres 컨테이너의 기본 네트워크 이름(e.g., linkedin_default)을 지정하여 psql 쉘 기동
     docker run -it --rm --network linkedin_default postgres:15-alpine psql -h postgres -U user -d silver
     ```
     *(비밀번호 프롬프트 시 `pass` 입력)*
   - **조회 검증 예시 SQL**:
     ```sql
     -- 마이그레이션된 전체 채용 공고 개수 확인
     SELECT count(*) FROM linkedin_jobs;
     
     -- 최신 마이그레이션된 5개 행 제목 조회
     SELECT id, title, location FROM linkedin_jobs ORDER BY created_at DESC LIMIT 5;
     ```


