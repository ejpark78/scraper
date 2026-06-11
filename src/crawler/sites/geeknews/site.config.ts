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

  scraper: {
    collectionName: 'bronze/geeknews.html',
    targetCollection: 'geeknews.html',
    updateFilterKey: 'topicId',
    defaultSlack: 3,
    extractId: (url) => {
      if (url.includes('id=')) {
        return url.split('id=').pop()!.split('&')[0];
      }
      return '';
    },
    urlsCollectionName: 'bronze/geeknews.urls',
    scrape: scrapeHttpFetch,
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
