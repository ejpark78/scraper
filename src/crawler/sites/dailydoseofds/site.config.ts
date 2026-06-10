import type { SiteDescriptor } from '../../core/SiteRegistry';
import { DailyDoseDSConverter } from './Converter';
import { scrapeHttpFetch } from '../../utils/scraper';

export const descriptor: SiteDescriptor = {
  key: 'dailydose_ds',
  name: 'Daily Dose of DS',
  domain: 'dailydoseofds.com',

  scraper: {
    collectionName: 'bronze/dailydose_ds.html',
    targetCollection: 'dailydose_ds.html',
    updateFilterKey: 'id',
    defaultSlack: 3,
    extractId: (url) => {
      return Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
    },
    urlsCollectionName: 'bronze/dailydose_ds.urls',
    scrape: scrapeHttpFetch,
  },

  transformer: {
    converter: new DailyDoseDSConverter(),
    targetCollection: 'dailydose_ds.html',
    filter: (id) => ({ id }),
    completedSetKey: 'completed_news',
  },

  targetLoader: {
    collectionName: 'silver/dailydose_ds.contents',
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
