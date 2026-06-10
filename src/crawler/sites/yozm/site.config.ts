import type { SiteDescriptor } from '../../core/SiteRegistry';
import { YozmConverter } from './Converter';
import { scrapeHttpFetch } from '../../utils/scraper';

export const descriptor: SiteDescriptor = {
  key: 'yozm',
  name: '요즘IT',
  domain: 'yozm.wishket.com',

  scraper: {
    collectionName: 'bronze/yozm.html',
    targetCollection: 'yozm.html',
    updateFilterKey: 'id',
    defaultSlack: 3,
    extractId: (url) => {
      const match = url.match(/\/detail\/(\d+)\//);
      return match ? match[1] : '';
    },
    urlsCollectionName: 'bronze/yozm.urls',
    scrape: scrapeHttpFetch,
  },

  transformer: {
    converter: new YozmConverter(),
    targetCollection: 'yozm.html',
    filter: (id) => ({ id }),
    statusCollection: 'bronze/yozm.urls',
    completedSetKey: 'completed_yozm',
  },

  targetLoader: {
    collectionName: 'silver/yozm.contents',
    filterField: 'id',
    buildDocument: (id, meta) => ({
      id,
      title: meta.title || 'Untitled',
      url: meta.url || null,
      publishedAt: meta.publishedAt || null,
      content: meta.content || null,
      markdown: meta.rawContent || null,
      updatedAt: new Date(),
    }),
  },
};
