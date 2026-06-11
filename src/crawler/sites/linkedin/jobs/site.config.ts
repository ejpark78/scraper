/**
 * @module site.config
 * @description Core functionality or script runner for site.config.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies SiteRegistry, Converter, Crawler, utils
 * @lastUpdated 2026-06-11
 */

import type { SiteDescriptor } from '../../../core/SiteRegistry';
import { LinkedInMarkdownConverter } from './Converter';
import { LinkedInCrawler } from '../Crawler';
import { UrlUtils } from '../../../utils';
import { NamingUtils } from '../../../utils';

async function scrapeLinkedinJob(url: string, tempPath: string): Promise<void> {
  const crawler = new LinkedInCrawler({
    login: process.env.LOGIN === 'true' || process.env.AUTH === 'true',
  });
  await crawler.scrapeJob(url, tempPath);
}

export const descriptor: SiteDescriptor = {
  key: 'linkedin',
  name: 'LinkedIn Jobs',
  favicon: 'https://www.linkedin.com/favicon.ico',

  indexes: [
    { collection: 'bronze/linkedin.jobs', fields: { jobId: 1 }, options: { unique: true } },
    { collection: 'bronze/linkedin.jobs', fields: { collectedAt: -1 } },
    { collection: 'bronze/linkedin.lists', fields: { listId: 1 } },
    { collection: 'bronze/linkedin.lists', fields: { collectedAt: 1 } },
    { collection: 'bronze/linkedin.job_urls', fields: { jobId: 1 } },
    { collection: 'bronze/linkedin.job_urls', fields: { status: 1, jobId: 1 } },
    { collection: 'silver/linkedin.jobs', fields: { jobId: 1 }, options: { unique: true } },
    { collection: 'silver/linkedin.jobs', fields: { location: 1 } },
    {
      collection: 'silver/linkedin.jobs',
      fields: { title: 'text', companyName: 'text', description: 'text', markdown: 'text' },
      options: {
        weights: { title: 10, companyName: 5, description: 3, markdown: 2 },
        name: 'text_idx',
      },
    },
  ],

  scraper: {
    collectionName: 'bronze/linkedin.jobs',
    targetCollection: 'linkedin.jobs',
    updateFilterKey: 'jobId',
    defaultSlack: 0,
    extractId: (url) => UrlUtils.extractJobId(url) || '',
    excludePatterns: ['favicon', 'login', 'logout', 'signup'],
    scrape: scrapeLinkedinJob,
  },

  transformer: {
    converter: new LinkedInMarkdownConverter(),
    targetCollection: 'linkedin.jobs',
    filter: (id) => ({ jobId: id }),
    statusCollection: 'bronze/linkedin.job_urls',
    statusFilterField: 'jobId',
    completedSetKey: 'completed_jobs',
  },

  targetLoader: {
    collectionName: 'silver/linkedin.jobs',
    filterField: 'jobId',
    buildDocument: (id, meta) => {
      const stdLoc = UrlUtils.standardizeLocation(meta.rawLocation);
      const companyId = meta.company ? NamingUtils.generateSafeFileName(meta.company, '') : null;
      return {
        jobId: id,
        title: meta.jobTitle || 'Untitled',
        companyName: meta.company || null,
        companyId,
        description: meta.rawContent || null,
        location: meta.rawLocation || null,
        geo: stdLoc || 'Unknown',
        workStyle: '정보 없음',
        url: `https://www.linkedin.com/jobs/view/${id}`,
        updatedAt: new Date(),
      };
    },
  },
};
