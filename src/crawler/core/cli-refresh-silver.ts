import { getSite } from './SiteRegistry';
import { BaseRefreshTransform } from './BaseRefreshTransform';
import { BaseRefreshSilver } from './BaseRefreshSilver';

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

if (overwrite) {
  console.log(`🚀 OVERWRITE=true: Running FULL REBUILD for ${siteKey}...`);
  if (!desc.transformer?.converter || !desc.targetLoader?.collectionName) {
    console.error(`Site ${siteKey} is missing transformer/converter or targetLoader collectionName`);
    process.exit(1);
  }

  const refreshSilver = new BaseRefreshSilver({
    site: desc.key,
    bronzeCollection: desc.scraper!.collectionName,
    silverCollection: desc.targetLoader.collectionName,
    dataDir: desc.key,
    converter: desc.transformer.converter,
    saveJson: desc.refreshSilver?.saveJson,
    extractId: desc.refreshSilver?.extractId,
    getSilverFields: desc.refreshSilver?.getSilverFields,
    afterConvert: async (meta, rawContent, doc) => {
        const imgConfig = desc.refreshSilver?.imageDownload;
        if (!imgConfig?.enabled) return meta;
        const { downloadImages } = await import('../utils/imageDownloader');
        const htmlContent = imgConfig.htmlSource === 'shortContent' ? meta.shortContent : rawContent;
        if (!htmlContent) return meta;
        const { updatedMarkdown } = await downloadImages({
            htmlContent,
            markdown: meta.rawContent,
            publishedAt: meta.publishedAt,
            docId: meta.id,
            siteDir: desc.key,
            siteDomain: desc.domain || desc.key,
            refererUrl: doc.url,
            removeFavicons: imgConfig.removeFavicons,
        });
        return updatedMarkdown !== meta.rawContent ? { ...meta, rawContent: updatedMarkdown } : meta;
    }
  });
  refreshSilver.run().catch(console.error).then(() => process.exit(0));
} else {
  console.log(`🔄 Running INCREMENTAL refresh for ${siteKey}...`);
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
}
