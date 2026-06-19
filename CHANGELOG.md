# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning.

---

## [1.0.0] - 2026-06-19

### Changed
- **Redis Namespace Refactoring**: Restructured all active scraper queues and completion caches into a unified, site-centric layout:
  - Sc scraper queues: `sites:${siteKey}:scrape:${priority}`
  - Completion caches: `sites:${siteKey}:completed`
- **Dashboard Metric Parsing**: Updated dashboard server API and App.vue UI metrics to dynamically parse both legacy (`scrape_queue:*`) and namespace-isolated (`sites:*:scrape:*`) queues.

### Fixed
- **Cross-Site Cache Collision Bug**: Resolved a critical issue where `Daily Dose of DS`, `GeekNews`, `GPTers News`, and `PyTorch KR` shared the same Redis cache key (`completed_news`), causing `seedCache()` to be skipped across multiple crawls and forcing all crawled documents into the scraper queues repeatedly.
- **Legacy Fallback Handling**: Implemented automatic completed set key upgrades in `BaseListService` and `BaseRefreshUrls` to gracefully map legacy config prefixes (e.g. `completed_`) to the new namespace format.
