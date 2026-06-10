import type { SiteDescriptor } from '../../../core/SiteRegistry';
import { GptersConverter } from '../Converter';
import { scrapeGptersGraphQL } from '../scrape';

function buildGptersNewsletterDocument(id: string, meta: any): Record<string, any> {
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
  key: 'gpters_newsletter',
  name: 'GPTers Newsletter',
  domain: 'gpters.org',

  scraper: {
    collectionName: 'bronze/gpters_newsletter.html',
    targetCollection: 'gpters_newsletter.html',
    updateFilterKey: 'id',
    defaultSlack: 3,
    extractId: (url) => {
      const parts = url.split('-');
      return parts[parts.length - 1] || '';
    },
    urlsCollectionName: 'bronze/gpters_newsletter.urls',
    scrape: scrapeGptersGraphQL,
  },

  transformer: {
    converter: new GptersConverter(),
    targetCollection: 'gpters_newsletter.html',
    filter: (id) => ({ id }),
    statusCollection: 'bronze/gpters_newsletter.urls',
    completedSetKey: 'completed_gpters_newsletter',
  },

  targetLoader: {
    collectionName: 'silver/gpters_newsletter.contents',
    filterField: 'id',
    buildDocument: buildGptersNewsletterDocument,
  },
};
