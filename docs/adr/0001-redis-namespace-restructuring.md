# ADR 0001: Redis Queue & Completed Cache Namespace Restructuring

## Status
Accepted (2026-06-19)

## Context
Multiple crawler sites (`geeknews`, `dailydose_ds`, `gpters`, and `pytorch_kr`) were configured to share the same Redis cache set key (`completed_news`). This caused:
1. `seedCache()` inside `BaseListService` to skip MongoDB synchronization on subsequent crawls, because the shared set already had size > 0.
2. Inconsistent deduplication checks (`sismember`), leading to raw document queueing redundancy (redundantly pushing already crawled documents into scraper queues).
3. Harder key identification in multi-site dashboard monitoring.

## Decision
Adopt a unified, site-specific namespace layout for all Redis structures:
- **Queues**: `sites:${siteKey}:scrape:${priority}`
- **Completion Caches**: `sites:${siteKey}:completed`

Additionally, implement automatic legacy prefix translation in `BaseListService` and `BaseRefreshUrls` to ensure older site configs gracefully convert legacy keys (`completed_${siteKey}`) to the new namespace format.

## Consequences
- **Pros**:
  - Eliminates cross-site cache collision bugs.
  - Improves isolation; clearing a specific queue or completion cache does not affect other sites.
  - Simplifies regex scans in metrics pipelines (e.g. scanning `sites:*:scrape:*`).
- **Cons**:
  - Requires updating multiple core files (`ScraperWorker.ts`, `BaseListService.ts`, `server.ts`, etc.) and dashboards to handle the new key layout.
  - Active Redis caches must be re-seeded or migrated.
