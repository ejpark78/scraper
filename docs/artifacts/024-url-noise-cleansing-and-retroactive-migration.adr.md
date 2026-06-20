# ADR 0002: URL Noise Cleansing & Retroactive Database Cleansing

## Status
Accepted (2026-06-19)

## Context
Trailing Korean grammatical particles (e.g. `를`, `에`, `은`, `는`) or their URL percent-encoded representations (e.g. `%EB%A5%BC`, `%EC%97%90`) were accidentally captured by body extractors during crawls. This resulted in malformed IDs (such as `1579%EB%A5%BC`) and caused subsequent scrape attempts to fail with HTTP 400 Bad Request.

Although the regex filter was added to `UrlUtils.stripTrackingParams` and parser rules were updated, historical crawled data with noise IDs still existed in MongoDB (`bronze.*.urls`). This metadata discrepancy caused:
- Mismatched duplication checks.
- Residual "Failed" state counts in database status logs.

## Decision
1. Implement a global database cleansing script (`src/scripts/clean_legacy_noise_ids.ts`) to programmatically loop through all registered site collections.
2. The script will identify all IDs matching `/.*[가-힣%].*/` in `bronze/${siteKey}.urls`.
3. Malformed noise documents will be deleted.
4. For each deleted document, a normalized clean version of the target document will be checked. If it does not exist, it will be upserted with status `new` and `pushedToRedis: false` to allow proper, clean re-crawling.

## Consequences
- **Pros**:
  - Automatically recovers all failed noise target links across all sites.
  - Keeps MongoDB collections clean and mathematically consistent with current ID mapping conventions.
  - Avoids manual database scripts or hardcoded shell queries.
- **Cons**:
  - Re-scheduling clean URLs increases temporary crawl queues, but it guarantees data completeness.
