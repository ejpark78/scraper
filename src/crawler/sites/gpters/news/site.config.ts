import type { SiteDescriptor } from '../../../core/SiteRegistry';
import { GptersConverter } from '../Converter';
import { scrapeGptersGraphQL } from '../scrape';

function buildGptersDocument(id: string, meta: any): Record<string, any> {
  const doc: Record<string, any> = {
    id,
    title: meta.title || 'Untitled',
    url: meta.url || null,
    author: meta.author || null,
    shortContent: meta.shortContent || null,
    publishedAt: meta.publishedAt || null,
    reactionsCount: meta.reactionsCount || 0,
    repliesCount: meta.repliesCount || 0,
    markdown: meta.rawContent || null,
    updatedAt: new Date(),
  };
  if (meta.spaceId) doc.spaceId = meta.spaceId;
  if (meta.spaceName) doc.spaceName = meta.spaceName;
  if (meta.spaceSlug) doc.spaceSlug = meta.spaceSlug;
  return doc;
}

export const descriptor: SiteDescriptor = {
  key: 'gpters',
  name: 'GPTers News',
  domain: 'gpters.org',

  scraper: {
    collectionName: 'bronze/gpters.html',
    targetCollection: 'gpters.html',
    updateFilterKey: 'postId',
    defaultSlack: 3,
    extractId: (url) => {
      const parts = url.split('-');
      return parts[parts.length - 1] || '';
    },
    urlsCollectionName: 'bronze/gpters.urls',
    scrape: scrapeGptersGraphQL,
  },

  transformer: {
    converter: new GptersConverter(),
    targetCollection: 'gpters.html',
    filter: (id) => ({ $or: [{ postId: id }, { id: id }] }),
    statusCollection: 'bronze/gpters.urls',
    completedSetKey: 'completed_news',
  },

  targetLoader: {
    collectionName: 'silver/gpters.contents',
    filterField: 'id',
    buildDocument: buildGptersDocument,
  },

  refreshSilver: {
    saveJson: true,
    imageDownload: {
      enabled: true,
      htmlSource: 'shortContent',
    },
    getSilverFields: (meta) => ({
      id: meta.id,
      title: meta.title,
      url: meta.url,
      author: meta.author,
      shortContent: meta.shortContent,
      publishedAt: meta.publishedAt,
      reactionsCount: meta.reactionsCount,
      repliesCount: meta.repliesCount,
      markdown: meta.rawContent,
      updatedAt: new Date(),
    }),
  },
};
