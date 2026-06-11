/**
 * @module site.config
 * @description Core functionality or script runner for site.config.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies SiteRegistry, Converter, scraper, crypto
 * @lastUpdated 2026-06-11
 */

import type { SiteDescriptor } from '../../core/SiteRegistry';
import { UppityConverter } from './Converter';
import { scrapeHttpFetch } from '../../utils/scraper';

export const descriptor: SiteDescriptor = {
  key: 'uppity',
  name: 'Uppity',
  domain: 'uppity.co.kr',

  scraper: {
    collectionName: 'bronze/uppity.html',
    targetCollection: 'uppity.html',
    updateFilterKey: 'id',
    defaultSlack: 3,
    extractId: (url) => {
      const crypto = require('crypto');
      return crypto.createHash('md5').update(url).digest('hex');
    },
    urlsCollectionName: 'bronze/uppity.urls',
    scrape: scrapeHttpFetch,
  },

  transformer: {
    converter: new UppityConverter(),
    targetCollection: 'uppity.html',
    filter: (id) => ({ id }),
    statusCollection: 'bronze/uppity.urls',
    completedSetKey: 'completed_uppity',
  },

  targetLoader: {
    collectionName: 'silver/uppity.contents',
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
