/**
 * @module Contents
 * @description Core functionality or script runner for Contents.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies fs, path, BasePipeline, LinkedInMarkdownConverter, LinkedInCrawler, UrlUtils
 * @lastUpdated 2026-06-11
 */

import * as fs from 'fs';
import * as path from 'path';
import { BasePipeline } from '../../../core/BasePipeline';
import { JobMeta, LinkedInMarkdownConverter } from './Converter';
import { LinkedInCrawler } from '../Crawler';
import { UrlUtils } from '../../../utils';

export class LinkedInJobsContents extends BasePipeline<JobMeta> {
    private readonly converter: LinkedInMarkdownConverter;

    constructor() {
        super();
        this.converter = new LinkedInMarkdownConverter();
    }

    protected extractId(url: string): string {
        return UrlUtils.extractJobId(url) || '';
    }

    protected getDomainName(): string {
        return '채용공고';
    }

    protected async executeScrape(url: string, tempHtmlPath: string): Promise<void> {
        const crawler = new LinkedInCrawler({
            login: process.env.LOGIN === 'true' || process.env.AUTH === 'true',
        });
        await crawler.scrapeJob(url, tempHtmlPath);
    }

    protected async processMetadata(htmlContent: string, id: string, url: string): Promise<JobMeta> {
        return this.converter.convertHtmlToMarkdown(htmlContent, id, url);
    }

    protected async saveResults(meta: JobMeta, id: string, tempHtmlPath: string, redisInstance?: any): Promise<{ targetDirName: string }> {
        const { MongoDatabase } = require('../../../../database/mongo');
        const mongo = MongoDatabase.getInstance();
        const config = require('./site.config').descriptor;

        // Save to Bronze Collection
        const bronzeColl = await mongo.getCollection(config.transformer.targetCollection || 'linkedin.jobs', 'bronze');
        await bronzeColl.updateOne(
            { jobId: id },
            {
                $set: {
                    jobId: id,
                    html: fs.readFileSync(tempHtmlPath, 'utf-8'),
                    collectedAt: new Date(),
                }
            },
            { upsert: true }
        );

        // Update URL Status
        const jobUrlsColl = await mongo.getCollection('bronze/linkedin.job_urls');
        await jobUrlsColl.updateOne(
            { jobId: id },
            { $set: { status: 'completed', updatedAt: new Date() } }
        );

        // Save to Silver Collection
        const doc = config.targetLoader.buildDocument(id, meta);
        const silverColl = await mongo.getCollection(config.targetLoader.collectionName || 'silver/linkedin.jobs');
        await silverColl.updateOne(
            { jobId: id },
            { $set: doc },
            { upsert: true }
        );

        // Mark completed in Redis if needed
        if (redisInstance && config.transformer.completedSetKey) {
            await redisInstance.sadd(config.transformer.completedSetKey, id);
        }

        return { targetDirName: 'linkedin.jobs' };
    }
}

if (require.main === module) {
    (async () => {
        const pipeline = new LinkedInJobsContents();
        try {
            await pipeline.run();
        } catch (err: any) {
            console.error(`❌ Pipeline 실행 실패: ${err.message}`);
            process.exit(1);
        }
    })();
}
