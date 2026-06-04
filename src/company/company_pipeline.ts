import * as fs from 'fs';
import * as path from 'path';
import { BasePipeline } from '../core/BasePipeline';
import { CompanyMeta, CompanyMarkdownConverter } from './company_converter';
import { LinkedInCrawler } from '../crawler';
import { UrlUtils, NamingUtils } from '../utils';

export class CompanyScrapingPipeline extends BasePipeline<CompanyMeta> {
    private readonly crawler: LinkedInCrawler;
    private readonly converter: CompanyMarkdownConverter;

    constructor() {
        // data/compay 디렉토리를 기본 경로로 지정
        super(path.join(__dirname, '..', '..', 'data', 'compay'));
        this.crawler = new LinkedInCrawler({ login: process.env.LOGIN === 'true' || process.env.AUTH === 'true' });
        this.converter = new CompanyMarkdownConverter();
    }

    protected extractId(url: string): string {
        return UrlUtils.extractCompanyId(url);
    }

    protected getDomainName(): string {
        return '회사정보';
    }

    protected async executeScrape(url: string, tempHtmlPath: string): Promise<void> {
        await this.crawler.scrapeCompanyAbout(url, tempHtmlPath);
    }

    protected processMetadata(htmlContent: string, id: string, url: string): CompanyMeta {
        return this.converter.convertHtmlToMarkdown(htmlContent, id, url);
    }

    protected async saveResults(meta: CompanyMeta, id: string, tempHtmlPath: string): Promise<{ mdPath: string; htmlPath: string; targetDirName: string }> {
        // 국가 코드 ➡️ 표준 영문 국가명 변환
        let countryDir = 'Unknown';
        if (meta.hqCountry && meta.hqCountry !== '정보 없음') {
            countryDir = NamingUtils.convertCountryCodeToName(meta.hqCountry);
        }

        const safeFileName = meta.companyName
            .replace(/[\/\\:\*\?"<>\|]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim() || id;

        const finalHtmlDir = path.join(this.htmlDir, countryDir);
        const finalMdDir = path.join(this.mdDir, countryDir);

        fs.mkdirSync(finalHtmlDir, { recursive: true });
        fs.mkdirSync(finalMdDir, { recursive: true });

        const finalMdPath = path.join(finalMdDir, `${safeFileName}.md`);
        const finalHtmlPath = path.join(finalHtmlDir, `${safeFileName}.html`);

        // 1) 마크다운 포맷팅 저장
        await this.converter.prettifyAndSave(meta.rawContent, finalMdPath);
        
        // 2) 임시 HTML 파일을 최종 회사명 HTML로 이동
        if (fs.existsSync(finalHtmlPath)) {
            fs.unlinkSync(finalHtmlPath); // 중복 덮어쓰기 대비 제거
        }
        fs.renameSync(tempHtmlPath, finalHtmlPath);

        // ⚡ [MongoDB 이중 쓰기 (Dual Write)] ⚡
        try {
            const { MongoDatabase } = require('../database/mongo');
            const dbInstance = MongoDatabase.getInstance();
            const rawHtml = fs.readFileSync(finalHtmlPath, 'utf-8');

            // 1. Bronze Layer (Raw) 저장
            const bronzeCompanies = await dbInstance.getCollection('bronze.companies');
            await bronzeCompanies.updateOne(
                { companyId: id },
                { 
                    $set: { 
                        companyId: id,
                        rawHtml: rawHtml,
                        collectedAt: new Date()
                    } 
                },
                { upsert: true }
            );

            // 2. Silver Layer (Cleansed) 저장
            const silverCompanies = await dbInstance.getCollection('silver.companies');
            await silverCompanies.updateOne(
                { companyId: id },
                {
                    $set: {
                        companyId: id,
                        companyName: meta.companyName,
                        tagline: meta.tagline || '',
                        website: meta.website || '',
                        industry: meta.industry || '정보 없음',
                        companySize: meta.companySize || '정보 없음',
                        employeeCount: meta.employeeCount || '정보 없음',
                        hqCountry: countryDir,
                        hqState: meta.hqGeographicArea || '',
                        hqCity: meta.hqCity || '',
                        founded: meta.founded || '정보 없음',
                        specialties: meta.specialties || '',
                        description: meta.hqDescription || '',
                        rawContent: meta.rawContent,
                        updatedAt: new Date()
                    }
                },
                { upsert: true }
            );
            console.log(`📡 [MongoDB Dual Write] Successfully saved Company ID ${id} to bronze.companies and silver.companies.`);
        } catch (dbErr: any) {
            console.warn(`⚠️ [MongoDB Dual Write Warning] Failed to write Company ${id} to DB (falling back to disk only): ${dbErr.message}`);
        }

        return {
            mdPath: finalMdPath,
            htmlPath: finalHtmlPath,
            targetDirName: countryDir
        };
    }
}

// 스크립트 단독 기동 처리
if (require.main === module) {
    const urlsFile = process.argv[2];
    if (!urlsFile) {
        console.error('❌ 사용법: npx ts-node company_pipeline.ts <회사_URL_목록_파일_경로>');
        process.exit(1);
    }

    const pipeline = new CompanyScrapingPipeline();
    pipeline.run(urlsFile).catch(err => {
        console.error(`❌ 회사 파이프라인 구동 실패: ${err.message}`);
        process.exit(1);
    });
}
