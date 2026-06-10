import { BaseRefreshUrls } from './BaseRefreshUrls';
import { getSite } from './SiteRegistry';

const siteKey = process.argv[2];
if (!siteKey) {
  console.error('Usage: npx ts-node src/crawler/core/cli-refresh-urls.ts <siteKey>');
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
