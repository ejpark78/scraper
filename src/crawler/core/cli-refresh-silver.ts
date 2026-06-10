import { BaseRefreshSilver } from './BaseRefreshSilver';
import { getSite } from './SiteRegistry';
import { downloadImages } from '../utils/imageDownloader';

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
if (!desc.transformer?.converter) {
  console.error(`Site ${siteKey} has no transformer.converter`);
  process.exit(1);
}
if (!desc.targetLoader?.collectionName) {
  console.error(`Site ${siteKey} has no targetLoader.collectionName`);
  process.exit(1);
}

let afterConvert:
  | ((meta: any, rawContent: string, doc: any) => Promise<any>)
  | undefined;

const imgConfig = desc.refreshSilver?.imageDownload;
if (imgConfig?.enabled) {
  afterConvert = async (meta, rawContent, doc) => {
    const htmlContent =
      imgConfig.htmlSource === 'shortContent' ? meta.shortContent : rawContent;
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
    if (updatedMarkdown !== meta.rawContent) {
      return { ...meta, rawContent: updatedMarkdown };
    }
    return meta;
  };
}

const refresh = new BaseRefreshSilver({
  site: desc.key,
  bronzeCollection: desc.scraper!.collectionName,
  silverCollection: desc.targetLoader.collectionName,
  dataDir: desc.key,
  converter: desc.transformer.converter,
  saveJson: desc.refreshSilver?.saveJson,
  extractId: desc.refreshSilver?.extractId,
  getSilverFields: desc.refreshSilver?.getSilverFields,
  afterConvert,
});

refresh.run().catch(console.error).then(() => process.exit(0));
