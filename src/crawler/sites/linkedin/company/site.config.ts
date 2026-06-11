/**
 * @module site.config
 * @description Core functionality or script runner for site.config.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies SiteRegistry, Converter
 * @lastUpdated 2026-06-11
 */

import type { SiteDescriptor } from '../../../core/SiteRegistry';
import { CompanyMarkdownConverter } from './Converter';

export const descriptor: SiteDescriptor = {
  key: 'linkedin_company',
  name: 'LinkedIn Company',
  favicon: 'https://www.linkedin.com/favicon.ico',

  indexes: [
    { collection: 'bronze/linkedin.companies', fields: { companyId: 1 }, options: { unique: true } },
    { collection: 'bronze/linkedin.company_urls', fields: { companyId: 1 } },
    { collection: 'bronze/linkedin.company_urls', fields: { status: 1, companyId: 1 } },
    { collection: 'silver/linkedin.companies', fields: { companyId: 1 }, options: { unique: true } },
  ],

  transformer: {
    converter: new CompanyMarkdownConverter(),
    targetCollection: 'linkedin.companies',
    filter: (id) => ({ companyId: id }),
    completedSetKey: 'completed_jobs',
  },

  targetLoader: {
    collectionName: 'silver/linkedin.companies',
    filterField: 'companyId',
    buildDocument: (id, meta) => ({
      companyId: id,
      companyName: meta.companyName || 'Unknown Company',
      tagline: meta.tagline || null,
      website: meta.website || null,
      industry: meta.industry || null,
      companySize: meta.companySize || null,
      description: meta.hqDescription || null,
      updatedAt: new Date(),
    }),
  },
};
