# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning.

---

## [1.4.4] - 2026-06-20

### Removed
- **서적 경로 직접 입력 기능 제거**: 내보내기 폼의 복잡성을 낮추기 위해 사용 빈도가 적고 UX 혼선을 일으킬 수 있는 "또는 아래에 전체 경로를 직접 지정할 수 있습니다" 안내 텍스트 및 서적 경로 수동 입력 필드 요소를 뷰포트에서 영구 제거 완료.

## [1.4.3] - 2026-06-20

### Fixed (Bugfixes)
- **Bugfix: 내보내기 문서 내 로컬 이미지 깨짐(엑스박스) 문제 완벽 수정**: Joplin 내보내기 진행 시 상대 경로 텍스트 상태로 남겨져 이미지가 로드되지 않던 현상을 해결하기 위해, 백엔드에 `GET /api/exporter/image` API를 추가하고 프론트엔드가 이미지 Blob을 획득하여 Joplin 리소스 API(`POST /resources`)로 직접 자동 업로드한 뒤 본문을 리소스 ID 식별자(`:/resource_id`)로 치환하여 연동되도록 수정 완료.

## [1.4.2] - 2026-06-20

### Fixed (Bugfixes)
- **Bugfix: 내보내기 정렬 역순 현상 교정**: Joplin 등 외부 노트 도구의 '작성순 내림차순(최신순)' 정렬 특성으로 인해 책 챕터들이 목록 역순으로 정렬되던 문제를 바로잡기 위해, 내보내기 시 챕터를 마지막 장(N장)부터 첫 장(1장)으로 역순으로 생성하도록 순서 교정 완료.

## [1.4.1] - 2026-06-20

### Fixed (Bugfixes)
- **Bugfix: 브라우저 직접 내보내기(Direct Export) 지원**: Docker 내부망에서의 Joplin/Obsidian 포트 접근 보안 제약 및 방화벽 한계를 극복하기 위해, 백엔드 서버 대신 프론트엔드(브라우저)에서 사용자의 로컬 루프백(`127.0.0.1`) 포트로 직접 `fetch` 요청을 전송하여 문서를 내보내도록 통신 주체를 브라우저 단으로 전면 리팩토링 및 개선 완료.
- **GET /api/exporter/book-content API 추가**: 프론트엔드에서 일괄적으로 서적 내용을 읽을 수 있도록 전체 챕터 마크다운 내용을 묶어서 반환하는 백엔드 API 신설.

## [1.4.0] - 2026-06-20

### Added
- **Joplin/Obsidian Exporter Web Integration**: `apps/exporter` 코드를 `apps/viewer` 내로 완전히 마이그레이션하고 백엔드 Express Router (`/api/exporter/*`) 및 프론트엔드 Exporter 뷰 (`ExporterView.vue`)를 새로 구현하여 웹 대시보드 상에서 간편하게 내보내기 조작이 가능하도록 통합.
- **Frontend Vue Router Migration**: 기존 `App.vue`에 집중되었던 1,200줄의 코드를 `DashboardView.vue`, `DocumentView.vue`, `ExporterView.vue` 컴포넌트로 깔끔하게 리팩토링 및 격리 분리하고, `vue-router@4`를 도입하여 다중 페이지 아키텍처로 개편.
- **Joplin 루트 직접 폴더 생성**: 사용자의 편의성에 맞추어 `Wikidocs` 루트 폴더 래퍼를 생성하는 대신, Joplin 최상위 루트 노트북 디렉토리에 바로 서적 폴더가 생성되도록 내보내기 디렉터리 경로 개선 완료.
- **변환 옵션(Frontmatter/INDEX) 삭제**: 불필요하게 스페이스를 차지하던 `3. 변환 옵션` (Frontmatter 자동 추가, INDEX 파일 자동 생성) 체크박스와 관련 비즈니스 로직을 UI 및 백엔드 기능 전체에서 제거 완료.

### Fixed (Bugfixes)
- **Bugfix: Exporter 설정 카드 높이 잘림 문제 해결**: Joplin 또는 Obsidian 연동 설정 필드가 활성화될 때 설정 폼 카드의 스크롤이 불가하여 `Joplin API 웹클리퍼 토큰` 입력란 및 하단 버튼이 뷰포트에서 잘려 보이지 않는 레이아웃 버그를 `.queue-section-card`에 `overflow-y: auto` 스타일 주입 및 최소 높이를 `615px`로 상향 조정하여 수정 완료.
- **Bugfix: viewer-api 컨테이너 내 /app/data 볼륨 마운트 누락 수정**: 웹 Exporter 화면에서 "1. 대상 서적 선택" 드롭다운 목록이 비어 있는 원인을 분석하여, `viewer-api` 서비스 볼륨 설정에 호스트의 `./data`가 누락된 것을 식별하고 `apps/viewer/compose.yml` 파일에 볼륨 바인딩 설정을 추가하여 해결 완료.
- **Bugfix: Docker 컨테이너 내 host.docker.internal 게이트웨이 해석 에러 해결**: 리눅스 Docker 환경 내의 `viewer-api` 컨테이너가 호스트에 실행 중인 Joplin에 연결할 수 있도록 `apps/viewer/compose.yml` 서비스 내역에 `extra_hosts: ["host.docker.internal:host-gateway"]` 네트워크 설정을 정밀 보완 완료.

## [1.3.0] - 2026-06-20

### Added
- **Joplin/Obsidian Exporter Module (`apps/exporter`)**: `wikidocs-exporter`의 내보내기 핵심 기능을 모노레포 독립 모듈(`apps/exporter`)로 완벽 이식 및 통합.
- **Docker-Centric Execution Config**: 컨테이너 개발 환경에서 호스트 PC의 로컬 API에 접근하기 위한 루프백 설정(`host.docker.internal`) 정립, `compose.yml` 및 `Makefile` 빌드 파이프라인 결합 완료.
- **Local Markdown File Scanner**: `data/ebook/output/` 디렉터리에 추출된 도서별 챕터 마크다운 파일들을 분석하여 자동으로 도서 데이터로 조립하는 로더 모듈 구현.

## [1.2.0] - 2026-06-20

### Changed
- **Crawler Scripts Migration (NPM Scripts)**: `scripts/sites/` 하위의 사이트별 Makefile 9개와 `worker.mk`, `gmail.mk`, `tests.mk` 등을 모두 제거하고, 27개의 크롤링 커맨드 및 Gmail/Queue 관련 스크립트, 테스트 관련 스크립트를 `apps/crawler/package.json`의 npm 스크립트로 통합 완료.
- **Makefile Restructuring**: 루트 `Makefile`의 스파게티성 `run-scrape` 로직 및 `PAGE`, `LIST_SLACK` 기본값 정의, 그리고 테스트/디버깅 타겟들을 `apps/crawler/Makefile` 내부로 완벽히 이전 및 이격. 루트 Makefile은 이를 중계 호출(Forwarding)하는 미니멀한 래퍼 구조로 재정렬.
- **Monorepo Separation**: `apps/viewer/docker/compose.yml`을 `apps/viewer/compose.yml`로 통합/이동하고 내부 빌드 컨텍스트를 `.`로 정렬하여 결합도를 최소화함. 또한 `apps/viewer/Makefile`에 `down` 타겟을 구현하고 루트 `viewer-up` 및 `viewer-down` 매핑에 호환되도록 `viewer-%` 와일드카드 타겟 위임을 구조화함.
- **Makefile Path Standardization**: 하위 모든 Makefile(`crawler`, `viewer`, `ebook`)에서 Make 내장 함수를 활용해 `ROOT_DIR`을 동적 검출하도록 단일 표준화하고, `docker compose` 명령 실행 시 `--project-directory` 플래그를 정립하여 상대 경로 하드코딩 문제를 우아하게 해결함.




## [1.1.0] - 2026-06-19

### Added
- **Ebook Parser & Sync Pipeline**: Added `apps/ebook` service using Python 3.13 and `uv` to process book PDFs, and created a TypeScript CLI synchronization script (`sync-ebooks.ts`) in `apps/crawler` to load chapters into MongoDB (`silver.contents`) and Meilisearch (`contents`).

### Changed
- **Monorepo Restructuring**: Transitioned the single-app repository into a modern monorepo layout:
  - Main scraper logic shifted to `apps/crawler`.
  - Frontend dashboard and server decoupled to `apps/viewer`.
  - Created shared packages `packages/database` and `packages/config`.
- **Docker Profiles for Ebook**: Equipped the `ebook` service container with a specific docker compose profile (`ebook`), isolating resources and allowing on-demand CLI executions.

### Fixed (Bugfixes)
- **Bugfix: Resolved TypeScript Compilation and Module Resolution Errors**: Fixed critical run-time `MODULE_NOT_FOUND` compiler errors in `ScraperWorker.ts`, `ConverterWorker.ts`, `IndexerWorker.ts`, and `TargetLoader.ts` by migrating to environment-agnostic physical relative paths (`../../../../packages/database/...`).
- **Bugfix: Fixed Scripts Entrypoints in Makefiles**: Restructured legacy `src/scripts` paths inside `browser.mk`, `meili.mk`, `mongo.mk`, `tests.mk`, and `worker.mk` to use the updated monorepo directory `apps/crawler/src/scripts`.

## [1.0.0] - 2026-06-19


### Added
- **Retroactive Noise Cleansing Script**: Added `clean_legacy_noise_ids.ts` to automatically scan all site collections in MongoDB, prune malformed IDs containing Korean trailing particles, and re-schedule clean URLs for re-crawling.

### Changed
- **Redis Namespace Refactoring**: Restructured all active scraper queues and completion caches into a unified, site-centric layout:
  - Sc scraper queues: `sites:${siteKey}:scrape:${priority}`
  - Completion caches: `sites:${siteKey}:completed`
- **Dashboard Metric Parsing**: Updated dashboard server API and App.vue UI metrics to dynamically parse both legacy (`scrape_queue:*`) and namespace-isolated (`sites:*:scrape:*`) queues.

### Fixed
- **Cross-Site Cache Collision Bug**: Resolved a critical issue where `Daily Dose of DS`, `GeekNews`, `GPTers News`, and `PyTorch KR` shared the same Redis cache key (`completed_news`), causing `seedCache()` to be skipped across multiple crawls and forcing all crawled documents into the scraper queues repeatedly.
- **Legacy Fallback Handling**: Implemented automatic completed set key upgrades in `BaseListService` and `BaseRefreshUrls` to gracefully map legacy config prefixes (e.g. `completed_`) to the new namespace format.
