/**
 * @module cli-refresh-urls
 * @description Core functionality or script runner for cli-refresh-urls.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies BaseRefreshUrls, SiteRegistry
 * @lastUpdated 2026-06-12
 */

import { BaseRefreshUrls } from './core/BaseRefreshUrls';
import { getSite } from './core/SiteRegistry';

let siteKey = '';
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--site') {
    siteKey = process.argv[i + 1] || '';
    break;
  }
}
if (!siteKey) {
  siteKey = process.argv[2];
}

if (!siteKey) {
  console.error('Usage: npx ts-node src/crawler/cli-refresh-urls.ts --site <siteKey>');
  process.exit(1);
}

const desc = getSite(siteKey);
if (!desc) {
  console.error(`Unknown site key: ${siteKey}`);
  process.exit(1);
}
if (!desc.transformer?.completedSetKey) {
  console.error(`Site ${siteKey} has no transformer.completedSetKey`);
  process.exit(1);
}

const refresh = new BaseRefreshUrls({
  site: desc.key,
  displayName: desc.name,
  cacheSetKey: desc.transformer.completedSetKey,
  legacyQueue: siteKey === 'gpters',
});

refresh.run().catch(console.error);
