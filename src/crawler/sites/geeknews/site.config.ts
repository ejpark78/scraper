/**
 * @module site.config
 * @description Core functionality or script runner for site.config.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies SiteRegistry, Converter, scraper
 * @lastUpdated 2026-06-11
 */

import type { SiteDescriptor } from '../../core/SiteRegistry';
import { GeekNewsConverter } from './Converter';
import { scrapeHttpFetch } from '../../utils/scraper';

export const descriptor: SiteDescriptor = {
  key: 'geeknews',
  name: 'GeekNews',
  domain: 'news.hada.io',
  favicon: 'https://news.hada.io/favicon.ico',

  indexes: [
    { collection: 'bronze/geeknews.html', fields: { id: 1 }, options: { unique: true } },
    { collection: 'bronze/geeknews.urls', fields: { id: 1 }, options: { unique: true } },
    { collection: 'bronze/geeknews.urls', fields: { status: 1, id: 1 } },
    { collection: 'silver/geeknews.contents', fields: { id: 1 }, options: { unique: true } },
    { collection: 'silver/geeknews.contents', fields: { publishedAt: -1 } },
    {
      collection: 'silver/geeknews.contents',
      fields: { title: 'text', content: 'text', markdown: 'text', url: 'text', companyName: 'text' },
      options: {
        weights: { title: 10, content: 5, markdown: 3, url: 1, companyName: 3 },
        name: 'text_idx',
      },
    },
  ],

  scraper: {
    collectionName: 'bronze/geeknews.html',
    targetCollection: 'geeknews.html',
    updateFilterKey: 'topicId',
    defaultSlack: 3,
    extractId: (url) => {
      const match = url.match(/[?&]id=(\d+)/);
      return match ? match[1] : '';
    },
    excludePatterns: ['vote?', '/vote', 'user?', '/user', 'item?', 'favicon', 'login', 'logout', 'signup'],
    urlsCollectionName: 'bronze/geeknews.urls',
    scrape: scrapeHttpFetch,
    generateUrls: (config: { page?: number }): string[] => {
      const page = config.page || 1;
      if (page > 1) {
        return [page <= 5 ? `https://news.hada.io/?page=${page}` : `https://news.hada.io/past?page=${page}`];
      }
      return ['https://news.hada.io/'];
    },
  },

  transformer: {
    converter: new GeekNewsConverter(),
    targetCollection: 'geeknews.html',
    filter: (id) => ({ topicId: id }),
    statusCollection: 'bronze/geeknews.urls',
    completedSetKey: 'completed_news',
  },

  targetLoader: {
    collectionName: 'silver/geeknews.contents',
    filterField: 'id',
    buildDocument: (id, meta) => ({
      id,
      title: meta.title || 'Untitled',
      url: meta.url || null,
      content: meta.content || null,
      comments: meta.comments || null,
      jsonLdRaw: meta.jsonLdRaw || null,
      markdown: meta.rawContent || null,
      updatedAt: new Date(),
    }),
  },

  refreshSilver: {
    getSilverFields: (meta) => ({
      id: meta.id,
      title: meta.title,
      url: meta.url,
      publishedAt: meta.publishedAt,
      content: meta.content,
      comments: meta.comments,
      jsonLdRaw: meta.jsonLdRaw,
      markdown: meta.rawContent,
      updatedAt: new Date(),
    }),
  },
};
