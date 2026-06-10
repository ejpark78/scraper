import type { SiteDescriptor } from '../../../core/SiteRegistry';
import { CompanyMarkdownConverter } from './Converter';

export const descriptor: SiteDescriptor = {
  key: 'linkedin_company',
  name: 'LinkedIn Company',

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
