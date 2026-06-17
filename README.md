# Clipper — Multi-Site Web Scraper & Markdown Pipeline

Playwright/HTTP 기반 다중 사이트 스크래핑, MongoDB Bronze/Silver 2단계 파이프라인, Redis 분산 큐 워커, Meilisearch 전문 검색, 마크다운 자동 변환을 지원하는 TypeScript 엔터프라이즈 수집 시스템.

---

## Supported Sites

| Site | Domain | Data Source | Bronze Collection | Silver Collection |
|------|--------|-------------|-------------------|-------------------|
| **LinkedIn Jobs** | linkedin.com | Playwright browser | `bronze/linkedin.jobs`, `bronze/linkedin.lists`, `bronze/linkedin.job_urls` | `silver/linkedin.jobs` |
| **LinkedIn Company** | linkedin.com | Playwright browser | `bronze/linkedin.companies`, `bronze/linkedin.company_urls` | `silver/linkedin.companies` |
| **GeekNews** | news.hada.io | HTTP fetch | `bronze/geeknews.html`, `bronze/geeknews.urls` | `silver/geeknews.contents` |
| **GPTers News** | gpters.org | Bettermode GraphQL API | `bronze/gpters.html`, `bronze/gpters.urls` | `silver/gpters.contents` |
| **GPTers Newsletter** | gpters.org | Bettermode GraphQL API | `bronze/gpters_newsletter.html`, `bronze/gpters_newsletter.urls` | `silver/gpters_newsletter.contents` |
| **PyTorch KR** | discuss.pytorch.kr | Discourse JSON API | `bronze/pytorch_kr.html`, `bronze/pytorch_kr.urls`, `bronze/pytorch_kr.lists` | `silver/pytorch_kr.contents` |
| **Daily Dose of DS** | dailydoseofds.com | HTTP fetch / Feed | `bronze/dailydose_ds.html`, `bronze/dailydose_ds.urls` | `silver/dailydose_ds.contents` |
| **AiCasebook** | aicasebook.dev | HTTP fetch | `bronze/aicasebook.html`, `bronze/aicasebook.urls` | `silver/aicasebook.contents` |
| **Maily Josh** | maily.so/josh | HTTP fetch (RSS) | `bronze/maily_josh.html`, `bronze/maily_josh.urls` | `silver/maily_josh.contents` |
| **Uppity** | uppity.co.kr | HTTP fetch | `bronze/uppity.html`, `bronze/uppity.urls` | `silver/uppity.contents` |
| **요즘IT (Yozm)** | yozm.wishket.com | HTTP fetch (Sitemap) | `bronze/yozm.html`, `bronze/yozm.urls` | `silver/yozm.contents` |

---

## Architecture

```text
List (discovery) ──➜ Redis scrape_queue ──➜ ScraperWorker ──➜ MongoDB Bronze
                                                                     │
                                                                     ▼
                                                            Redis convert_queue
                                                                     │
                                                                     ▼
                                                            ConverterWorker
                                                                     │
                                                                     ▼
                                                            MongoDB Silver
                                                                     │
                                                    ┌─────────────────┼─────────────────┐
                                                    ▼                                  ▼
                                           Meilisearch (index_queue)             Viewer (HTTP + MCP)
                                           IndexerWorker                        viewer-fe / viewer-api / viewer-mcp
```

### Layers

- **Bronze Layer**: 원본 raw HTML/JSON을 MongoDB에 영구 보존
- **Silver Layer**: 정제된 마크다운 + 메타데이터 (제목, 작성자, 날짜 등). `site.config.ts`의 `refreshSilver` 설정을 통해 전수 재변환 및 이미지 다운로드 제어 가능.

### Workers

- **ScraperWorker** (`scraper`): Redis `scrape_queue`를 BLPOP으로 소비, 사이트별 스크래핑 로직으로 전달, 결과를 Bronze에 저장하고 `convert_queue`에 발행 (replicas: 2)
- **ConverterWorker** (`converter`): Redis `convert_queue`를 BLPOP으로 소비, Bronze → Silver 변환, TargetLoader를 통해 Silver에 upsert (replica: 1)
- **IndexerWorker** (`indexer`): Redis `index_queue`를 BLPOP으로 소비, MongoDB Silver 문서를 읽어 Meilisearch에 색인, 실패 시 최대 3회 재시도 후 `dead_letter_queue`로 이동 (replica: 1)

### Redis Queues

| Queue | Producer | Consumer | Description |
|-------|----------|----------|-------------|
| `scrape_queue` | CLI list commands | ScraperWorker | URL 수집 대상 |
| `convert_queue` | ScraperWorker | ConverterWorker | Bronze → Silver 변환 |
| `index_queue` | ConverterWorker | IndexerWorker | Silver → Meilisearch 색인 |
| `dead_letter_queue` | IndexerWorker | — | 최대 재시도 초과 실패 작업 |

---

## Quick Start

```bash
# 환경 변수
cp .env.example .env

# 의존성 설치
npm install && npx playwright install chromium

# 전체 인프라 기동 (MongoDB, Redis + 워커)
make up

# 사이트별 수집 실행
make gn-list           # GeekNews 최신글 수집
make gpt-list          # GPTers News 최신글 수집
make gpt-newsletter-list  # GPTers Newsletter 최신글 수집
make pk-list           # PyTorch KR 최신글 수집
make ddds-list         # Daily Dose of DS 최신글 수집
make li-list           # LinkedIn 채용공고 목록 수집
make ab-list           # AiCasebook 최신글 수집
make up-list           # Uppity 최신글 수집
make mj-list           # Maily Josh 최신글 수집
make yz-list           # 요즘IT 최신글 수집

# 기존 Bronze 전부 재변환 (silver 갱신)
make gn-refresh-silver
make gpt-refresh-silver
make pk-refresh-silver
make ddds-refresh-silver
make li-refresh-silver
make ab-refresh-silver
make up-refresh-silver
make mj-refresh-silver
make yz-refresh-silver

# Viewer 대시보드
make up-viewer      # https://viewer.localhost
```

---

## Make Targets

### Site-Specific

| Prefix | Site | Make Targets |
|--------|------|-------------|
| `gn-` | GeekNews | `list`, `refresh-urls`, `refresh-silver` |
| `gpt-` | GPTers News / Newsletter | `list`, `refresh`, `refresh-urls`, `refresh-silver`, `newsletter-list`, `newsletter-refresh`, `refresh-silver-rebuild`, `newsletter-refresh-silver-rebuild` |
| `pk-` | PyTorch KR | `list`, `refresh`, `refresh-urls`, `refresh-silver` |
| `ddds-` | Daily Dose of DS | `list`, `refresh-urls`, `refresh-silver` |
| `li-` | LinkedIn | `list`, `company`, `refresh-urls`, `refresh-silver`, `status` |
| `ab-` | AiCasebook | `list`, `refresh-urls`, `refresh-silver` |
| `up-` | Uppity | `list`, `refresh-urls`, `refresh-silver` |
| `mj-` | Maily Josh | `list`, `refresh-urls`, `refresh-silver` |
| `yz-` | 요즘IT (Yozm) | `list`, `refresh-urls`, `refresh-silver` |

### Group Targets

| Target | Description |
|--------|-------------|
| `list` | 모든 사이트 list 실행 |
| `refresh-urls` | 모든 사이트 URL 큐 복구 |
| `refresh-silver` | 모든 사이트 Silver 레이어 재변환 |

### Infrastructure

| Target | Description |
|--------|-------------|
| `up` | 전체 인프라 + 워커 기동 (--profile worker) |
| `down` | 도구 컨테이너 중지 |
| `build` | runtime/tools/worker 프로필 이미지 빌드 |
| `restart` | 워커 재시작 (`SCALE=N`) |
| `up-tools` | 모든 관리 도구 기동 |
| `down-tools` | 모든 관리 도구 중지 |
| `up-viewer` | Viewer FE / API / MCP 서버 기동 |

### Utilities & Agent Management

| Target | Description |
|--------|-------------|
| `login` | Playwright 브라우저 로그인 (`SITE=...`) |
| `open` | 브라우저 세션 열기 |
| `inspect-layout` | 페이지 레이아웃 HTML 검사 |
| `logout` | 세션 파일 삭제 |
| `mongo-dump` | MongoDB 덤프 (`DB=bronze,silver`) |
| `mongo-restore` | MongoDB 복원 (`BACKUP_DIR=...`) |
| `mongo-index` | MongoDB 인덱스 동기화 |
| `mongo-show-columns` | 컬렉션 컬럼 매핑 조회 |
| `clear-queue` | Redis 큐 전체 초기화 |
| `dump-queue` | Redis 큐 덤프 |
| `get-queue-status` | Redis 큐 상태 조회 |
| `fix-urls` | URL 정리 및 큐 복구 |
| `grep-errors` | 워커 로그 에러 분석 |
| `ms-refresh-index` | Meilisearch 인덱스 갱신 (upsert) |
| `ms-reset-index` | Meilisearch 인덱스 초기화 후 재구축 |
| `ms-reindex` | Meilisearch 인덱스 리빌드 (`SITE=...`) |
| `ms-status` | Meilisearch 인덱스 통계 조회 |
| `gm-download` | Gmail 첨부파일 다운로드 |
| `gm-export` | Gmail 데이터 내보내기 |
| `agents-dump` | 에이전트 트랜스크립트/스냅샷 덤프 |
| `agents-usage` | 에이전트 세션 정보 및 사용량 분석 |
| `agents-prune` | 에이전트 빈 세션 데이터 정리 |

---

## Docker Services

| Service | Profile | Description | URL |
|---------|---------|-------------|-----|
| `mongodb` | core | MongoDB 7.0 | — |
| `redis` | core | Redis (Alpine) | — |
| `meilisearch` | infra | Meilisearch search engine | — |
| `traefik` | tools | Reverse proxy + TLS | `route.localhost` |
| `worker` | runtime | CLI one-shot runner | — |
| `scraper` | worker | Scraper worker (replicas: 2) | — |
| `converter` | worker | Converter worker (replica: 1) | — |
| `indexer` | worker | Meilisearch indexer worker (replica: 1) | — |
| `viewer-fe` | viewer | Vue frontend | `viewer.localhost` |
| `viewer-api` | viewer | Express API server | `viewer.localhost` |
| `viewer-mcp` | viewer | MCP SSE server | `viewer.localhost` |
| `mongo-express` | tools | MongoDB Web GUI | `me.localhost` |
| `redisinsight` | tools | Redis GUI | `redis.localhost` |
| `yacht` | tools | Docker dashboard | `yacht.localhost` |
| `dozzle` | tools | Real-time logs | `dozzle.localhost` |
| `cronicle` | tools | Job scheduler | `cron.localhost` |
| `jupyter` | tools | Jupyter Notebooks | `jupyter.localhost` |
| `kasm` | tools | Remote browser VDI | `kasm.localhost` |
| `onwatch` | tools | File watcher + notification | `onwatch.localhost` |
| `gmail` | tools | Gmail API downloader | — |
| `opencode` | tools | opencode CLI agent | — |

---

## Directory Structure

```text
├── src/
│   ├── crawler/
│   │   ├── core/               # BasePipeline, BaseListService, IConverter, SiteRegistry, CLI abstractions
│   │   ├── sites/              # Site-specific scraper modules
│   │   │   ├── geeknews/       # GeekNews (news.hada.io) — HTTP fetch
│   │   │   ├── gpters/         # GPTers (gpters.org) — Bettermode GraphQL
│   │   │   │   ├── news/       # GPTers News
│   │   │   │   └── newsletter/ # GPTers Newsletter
│   │   │   ├── pytorch_kr/     # PyTorch KR (discuss.pytorch.kr) — Discourse
│   │   │   ├── linkedin/       # LinkedIn Jobs + Company — Playwright
│   │   │   │   ├── jobs/       # Jobs List, Converter, UrlManager
│   │   │   │   └── company/    # Company Pipeline, Converter
│   │   │   ├── aicasebook/     # AiCasebook (aicasebook.dev)
│   │   │   ├── dailydoseofds/  # Daily Dose of DS (dailydoseofds.com)
│   │   │   ├── maily/          # Maily Josh (maily.so/josh)
│   │   │   ├── uppity/         # Uppity (uppity.co.kr)
│   │   │   └── yozm/           # 요즘IT (yozm.wishket.com)
│   │   ├── utils/              # Logger, HtmlMinifier, UrlUtils, DateUtils, imageDownloader, etc.
│   │   └── workers/            # Redis queue workers
│   │       ├── ScraperWorker.ts     # BLPOP scrape_queue → Bronze
│   │       ├── ConverterWorker.ts   # BLPOP convert_queue → Silver
│   │       ├── IndexerWorker.ts     # BLPOP index_queue → Meilisearch
│   │       └── TargetLoader.ts      # Silver layer upsert dispatcher
│   ├── config/                 # AppConfig, site configuration
│   ├── database/               # MongoDB singleton + Meilisearch client
│   ├── viewer/                 # Vue frontend + Express/MCP SSE server
│   ├── tools/                  # Browser pool, Gmail downloader, agent tools
│   └── scripts/                # Utility scripts (queue, debug, diagnose, meili-manager, etc.)
├── config/                     # Static config (selectors, countries, JSON configs)
├── scripts/
│   ├── sites/                  # Site-specific Makefile fragments
│   ├── tools/                  # Tools Makefile fragments (Gmail, Docker tools)
│   └── utils/                  # Utility Makefile fragments (browser, docker, worker, mongo, meili, agents, tests)
├── docker/
│   ├── gateway/traefik/        # Traefik reverse proxy
│   ├── infra/                  # MongoDB, Redis, Meilisearch
│   ├── tools/                  # Viewer, Cronicle, Dozzle, Jupyter, Kasm, Yacht, Gmail, opencode, onWatch
│   └── worker/                 # Base, Scraper, Converter, Indexer Dockerfiles
└── data/                       # 수집 데이터, 세션, 서비스 퍼시스턴스
```
