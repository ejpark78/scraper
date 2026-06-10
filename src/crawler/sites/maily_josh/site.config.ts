import type { SiteDescriptor } from '../../core/SiteRegistry';
import { MailyJoshConverter } from './Converter';
import { scrapeHttpFetch } from '../../utils/scraper';

export const descriptor: SiteDescriptor = {
  key: 'maily_josh',
  name: '조쉬의 뉴스레터 (Maily)',
  domain: 'maily.so',

  scraper: {
    collectionName: 'bronze/maily_josh.html',
    targetCollection: 'maily_josh.html',
    updateFilterKey: 'id',
    defaultSlack: 3,
    extractId: (url) => {
      const crypto = require('crypto');
      return crypto.createHash('md5').update(url).digest('hex');
    },
    urlsCollectionName: 'bronze/maily_josh.urls',
    scrape: scrapeHttpFetch,
  },

  transformer: {
    converter: new MailyJoshConverter(),
    targetCollection: 'maily_josh.html',
    filter: (id) => ({ id }),
    statusCollection: 'bronze/maily_josh.urls',
    completedSetKey: 'completed_maily_josh',
  },

  targetLoader: {
    collectionName: 'silver/maily_josh.contents',
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
