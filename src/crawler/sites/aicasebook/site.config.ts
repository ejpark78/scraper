/**
 * @module site.config
 * @description Core functionality or script runner for site.config.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies SiteRegistry, Converter, scraper
 * @lastUpdated 2026-06-11
 */

import type { SiteDescriptor } from '../../core/SiteRegistry';
import { AiCasebookConverter } from './Converter';
import { scrapeHttpFetch } from '../../utils/scraper';

export const descriptor: SiteDescriptor = {
  key: 'aicasebook',
  name: 'AI Casebook',
  domain: 'aicasebook.dev',

  scraper: {
    collectionName: 'bronze/aicasebook.html',
    targetCollection: 'aicasebook.html',
    updateFilterKey: 'id',
    defaultSlack: 3,
    extractId: (url) => {
      const match = url.match(/\/setup\/(\d+)/);
      return match ? match[1] : '';
    },
    urlsCollectionName: 'bronze/aicasebook.urls',
    scrape: scrapeHttpFetch,
  },

  transformer: {
    converter: new AiCasebookConverter(),
    targetCollection: 'aicasebook.html',
    filter: (id) => ({ id }),
    statusCollection: 'bronze/aicasebook.urls',
    completedSetKey: 'completed_aicasebook',
  },

  targetLoader: {
    collectionName: 'silver/aicasebook.contents',
    filterField: 'id',
    buildDocument: (id, meta) => ({
      id,
      title: meta.title || 'Untitled',
      url: meta.url || null,
      summary: meta.summary || null,
      author: meta.author || null,
      categories: meta.categories || [],
      tags: meta.tags || [],
      publishedAt: meta.publishedAt || null,
      views: meta.views || 0,
      sourceLink: meta.sourceLink || null,
      seriesName: meta.seriesName || null,
      body: meta.body || null,
      markdown: meta.rawContent || null,
      updatedAt: new Date(),
    }),
  },
};
