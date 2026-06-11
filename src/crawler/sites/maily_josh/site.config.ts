/**
 * @module site.config
 * @description Core functionality or script runner for site.config.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 *   - Excludes auth, sign-in, sign-up, and redirection URLs.
 * @dependencies SiteRegistry, Converter, scraper, crypto
 * @lastUpdated 2026-06-11
 */

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
    excludePatterns: [
      '/users/sign_in',
      '/users/sign_up',
      'redirect_path=',
      '/auth/'
    ],
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
