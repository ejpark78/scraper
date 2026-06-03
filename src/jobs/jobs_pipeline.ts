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
        const targetMdDir = path.join(this.mdDir, meta.locationDirName, meta.postedDate);
        const correctHtmlDir = path.join(this.htmlDir, meta.locationDirName, meta.postedDate);
        const safeMdFileName = NamingUtils.generateSafeFileName(meta.jobTitle, meta.company);
        
        const finalMdPath = path.join(targetMdDir, `${safeMdFileName}.md`);
        const finalHtmlPath = path.join(correctHtmlDir, `${id}.html`);

        // 1) 마크다운 포맷팅 저장
        await this.converter.prettifyAndSave(meta.rawContent, finalMdPath);
        
        // 2) HTML 폴더 생성 및 임시 HTML 이동
        fs.mkdirSync(correctHtmlDir, { recursive: true });
        if (fs.existsSync(finalHtmlPath)) {
            fs.unlinkSync(finalHtmlPath);
        }
        fs.renameSync(tempHtmlPath, finalHtmlPath);

        // 3) 신규 수집본이므로 recent 복사본 저장
        fs.mkdirSync(this.recentHtmlDir, { recursive: true });
        fs.mkdirSync(this.recentMdDir, { recursive: true });

        const recHtmlPath = path.join(this.recentHtmlDir, `${id}.html`);
        const recMdPath = path.join(this.recentMdDir, `${safeMdFileName}.md`);

        fs.copyFileSync(finalHtmlPath, recHtmlPath);
        fs.copyFileSync(finalMdPath, recMdPath);
        console.log('🆕 [신규 추가] 새 공고 복사본을 data/jobs/recent/ 하위에 저장 완료!');

        return {
            mdPath: finalMdPath,
            htmlPath: finalHtmlPath,
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
