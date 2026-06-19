# Plan: Clean Legacy Noise IDs

## Goal
Implement a migration script to clean up legacy crawler URL documents in MongoDB that have trailing Korean grammatical particles (e.g. "를", "에") or URL-encoded particles (e.g. "%EB%A5%BC", "%EC%97%90") attached to their IDs.

## Proposed Changes
1. **Migration Script (`src/scripts/clean_legacy_noise_ids.ts`)**:
   - Loop through all configured site directories.
   - Query `bronze/${siteKey}.urls` for IDs matching the regex `/.*[가-힣%].*/`.
   - Delete the malformed noise documents.
   - For each malformed URL, strip the noise using `UrlUtils.stripTrackingParams(url)`.
   - Check if a document with the clean ID already exists. If not, insert/update the document with status `new` and `pushedToRedis: false` to schedule it for clean re-crawling.
2. **Document Updates**:
   - Update `pipeline_specification.md`, `review_checklist.md`, `troubleshooting.md`, and `CHANGELOG.md`.
   - Generate `ADR 0002` explaining the decision.

## Verification
- Run compilation.
- Run script in dry-run mode or verify DB mutations manually on mongodb.
