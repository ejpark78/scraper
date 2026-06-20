# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning.

---

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
