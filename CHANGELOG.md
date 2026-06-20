# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning.

---

## [1.2.0] - 2026-06-20

### Changed
- **Crawler Scripts Migration (NPM Scripts)**: `scripts/sites/` 하위의 사이트별 Makefile 9개와 `worker.mk`, `gmail.mk`, `tests.mk` 등을 모두 제거하고, 27개의 크롤링 커맨드 및 Gmail/Queue 관련 스크립트, 테스트 관련 스크립트를 `apps/crawler/package.json`의 npm 스크립트로 통합 완료.
- **Makefile Restructuring**: 루트 `Makefile`의 스파게티성 `run-scrape` 로직 및 `PAGE`, `LIST_SLACK` 기본값 정의, 그리고 테스트/디버깅 타겟들을 `apps/crawler/Makefile` 내부로 완벽히 이전 및 이격. 루트 Makefile은 이를 중계 호출(Forwarding)하는 미니멀한 래퍼 구조로 재정렬.

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
