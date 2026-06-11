/**
 * @module cli-refresh-silver
 * @description Core functionality or script runner for cli-refresh-silver.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies SiteRegistry, BaseRefreshTransform
 * @lastUpdated 2026-06-11
 */

import { getSite } from './SiteRegistry';
import { BaseRefreshTransform } from './BaseRefreshTransform';

const siteKey = process.argv[2];
if (!siteKey) {
  console.error('Usage: npx ts-node src/crawler/core/cli-refresh-silver.ts <siteKey>');
  process.exit(1);
}

const desc = getSite(siteKey);
if (!desc) {
  console.error(`Unknown site key: ${siteKey}`);
  process.exit(1);
}

const overwrite = process.env.OVERWRITE === 'true';

console.log(`🔄 Running refresh for ${siteKey} (Queue-based)...`);
if (!desc.scraper?.collectionName) {
  console.error(`Site ${siteKey} has no scraper.collectionName`);
  process.exit(1);
}

const refreshTransform = new BaseRefreshTransform({
  site: desc.key,
  bronzeCollection: desc.scraper.collectionName,
  idExtract: siteKey === 'gpters' ? (doc: any) => doc.id || doc.postId : undefined,
  includeUrlInPayload: siteKey === 'gpters',
});
refreshTransform.run().catch(console.error).then(() => process.exit(0));
