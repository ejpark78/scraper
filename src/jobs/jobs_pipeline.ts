import * as fs from 'fs';
import * as path from 'path';
import { BasePipeline } from '../core/BasePipeline';
import { JobMeta, LinkedInMarkdownConverter } from './jobs_converter';
import { LinkedInCrawler } from '../crawler';
import { UrlUtils, NamingUtils } from '../utils';

export class JobsScrapingPipeline extends BasePipeline<JobMeta> {
    private readonly crawler: LinkedInCrawler;
    private readonly converter: LinkedInMarkdownConverter;
    private readonly recentHtmlDir: string;
    private readonly recentMdDir: string;

    constructor() {
        // data/jobs 디렉토리를 기본 경로로 지정
        const baseDir = path.join(__dirname, '..', '..', 'data', 'jobs');
        super(baseDir);
        
        this.crawler = new LinkedInCrawler({ login: process.env.LOGIN === 'true' || process.env.AUTH === 'true' });
        this.converter = new LinkedInMarkdownConverter();
        this.recentHtmlDir = path.join(baseDir, 'recent', 'html');
        this.recentMdDir = path.join(baseDir, 'recent', 'markdown');
    }

    protected extractId(url: string): string {
        return UrlUtils.extractJobId(url);
    }

    protected getDomainName(): string {
        return '채용공고';
    }

    protected async executeScrape(url: string, tempHtmlPath: string): Promise<void> {
        await this.crawler.scrapeJob(url, tempHtmlPath);
    }

    protected processMetadata(htmlContent: string, id: string, url: string): JobMeta {
        // 임시 파일 경로 대신 현재 시각을 기준으로 Date 파싱
        return this.converter.convertHtmlToMarkdown(htmlContent, id, url);
    }

    protected async saveResults(meta: JobMeta, id: string, tempHtmlPath: string): Promise<{ mdPath: string; htmlPath: string; targetDirName: string }> {
        // 임시 파일에서 원시 HTML 콘텐츠 읽기
        const rawHtml = fs.readFileSync(tempHtmlPath, 'utf-8');

        // ⚡ [MongoDB 적재] ⚡
        try {
            const { MongoDatabase } = require('../database/mongo');
            const dbInstance = MongoDatabase.getInstance();

            // 1. Bronze Layer (Raw) 저장
            const bronzeJobs = await dbInstance.getCollection('bronze.jobs');
            await bronzeJobs.updateOne(
                { jobId: id },
                { 
                    $set: { 
                        jobId: id,
                        rawHtml: rawHtml,
                        collectedAt: new Date()
                    } 
                },
                { upsert: true }
            );

            // 2. Silver Layer (Cleansed) 저장
            const silverJobs = await dbInstance.getCollection('silver.jobs');
            const stdLoc = UrlUtils.standardizeLocation(meta.rawLocation);
            await silverJobs.updateOne(
                { jobId: id },
                {
                    $set: {
                        jobId: id,
                        title: meta.jobTitle,
                        companyName: meta.company,
                        companyId: meta.company ? NamingUtils.generateSafeFileName(meta.company, '') : null, 
                        description: meta.rawContent,
                        location: meta.rawLocation,
                        geo: stdLoc || 'Unknown',
                        workStyle: '정보 없음',
                        url: `https://www.linkedin.com/jobs/view/${id}`,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
            console.log(`📡 [MongoDB Write] Successfully saved Job ID ${id} to bronze.jobs and silver.jobs.`);
        } catch (dbErr: any) {
            console.error(`❌ [MongoDB Write Error] Failed to write Job ${id} to DB: ${dbErr.message}`);
            throw dbErr; // DB 적재가 실패할 경우 예외를 전파하여 중단
        } finally {
            // 사용 완료된 임시 HTML 파일 삭제 (디스크 절약)
            if (fs.existsSync(tempHtmlPath)) {
                fs.unlinkSync(tempHtmlPath);
            }
        }

        return {
            mdPath: '', // 마크다운 로컬 저장 해제
            htmlPath: '', // HTML 경로 반환값 비워둠 (로컬 저장 해제)
            targetDirName: `${meta.locationDirName}/${meta.postedDate}`
        };
    }
}

// 스크립트 단독 기동 처리
if (require.main === module) {
    const urlsFile = process.argv[2];
    if (!urlsFile) {
        console.error('❌ 사용법: npx ts-node jobs_pipeline.ts <채용공고_URL_목록_파일_경로>');
        process.exit(1);
    }

    const pipeline = new JobsScrapingPipeline();
    pipeline.run(urlsFile).catch(err => {
        console.error(`❌ 채용공고 파이프라인 구동 실패: ${err.message}`);
        process.exit(1);
    });
}
