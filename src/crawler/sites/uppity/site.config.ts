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
  favicon: 'https://uppity.co.kr/favicon.ico',

  indexes: [
    { collection: 'bronze/uppity.html', fields: { id: 1 }, options: { unique: true } },
    { collection: 'bronze/uppity.urls', fields: { id: 1 }, options: { unique: true } },
    { collection: 'bronze/uppity.urls', fields: { status: 1, id: 1 } },
    { collection: 'silver/uppity.contents', fields: { id: 1 }, options: { unique: true } },
    { collection: 'silver/uppity.contents', fields: { publishedAt: -1 } },
    {
      collection: 'silver/uppity.contents',
      fields: { title: 'text', content: 'text', markdown: 'text', url: 'text' },
      options: {
        weights: { title: 10, content: 5, markdown: 3, url: 1 },
        name: 'text_idx',
      },
    },
  ],

  scraper: {
    collectionName: 'bronze/uppity.html',
    targetCollection: 'uppity.html',
    updateFilterKey: 'id',
    defaultSlack: 3,
    extractId: (url) => {
      const crypto = require('crypto');
      return crypto.createHash('md5').update(url).digest('hex');
    },
    excludePatterns: ['logout.cm', 'login', 'join', 'signup', 'favicon', 'logout'],
    urlsCollectionName: 'bronze/uppity.urls',
    scrape: scrapeHttpFetch,
    generateUrls: (config: { page?: number, section?: string }): string[] => {
      const page = config.page || 1;
      const section = config.section || 'news';
      return [page === 1
          ? `https://uppity.co.kr/category/${section}/`
          : `https://uppity.co.kr/category/${section}/page/${page}/`];
    },
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
