# Redis Queue & Cache Namespace Restructuring Plan

## Goal
Restructure the Redis queue keys and completion cache keys to adopt a unified, site-centric namespace format:
- Queues: `sites:${siteKey}:scrape:${priority}`
- Completion Cache Sets: `sites:${siteKey}:completed`

This prevents cross-site cache collision bugs (such as multiple sites sharing `completed_news`) and provides cleaner monitoring, clearing, and maintenance.

## Proposed Changes

### Configuration Updates
- Change all `site.config.ts` completed set keys to follow the pattern `sites:${siteKey}:completed`.
- Modify `BaseListService` to:
  - Default `cacheSetKey` to `sites:${siteKey}:completed`.
  - Push items to queue `sites:${siteKey}:scrape:${priority}`.

### Core Pipelines & Workers
- **ScraperWorker**: Listen to `sites:${siteKey}:scrape:${priority}`.
- **ConverterWorker**: Mark complete in `sites:${siteKey}:completed`.
- **BaseRefreshUrls**: Update referenced keys.

### Utility Scripts & Diagnostics
- **queue.ts**: Scan keys matching `sites:*:scrape:*` and `sites:*:completed`.
- **fix-urls.ts / clean_josh_urls.ts**: Clean namespace keys.

### Dashboard & Viewer UI
- **server.ts / App.vue**: Update dashboard keys parsing to display clean labels.

## Verification Plan
1. Compile code and check for static analysis errors.
2. Run single site list command to ensure cache is seeded and new items are correctly queued under the new format.
3. Validate through queue status tool.
