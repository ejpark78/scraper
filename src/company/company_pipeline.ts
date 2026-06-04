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

        // 임시 파일에서 원시 HTML 콘텐츠 읽기
        const rawHtml = fs.readFileSync(tempHtmlPath, 'utf-8');

        // ⚡ [MongoDB 적재] ⚡
        try {
            const { MongoDatabase } = require('../database/mongo');
            const dbInstance = MongoDatabase.getInstance();

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
            console.log(`📡 [MongoDB Write] Successfully saved Company ID ${id} to bronze.companies and silver.companies.`);
        } catch (dbErr: any) {
            console.error(`❌ [MongoDB Write Error] Failed to write Company ${id} to DB: ${dbErr.message}`);
            throw dbErr;
        } finally {
            // 사용 완료된 임시 HTML 파일 삭제 (디스크 절약)
            if (fs.existsSync(tempHtmlPath)) {
                fs.unlinkSync(tempHtmlPath);
            }
        }

        return {
            mdPath: '', // 마크다운 로컬 저장 해제
            htmlPath: '', // HTML 경로 반환값 비워둠 (로컬 저장 해제)
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
