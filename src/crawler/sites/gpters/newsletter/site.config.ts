/**
 * @module site.config
 * @description Core functionality or script runner for site.config.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 *   - Ensures extracted post IDs are strictly alphanumeric Bettermode IDs to prevent malformed queries.
 * @dependencies SiteRegistry, Converter, scrape
 * @lastUpdated 2026-06-11
 */

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
      const id = parts[parts.length - 1] || '';
      return /^[a-zA-Z0-9]+$/.test(id) ? id : '';
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

  refreshSilver: {
    saveJson: true,
    extractId: (doc) => doc.id || doc.postId || '',
    getSilverFields: (meta) => ({
      id: meta.id,
      title: meta.title,
      url: meta.url,
      author: meta.author,
      shortContent: meta.shortContent,
      publishedAt: meta.publishedAt,
      reactionsCount: meta.reactionsCount,
      repliesCount: meta.repliesCount,
      markdown: meta.rawContent,
      updatedAt: new Date(),
    }),
  },
};
