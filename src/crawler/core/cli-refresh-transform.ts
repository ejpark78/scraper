import { BaseRefreshTransform } from './BaseRefreshTransform';
import { getSite } from './SiteRegistry';

const siteKey = process.argv[2];
if (!siteKey) {
  console.error('Usage: npx ts-node src/crawler/core/cli-refresh-transform.ts <siteKey>');
  process.exit(1);
}

const desc = getSite(siteKey);
if (!desc) {
  console.error(`Unknown site key: ${siteKey}`);
  process.exit(1);
}
if (!desc.scraper?.collectionName) {
  console.error(`Site ${siteKey} has no scraper.collectionName`);
  process.exit(1);
}

const idExtract = siteKey === 'gpters'
  ? (doc: any) => doc.id || doc.postId
  : undefined;

const refresh = new BaseRefreshTransform({
  site: desc.key,
  bronzeCollection: desc.scraper.collectionName,
  idExtract,
  includeUrlInPayload: siteKey === 'gpters',
});

refresh.run().catch(console.error);
