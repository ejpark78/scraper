# Clipper — Multi-Site Web Scraper & Markdown Pipeline

Playwright/HTTP 기반 다중 사이트 스크래핑, MongoDB Bronze/Silver 2단계 파이프라인, Redis 분산 큐 워커, 마크다운 자동 변환을 지원하는 TypeScript 엔터프라이즈 수집 시스템.

---

## Supported Sites

| Site | Domain | Data Source | Bronze Collection | Silver Collection |
|------|--------|-------------|-------------------|-------------------|
| **LinkedIn Jobs** | linkedin.com | Playwright browser | `bronze/linkedin.jobs` | `silver/linkedin.jobs` |
| **LinkedIn Company** | linkedin.com | Playwright browser | `bronze/linkedin.companies` | `silver/linkedin.companies` |
| **GeekNews** | news.hada.io | HTTP fetch | `bronze/geeknews.html` | `silver/geeknews.contents` |
| **GPters** | gpters.org | Bettermode GraphQL API | `bronze/gpters.html` | `silver/gpters.contents` |
| **PyTorch KR** | discuss.pytorch.kr | Discourse JSON API | `bronze/pytorch_kr.html` | `silver/pytorch_kr.contents` |

---

## Architecture

```text
List (discovery) ──➜ Redis scrape_queue ──➜ ScraperWorker ──➜ MongoDB Bronze
                                                                    │
                                                                    ▼
                                                           Redis transform_queue
                                                                    │
                                                                    ▼
                                                           TransformerWorker
                                                                    │
                                                                    ▼
                                                           MongoDB Silver
                                                                    │
                                                                    ▼
                                                           Viewer (HTTP + MCP)
```

### Layers

- **Bronze Layer**: 원본 raw HTML/JSON을 MongoDB에 영구 보존
- **Silver Layer**: 정제된 마크다운 + 메타데이터 (제목, 작성자, 날짜 등)

### Workers

- **ScraperWorker** (`clipper-scraper`): Redis `scrape_queue`를 BLPOP으로 소비, 사이트별 스크래핑 로직으로 전달, 결과를 Bronze에 저장하고 `transform_queue`에 발행
- **TransformerWorker** (`clipper-transformer`): Redis `transform_queue`를 BLPOP으로 소비, Bronze → Silver 변환, TargetLoader를 통해 Silver에 upsert

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
make gn-list        # GeekNews 최신글 수집
make gpt-list       # GPters 최신글 수집
make pk-list        # PyTorch KR 최신글 수집
make li-list        # LinkedIn 채용공고 목록 수집

# 기존 Bronze 전부 재변환 (silver 갱신)
make gn-refresh-md
make gpt-refresh-md
make pk-refresh-md
make li-refresh-md

# Viewer 대시보드
make up-viewer      # https://viewer.localhost
```

---

## Make Targets

### Site-Specific

| Prefix | Site | Make Targets |
|--------|------|-------------|
| `gn-` | GeekNews | `list`, `refresh-urls`, `refresh-md`, `backfill` |
| `gpt-` | GPters | `list`, `refresh`, `refresh-urls`, `refresh-md` |
| `pk-` | PyTorch KR | `list`, `refresh-urls`, `refresh-md` |
| `li-` | LinkedIn | `list`, `company`, `extract-urls`, `refresh-urls`, `refresh-md`, `status` |

### Infrastructure

| Target | Description |
|--------|-------------|
| `up` | 전체 인프라 + 워커 기동 |
| `down` | 도구 컨테이너 중지 |
| `build` | runtime 프로필 이미지 빌드 |
| `restart` | 워커 재시작 (`SCALE=N`) |
| `up-tools` | 모든 관리 도구 기동 |
| `down-tools` | 모든 관리 도구 중지 |
| `up-viewer` | Viewer / MCP 서버 기동 |

### Utilities

| Target | Description |
|--------|-------------|
| `login` | Playwright 브라우저 로그인 (`SITE=...`) |
| `open` | 브라우저 세션 열기 |
| `logout` | 세션 파일 삭제 |
| `dump` | MongoDB 덤프 (`DB=bronze,silver`) |
| `restore` | MongoDB 복원 (`BACKUP_DIR=...`) |
| `test-urls` | URL 매니저 테스트 |
| `test-mcp` | MCP 클라이언트 테스트 |

---

## Docker Services

| Service | Profile | Description | URL |
|---------|---------|-------------|-----|
| `mongodb` | core | MongoDB 7.0 | — |
| `redis` | core | Redis (Alpine) | — |
| `traefik` | tools | Reverse proxy + TLS | `route.localhost` |
| `clipper` | runtime | CLI one-shot runner | — |
| `clipper-scraper` | runtime | Scraper worker (replicas: 2) | — |
| `clipper-transformer` | runtime | Transformer worker (replica: 1) | — |
| `viewer` | tools | Document viewer + MCP server | `viewer.localhost` |
| `mongo-express` | tools | MongoDB Web GUI | `me.localhost` |
| `redisinsight` | tools | Redis GUI | `redis.localhost` |
| `yacht` | tools | Docker dashboard | `yacht.localhost` |
| `dozzle` | tools | Real-time logs | `dozzle.localhost` |
| `cronicle` | tools | Job scheduler | `cron.localhost` |
| `jupyter` | tools | Jupyter Notebooks | `jupyter.localhost` |
| `kasm` | tools | Remote browser VDI | `kasm.localhost` |

---

## Directory Structure

```text
├── src/
│   ├── core/              # BasePipeline, IConverter 추상화
│   ├── database/          # MongoDB singleton + 인덱스 자동 생성
│   ├── utils/             # Logger, HtmlMinifier, UrlUtils, DateUtils
│   ├── sites/
│   │   ├── geeknews/      # GeekNews (news.hada.io)
│   │   ├── gpters/        # GPters (gpters.org) — Bettermode GraphQL
│   │   ├── pytorch_kr/    # PyTorch KR (discuss.pytorch.kr) — Discourse
│   │   └── linkedin/      # LinkedIn Jobs + Company — Playwright
│   │       ├── jobs/      # ListScraper, Converter, UrlManager
│   │       └── company/   # Company Pipeline, Converter
│   ├── viewer/            # Express + MCP SSE viewer server
│   ├── ScraperWorker.ts   # Redis scraper worker (BLPOP scrape_queue)
│   ├── TransformerWorker.ts # Redis transformer worker (BLPOP transform_queue)
│   └── TargetLoader.ts    # Silver layer upsert dispatcher
├── scripts/
│   └── sites/             # Site-specific Makefiles
├── docker/                # Docker compose modules
└── data/                  # 수집 데이터, 세션, 서비스 퍼시스턴스
```
