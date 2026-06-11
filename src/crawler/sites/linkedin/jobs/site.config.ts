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

  scraper: {
    collectionName: 'bronze/linkedin.jobs',
    targetCollection: 'linkedin.jobs',
    updateFilterKey: 'jobId',
    defaultSlack: 0,
    extractId: (url) => UrlUtils.extractJobId(url) || '',
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
