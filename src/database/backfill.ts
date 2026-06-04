import * as fs from 'fs';
import * as path from 'path';
import { MongoDatabase } from './mongo';
import { IOUtils, NamingUtils, UrlUtils } from '../utils';
import { LinkedInMarkdownConverter } from '../jobs/jobs_converter';
import { CompanyMarkdownConverter } from '../company/company_converter';

// 🚀 로컬 과거 수집 데이터 ➡️ MongoDB 메달리온 백필 마이그레이션 스크립트

const BASE_JOBS_DIR = path.join(__dirname, '..', '..', 'data', 'jobs');
const BASE_COMPANY_DIR = path.join(__dirname, '..', '..', 'data', 'compay');

const jobsConverter = new LinkedInMarkdownConverter();
const companyConverter = new CompanyMarkdownConverter();

async function backfillJobs() {
    console.log('🏁 [Backfill Jobs] 마이그레이션을 시작합니다...');
    const htmlDir = path.join(BASE_JOBS_DIR, 'html');

    if (!fs.existsSync(htmlDir)) {
        console.log('⚠️ [Backfill Jobs] HTML 폴더가 존재하지 않아 생략합니다.');
        return;
    }

    const htmlFiles = IOUtils.getAllFiles(htmlDir, '.html');
    console.log(`📊 [Backfill Jobs] 스캔 완료: 총 ${htmlFiles.length}개의 HTML 파일을 발견했습니다.`);

    const dbInstance = MongoDatabase.getInstance();
    const bronzeJobs = await dbInstance.getCollection('bronze.jobs');
    const silverJobs = await dbInstance.getCollection('silver.jobs');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < htmlFiles.length; i++) {
        const file = htmlFiles[i];
        const jobId = path.basename(file, '.html');

        // 임시 파일은 건너뜁니다.
        if (jobId.startsWith('temp_') || !/^\d+$/.test(jobId)) {
            continue;
        }

        try {
            const rawHtml = fs.readFileSync(file, 'utf-8');
            const url = `https://www.linkedin.com/jobs/view/${jobId}`;

            // 1. Bronze 적재
            await bronzeJobs.updateOne(
                { jobId },
                {
                    $set: {
                        jobId,
                        rawHtml,
                        collectedAt: fs.statSync(file).mtime // 원본 생성/수정일 보존
                    }
                },
                { upsert: true }
            );

            // 2. Silver 정제 및 적재
            const meta = jobsConverter.convertHtmlToMarkdown(rawHtml, jobId, url);
            const stdLoc = UrlUtils.standardizeLocation(meta.rawLocation);

            await silverJobs.updateOne(
                { jobId },
                {
                    $set: {
                        jobId,
                        title: meta.jobTitle,
                        companyName: meta.company,
                        companyId: meta.company ? NamingUtils.generateSafeFileName(meta.company, '') : null,
                        description: meta.rawContent,
                        location: meta.rawLocation,
                        geo: stdLoc || 'Unknown',
                        workStyle: '정보 없음',
                        url,
                        updatedAt: fs.statSync(file).mtime
                    }
                },
                { upsert: true }
            );

            successCount++;
        } catch (err: any) {
            console.error(`❌ [Job ID: ${jobId}] 백필 실패: ${err.message}`);
            failCount++;
        }

        // 100건마다 진행 상황 출력 및 CPU 점유 방지를 위한 이벤트 루프 휴식
        if ((i + 1) % 100 === 0) {
            console.log(`⏳ [Jobs Progress] ${i + 1}/${htmlFiles.length} 진행 중... (성공: ${successCount}, 실패: ${failCount})`);
            await new Promise<void>(resolve => setImmediate(resolve));
        }
    }

    console.log(`✅ [Backfill Jobs] 완료! (성공: ${successCount}, 실패: ${failCount})`);
}

async function backfillCompanies() {
    console.log('🏁 [Backfill Companies] 마이그레이션을 시작합니다...');
    const htmlDir = path.join(BASE_COMPANY_DIR, 'html');

    if (!fs.existsSync(htmlDir)) {
        console.log('⚠️ [Backfill Companies] HTML 폴더가 존재하지 않아 생략합니다.');
        return;
    }

    const htmlFiles = IOUtils.getAllFiles(htmlDir, '.html');
    console.log(`📊 [Backfill Companies] 스캔 완료: 총 ${htmlFiles.length}개의 HTML 파일을 발견했습니다.`);

    const dbInstance = MongoDatabase.getInstance();
    const bronzeCompanies = await dbInstance.getCollection('bronze.companies');
    const silverCompanies = await dbInstance.getCollection('silver.companies');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < htmlFiles.length; i++) {
        const file = htmlFiles[i];
        
        // 회사 파일명에서 ID 추출 시도 (파일명이 대개 회사명.html 형태일 수 있으므로 정규화 처리)
        // 회사 정보의 경우 HTML 파일명이 "회사이름.html" 형태로 저장되어 있는 점 주의.
        const fileName = path.basename(file, '.html');
        // rawHtml 내부에서 스키마 구조 분석용으로 사용
        try {
            const rawHtml = fs.readFileSync(file, 'utf-8');
            const fakeUrl = `https://www.linkedin.com/company/${fileName}`;
            const meta = companyConverter.convertHtmlToMarkdown(rawHtml, fileName, fakeUrl);
            const companyId = meta.companyId || fileName;

            // 1. Bronze 적재
            await bronzeCompanies.updateOne(
                { companyId },
                {
                    $set: {
                        companyId,
                        rawHtml,
                        collectedAt: fs.statSync(file).mtime
                    }
                },
                { upsert: true }
            );

            // 2. Silver 적재
            let countryDir = 'Unknown';
            if (meta.hqCountry && meta.hqCountry !== '정보 없음') {
                countryDir = NamingUtils.convertCountryCodeToName(meta.hqCountry);
            }

            await silverCompanies.updateOne(
                { companyId },
                {
                    $set: {
                        companyId,
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
                        updatedAt: fs.statSync(file).mtime
                    }
                },
                { upsert: true }
            );

            successCount++;
        } catch (err: any) {
            console.error(`❌ [Company: ${fileName}] 백필 실패: ${err.message}`);
            failCount++;
        }

        if ((i + 1) % 100 === 0) {
            console.log(`⏳ [Companies Progress] ${i + 1}/${htmlFiles.length} 진행 중... (성공: ${successCount}, 실패: ${failCount})`);
            await new Promise<void>(resolve => setImmediate(resolve));
        }
    }

    console.log(`✅ [Backfill Companies] 완료! (성공: ${successCount}, 실패: ${failCount})`);
}

async function run() {
    try {
        await backfillJobs();
        await backfillCompanies();
    } catch (e: any) {
        console.error(`❌ 백필 중 오류 발생: ${e.message}`);
    } finally {
        await MongoDatabase.getInstance().close();
        process.exit(0);
    }
}

run();
