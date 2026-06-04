import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import { URLSearchParams } from 'url';
import { UrlUtils, IOUtils, FormatUtils } from '../utils';

// ⚙️ LinkedIn URL 생성, 검색 조건 빌드 및 중복 필터링 통합 OOP 매니저 (TypeScript)

export interface GlobalSettings {
    max_page?: number;
    f_TPR?: string;
    sortBy?: string;
    distance?: string;
    spellCorrectionEnabled?: boolean;
    start?: number;
}

export interface SearchTarget {
    keywords?: string[];
    location?: string;
    geoId?: string;
    max_page?: number;
    start?: number;
}

export interface Config {
    global_settings?: GlobalSettings;
    search_targets?: SearchTarget[];
    direct_urls?: string[];
    geo_registry?: Record<string, string>;
    parameter_registry?: Record<string, Record<string, string>>;
}

export interface GenerateUrlsOptions {
    skipDirectUrls?: boolean;
}

export interface IUrlManager {
    generateUrls(config: Config, options?: GenerateUrlsOptions): string[];
    filterUrls(cachePath: string, urlsPath: string, outputPath: string): Promise<void>;
    extractAndFilterUrls(listsDir: string, htmlDir: string, outputUrlsPath: string): Promise<void>;
}

export class LinkedInUrlManager implements IUrlManager {
    /**
     * Generates absolute LinkedIn job search URLs based on a structured config object.
     */
    public generateUrls(config: Config, options: GenerateUrlsOptions = {}): string[] {
        const skipDirectUrls = !!options.skipDirectUrls;
        const urls: string[] = [];
        const { global_settings, search_targets, direct_urls } = config;
        const globalSettings = global_settings || {};

        const geoRegistry = config.geo_registry || {};
        const parameterRegistry = config.parameter_registry || {};

        let resolved_f_TPR = globalSettings.f_TPR;
        if (resolved_f_TPR && parameterRegistry.f_TPR && parameterRegistry.f_TPR[resolved_f_TPR] !== undefined) {
            resolved_f_TPR = parameterRegistry.f_TPR[resolved_f_TPR];
        }

        let resolved_sortBy = globalSettings.sortBy;
        if (resolved_sortBy && parameterRegistry.sortBy && parameterRegistry.sortBy[resolved_sortBy] !== undefined) {
            resolved_sortBy = parameterRegistry.sortBy[resolved_sortBy];
        }

        // 1. Compile search targets
        if (search_targets && Array.isArray(search_targets)) {
            search_targets.forEach(target => {
                if (!target.keywords || !Array.isArray(target.keywords)) return;
                
                target.keywords.forEach(keyword => {
                    const maxPage = (target.max_page !== undefined) ? target.max_page : globalSettings.max_page;
                    const pageCount = (maxPage && Number.isInteger(maxPage) && maxPage > 0) ? maxPage : 1;

                    for (let i = 0; i < pageCount; i++) {
                        const params = new URLSearchParams();
                        params.append('keywords', keyword);
                        
                        const resolvedGeoId = target.location ? geoRegistry[target.location] : null;
                        
                        if (resolvedGeoId) {
                            params.append('geoId', resolvedGeoId);
                        } else if (target.geoId) {
                            params.append('geoId', target.geoId);
                        } else if (target.location) {
                            params.append('location', target.location);
                        }

                        if (globalSettings.distance) params.append('distance', globalSettings.distance);
                        if (resolved_f_TPR) params.append('f_TPR', resolved_f_TPR);
                        if (resolved_sortBy) params.append('sortBy', resolved_sortBy);
                        if (globalSettings.spellCorrectionEnabled !== undefined) {
                            params.append('spellCorrectionEnabled', String(globalSettings.spellCorrectionEnabled));
                        }
                        
                        const startVal = i * 25;
                        if (startVal > 0) {
                            params.append('start', String(startVal));
                        } else {
                            const explicitStart = (target.start !== undefined) ? target.start : globalSettings.start;
                            if (explicitStart !== undefined && explicitStart > 0) {
                                params.append('start', String(explicitStart));
                            }
                        }

                        urls.push(`https://www.linkedin.com/jobs/search/?${params.toString()}`);
                    }
                });
            });
        }

        // 2. Add direct URLs
        if (!skipDirectUrls && direct_urls && Array.isArray(direct_urls)) {
            direct_urls.forEach(url => {
                if (url && typeof url === 'string' && url.startsWith('http')) {
                    urls.push(url);
                }
            });
        }

        return urls;
    }

    /**
     * ⚡ cache.list에 이미 완료된 JOB_ID의 URL을 urls.txt 대조군에서 O(1) 성능으로 완벽하게 제거하여 정제합니다.
     */
    public async filterUrls(cachePath: string, urlsPath: string, outputPath: string): Promise<void> {
        const cacheSet = new Set<string>();
        if (cachePath && fs.existsSync(cachePath)) {
            try {
                const content = fs.readFileSync(cachePath, 'utf-8');
                content.split(/\r?\n/).forEach(id => {
                    const cleanId = id.trim();
                    if (cleanId) {
                        cacheSet.add(cleanId);
                    }
                });
            } catch (err: any) {
                console.error(`⚠️ 캐시 파일 로드 중 예외 발생: ${err.message}`);
            }
        }

        try {
            if (!fs.existsSync(urlsPath)) {
                console.error(`❌ 원본 URL 파일을 찾을 수 없습니다: ${urlsPath}`);
                process.exit(1);
            }

            const fileStream = fs.createReadStream(urlsPath, 'utf-8');
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            const outputWriter = fs.createWriteStream(outputPath, 'utf-8');

            for await (const line of rl) {
                const trimmedLine = line.trim();
                if (!trimmedLine || trimmedLine.startsWith('#')) {
                    outputWriter.write(line + '\n');
                    continue;
                }

                const jobId = UrlUtils.extractJobId(trimmedLine);
                if (!jobId || !cacheSet.has(jobId)) {
                    outputWriter.write(line + '\n');
                }
            }

            outputWriter.end();

            await new Promise<void>((resolve, reject) => {
                outputWriter.on('finish', () => resolve());
                outputWriter.on('error', (err) => reject(err));
            });
        } catch (err: any) {
            console.error(`❌ 필터링 처리 도중 치명적 오류 발생: ${err.message}`);
            throw err;
        }
    }

    /**
     * 🌟 [완전 마이그레이션] 셸의 find, grep, sed, awk 복잡 연산을 100% 자바스크립트 정규식 파서로 네이티브 이식
     */
    public async extractAndFilterUrls(listsDir: string, htmlDir: string, outputUrlsPath: string): Promise<void> {
        console.log('🔍 로컬/MongoDB에 저장 완료된 HTML 파일들로부터 캐시 ID 목록 생성 중...');
        
        // 1. 📂 이미 소장 완료된 HTML 파일의 ID 세트 수집
        const cacheSet = new Set<string>();
        
        try {
            const { MongoDatabase } = require('../database/mongo');
            const mongo = MongoDatabase.getInstance();
            const bronzeJobs = await mongo.getCollection('bronze.jobs');
            const jobs = await bronzeJobs.find({}, { projection: { jobId: 1, _id: 0 } }).toArray();
            jobs.forEach((job: any) => {
                if (job.jobId && /^\d+$/.test(job.jobId)) {
                    cacheSet.add(job.jobId);
                }
            });
            console.log(`🔌 [MongoDB] bronze.jobs에서 완료된 Job ID ${FormatUtils.formatThousand(cacheSet.size)} 개 로드 완료.`);
        } catch (dbErr: any) {
            console.warn(`⚠️ [MongoDB] 완료된 Job ID 로드 실패: ${dbErr.message}. 로컬 HTML 폴더로 폴백합니다.`);
            if (fs.existsSync(htmlDir)) {
                const localHtmlFiles = IOUtils.getAllFiles(htmlDir, '.html');
                localHtmlFiles.forEach(file => {
                    const id = path.basename(file, '.html');
                    if (id && /^\d+$/.test(id)) {
                        cacheSet.add(id);
                    }
                });
            }
        }

        console.log(`📊 수집 완료된 캐시 인덱스: ${FormatUtils.formatThousand(cacheSet.size)} 개`);
        console.log('🔍 lists/ 및 html/ 내의 파일들에서 채용공고 및 회사 주소(URL)를 정밀 분석 및 추출하는 중...');

        const cheerio = require('cheerio');
        const hrefRegex = /href="([^"]*\/view\/[^"]*)"/g;
        const companyHrefRegex = /href="([^"]*\/comp(?:any|ay)\/[^"]*)"/g;

        const directJobIds = new Set<string>();
        const directJobsMetaMap = new Map<string, any>();
        const recommendedJobIds = new Set<string>();
        const extractedCompanyIds = new Set<string>();
        const masterJobsMetaMap = new Map<string, any>();

        // 0. 💾 기존 urls.json이 존재한다면 masterJobsMetaMap에 미리 채워 캐시로 활용
        if (fs.existsSync(outputUrlsPath)) {
            try {
                const existingData = JSON.parse(fs.readFileSync(outputUrlsPath, 'utf-8'));
                if (Array.isArray(existingData)) {
                    existingData.forEach((item: any) => {
                        if (item && item.jobId) {
                            masterJobsMetaMap.set(item.jobId, item);
                        }
                    });
                    console.log(`💾 기존 urls.json에서 ${FormatUtils.formatThousand(masterJobsMetaMap.size)}개의 메타데이터를 캐시로 로드했습니다.`);
                }
            } catch (e: any) {
                console.warn(`⚠️ 기존 urls.json 로드 실패: ${e.message}`);
            }
        }

        // country.json 로드
        let localCountryMapping: Record<string, string[]> = {};
        try {
            const possiblePaths = [
                path.join(__dirname, '..', '..', 'config', 'country.json'),
                path.join(process.cwd(), 'config', 'country.json'),
                '/app/config/country.json'
            ];
            let countryJsonPath = '';
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    countryJsonPath = p;
                    break;
                }
            }
            if (countryJsonPath) {
                localCountryMapping = JSON.parse(fs.readFileSync(countryJsonPath, 'utf-8'));
                console.log(`🗺️ Loaded country mapping from: ${countryJsonPath}`);
            } else {
                console.warn(`⚠️ Warning: country.json could not be found in any path: ${possiblePaths.join(', ')}`);
            }
        } catch (e: any) {
            console.warn(`⚠️ country.json 로드 실패: ${e.message}`);
        }

        // 2-A. 🔍 lists/ 폴더 하위의 검색 결과 목록 HTML에서 직접 수집된 공고 ID 및 상세 메타 추출
        if (fs.existsSync(listsDir)) {
            const listFiles = IOUtils.getAllFiles(listsDir, '.html');
            let fileCount = 0;
            const cheerio = require('cheerio');
            const companyHrefRegex = /href="([^"]*\/comp(?:any|ay)\/[^"]*)"/g;

            for (const file of listFiles) {
                fileCount++;
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const $ = cheerio.load(content);

                    $('div.job-card-container').each((_: any, el: any) => {
                        let jobId = $(el).attr('data-job-id');
                        const titleLink = $(el).find('a.job-card-list__title--link, a.job-card-container__link').first();
                        const href = titleLink.attr('href') || '';
                        
                        if (!jobId || !/^\d+$/.test(jobId)) {
                            const m = href.match(/currentJobId=(\d+)/) || href.match(/\/view\/(\d+)/);
                            if (m) {
                                jobId = m[1];
                            }
                        }

                        if (!jobId || !/^\d+$/.test(jobId)) {
                            return;
                        }

                        const title = titleLink.text().replace(/\s+/g, ' ').trim();
                        const company = $(el).find('.artdeco-entity-lockup__subtitle, .job-card-container__company-name').text().replace(/\s+/g, ' ').trim();
                        
                        let location = '';
                        let workStyle = '';
                        
                        $(el).find('.job-card-container__metadata-wrapper li, span').each((__: any, item: any) => {
                            const txt = $(item).text().replace(/\s+/g, ' ').trim();
                            if (txt && !txt.includes('logo') && txt.length > 2 && txt.length < 100) {
                                if (/\b(Hybrid|Remote|On-site|하이브리드|재택근무|상주)\b/i.test(txt)) {
                                    workStyle = txt;
                                } else if (txt.includes(',') && !location) {
                                    location = txt;
                                }
                            }
                        });

                        if (!location) {
                            const metadataText = $(el).find('.job-card-container__metadata-wrapper').text().replace(/\s+/g, ' ').trim();
                            if (metadataText) location = metadataText;
                        }

                        const footerText = $(el).find('.job-card-list__footer-wrapper').text().replace(/\s+/g, ' ').trim();

                        // 3개국 타겟 국가 필터링 적용 (South Korea, United Arab Emirates, Japan)
                        const stdLoc = UrlUtils.standardizeLocation(location);
                        const isTargetCountry = stdLoc === 'South Korea' || stdLoc === 'Korea' || stdLoc === 'United Arab Emirates' || stdLoc === 'Japan';

                        if (isTargetCountry) {
                            if (!directJobsMetaMap.has(jobId)) {
                                directJobsMetaMap.set(jobId, {
                                    jobId,
                                    title,
                                    company,
                                    location,
                                    workStyle,
                                    footerText,
                                    url: `https://www.linkedin.com/jobs/view/${jobId}`,
                                    source: 'DIRECT'
                                });
                            }

                            if (!cacheSet.has(jobId)) {
                                directJobIds.add(jobId);
                            }
                        }
                    });

                    // 회사 URL도 검색 결과에서 추출
                    let compMatch;
                    companyHrefRegex.lastIndex = 0;
                    while ((compMatch = companyHrefRegex.exec(content)) !== null) {
                        let url = compMatch[1].trim().split('?')[0].replace(/\/$/, '');
                        if (url.startsWith('/company') || url.startsWith('/compay')) {
                            url = 'https://www.linkedin.com' + url;
                        }
                        if (url.startsWith('http') && (url.includes('/company/') || url.includes('/compay/'))) {
                            const companyId = UrlUtils.extractCompanyId(url);
                            if (companyId) extractedCompanyIds.add(companyId);
                        }
                    }
                } catch (err: any) {
                    console.error(`⚠️ 파일 읽기 오류 [${file}]: ${err.message}`);
                }
                if (fileCount % 100 === 0) await new Promise<void>(resolve => setImmediate(resolve));
            }
        }

        // 2-B. 📂 이미 다운로드 완료된 마크다운 파일 분석하여 상세 메타데이터 선탑재 (전체 마스터 구축용)
        const mdDir = path.join(path.dirname(htmlDir), 'markdown');
        if (fs.existsSync(mdDir)) {
            const mdFiles = IOUtils.getAllFiles(mdDir, '.md');
            mdFiles.forEach(file => {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                    if (!fmMatch) return;

                    const fmContent = fmMatch[1];
                    const meta: Record<string, string> = {};
                    fmContent.split(/\r?\n/).forEach(line => {
                        const parts = line.split(':');
                        if (parts.length >= 2) {
                            const key = parts[0].trim();
                            let value = parts.slice(1).join(':').trim();
                            if (value.startsWith('"') && value.endsWith('"')) {
                                value = value.substring(1, value.length - 1);
                            }
                            meta[key] = value;
                        }
                    });

                    const jobId = meta['job_id'];
                    if (jobId && /^\d+$/.test(jobId)) {
                        const isDirect = directJobsMetaMap.has(jobId);
                        masterJobsMetaMap.set(jobId, {
                            jobId,
                            title: meta['job_title'] || '정보 없음',
                            company: meta['company_name'] || '정보 없음',
                            location: meta['location'] || '정보 없음',
                            workStyle: '정보 없음',
                            url: `https://www.linkedin.com/jobs/view/${jobId}`,
                            source: isDirect ? 'DIRECT' : 'related'
                        });
                    }
                } catch (e) {}
            });
        }

        // 2-C. 🔍 MongoDB bronze.jobs 컬렉션에서 수집완료 상세 페이지 HTML을 가져와 추천/유사 공고 ID 추출 및 추천 카드 파싱
        let dbParsedCount = 0;
        let skipCount = 0;
        try {
            const { MongoDatabase } = require('../database/mongo');
            const mongo = MongoDatabase.getInstance();
            const bronzeColl = await mongo.getCollection('bronze.jobs');
            const cheerio = require('cheerio');

            // 1) 전체 Job ID 목록만 초고속 조회 (rawHtml 제외로 메모리 점유 최소화)
            const allJobIds = await bronzeColl.find({}, { projection: { jobId: 1, _id: 0 } }).toArray();
            const neededJobIds: string[] = [];

            allJobIds.forEach((doc: any) => {
                const currentJobId = doc.jobId;
                if (currentJobId && /^\d+$/.test(currentJobId)) {
                    if (masterJobsMetaMap.has(currentJobId) && masterJobsMetaMap.get(currentJobId)?.geo) {
                        skipCount++;
                    } else {
                        neededJobIds.push(currentJobId);
                    }
                }
            });

            console.log(`🔌 [MongoDB] 분석 대상 문서 수: ${FormatUtils.formatThousand(neededJobIds.length)} 개 (이미 분석된 ${FormatUtils.formatThousand(skipCount)}개 스킵)`);

            // 2) 신규/미분석 건만 1,000개 단위 Chunk로 나누어 조회하여 OOM(Exit 137) 원천 방지
            if (neededJobIds.length > 0) {
                const chunkSize = 1000;
                for (let i = 0; i < neededJobIds.length; i += chunkSize) {
                    const chunk = neededJobIds.slice(i, i + chunkSize);
                    const docs = await bronzeColl.find({ jobId: { $in: chunk } }).toArray();

                    for (const doc of docs) {
                        dbParsedCount++;
                        const currentJobId = doc.jobId;
                        const content = doc.rawHtml || '';

                        try {
                            const $ = cheerio.load(content);

                            $('a[href*="/jobs/view/"]').each((_: any, el: any) => {
                                const href = $(el).attr('href') || '';
                                const jobId = UrlUtils.extractJobId(href);
                                
                                if (!jobId || !/^\d+$/.test(jobId)) return;

                                const isDirect = directJobsMetaMap.has(jobId);

                                // 아직 다운로드되지 않았고 검색 결과에도 없는 경우 추천 대기열에 추가
                                if (!cacheSet.has(jobId) && !directJobsMetaMap.has(jobId)) {
                                    recommendedJobIds.add(jobId);
                                }

                                // master JSON 메타 빌드 (다운로드 완료 기록이 없는 경우에만 추출하여 저장)
                                if (!masterJobsMetaMap.has(jobId)) {
                                    const title = $(el).text().replace(/\s+/g, ' ').trim();
                                    if (!title || title.length < 2) return;

                                    let company = '';
                                    let location = '';

                                    const parent = $(el).closest('li, div, section');
                                    if (parent.length > 0) {
                                        company = parent.find('[class*="company"], [class*="subtitle"]').first().text().replace(/\s+/g, ' ').trim();
                                        const locText = parent.find('[class*="location"], [class*="metadata"]').first().text().replace(/\s+/g, ' ').trim();
                                        if (locText) {
                                            location = locText.split(/\d+\s+days?\s+ago|\d+\s+weeks?\s+ago/i)[0].trim();
                                        }
                                    }

                                    // country.json 기준 맵핑
                                    const stdLoc = UrlUtils.standardizeLocation(location);
                                    let matchedCountry = 'Others';
                                    for (const country of Object.keys(localCountryMapping)) {
                                        if (stdLoc.toLowerCase() === country.toLowerCase()) {
                                            matchedCountry = country;
                                            break;
                                        }
                                    }
                                    if (matchedCountry === 'Others') {
                                        for (const [country, aliases] of Object.entries(localCountryMapping)) {
                                            if (country === 'South Korea' && /[가-힣]/.test(location)) {
                                                matchedCountry = country;
                                                break;
                                            }
                                            const escapedAliases = aliases.map(alias => alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
                                            if (escapedAliases.length > 0) {
                                                const pattern = new RegExp(`\\b(${escapedAliases.join('|')})\\b`, 'i');
                                                if (pattern.test(location)) {
                                                    matchedCountry = country;
                                                    break;
                                                }
                                            }
                                        }
                                    }

                                    masterJobsMetaMap.set(jobId, {
                                        jobId,
                                        title,
                                        company: company || '정보 없음',
                                        location: location || '정보 없음',
                                        workStyle: '정보 없음',
                                        url: `https://www.linkedin.com/jobs/view/${jobId}`,
                                        source: isDirect ? 'DIRECT' : 'related',
                                        geo: matchedCountry
                                    });
                                }
                            });
                        } catch (err: any) {
                            console.error(`⚠️ DB rawHtml 파싱 오류 [Job ID: ${currentJobId}]: ${err.message}`);
                        }
                    }
                    
                    // 메모리 해제 및 동기화 루프 대기 시간 확보
                    await new Promise<void>(resolve => setImmediate(resolve));
                }
            }

            console.log(`🔌 [MongoDB] bronze.jobs에서 총 ${FormatUtils.formatThousand(dbParsedCount)}개의 신규 문서를 분석 완료했습니다.`);
            if (skipCount > 0) {
                console.log(`⚡ 분석 완료된 상세 HTML 문서 ${FormatUtils.formatThousand(skipCount)}개는 분석을 건너뛰었습니다 (캐시 적용).`);
            }
        } catch (dbErr: any) {
            console.warn(`⚠️ [MongoDB] bronze.jobs 분석 실패: ${dbErr.message}. 로컬 HTML 폴더로 폴백합니다.`);
            
            if (fs.existsSync(htmlDir)) {
                const htmlFiles = IOUtils.getAllFiles(htmlDir, '.html');
                const cheerio = require('cheerio');
                let fileCount = 0;
                let localSkipCount = 0;

                for (const file of htmlFiles) {
                    fileCount++;
                    const currentJobId = path.basename(file, '.html');

                    if (masterJobsMetaMap.has(currentJobId) && masterJobsMetaMap.get(currentJobId)?.geo) {
                        localSkipCount++;
                        continue;
                    }

                    try {
                        const content = fs.readFileSync(file, 'utf-8');
                        const $ = cheerio.load(content);

                        $('a[href*="/jobs/view/"]').each((_: any, el: any) => {
                            const href = $(el).attr('href') || '';
                            const jobId = UrlUtils.extractJobId(href);
                            
                            if (!jobId || !/^\d+$/.test(jobId)) return;

                            const isDirect = directJobsMetaMap.has(jobId);

                            if (!cacheSet.has(jobId) && !directJobsMetaMap.has(jobId)) {
                                recommendedJobIds.add(jobId);
                            }

                            if (!masterJobsMetaMap.has(jobId)) {
                                const title = $(el).text().replace(/\s+/g, ' ').trim();
                                if (!title || title.length < 2) return;

                                let company = '';
                                let location = '';

                                const parent = $(el).closest('li, div, section');
                                if (parent.length > 0) {
                                    company = parent.find('[class*="company"], [class*="subtitle"]').first().text().replace(/\s+/g, ' ').trim();
                                    const locText = parent.find('[class*="location"], [class*="metadata"]').first().text().replace(/\s+/g, ' ').trim();
                                    if (locText) {
                                        location = locText.split(/\d+\s+days?\s+ago|\d+\s+weeks?\s+ago/i)[0].trim();
                                    }
                                }

                                const stdLoc = UrlUtils.standardizeLocation(location);
                                let matchedCountry = 'Others';
                                for (const country of Object.keys(localCountryMapping)) {
                                    if (stdLoc.toLowerCase() === country.toLowerCase()) {
                                        matchedCountry = country;
                                        break;
                                    }
                                }
                                if (matchedCountry === 'Others') {
                                    for (const [country, aliases] of Object.entries(localCountryMapping)) {
                                        if (country === 'South Korea' && /[가-힣]/.test(location)) {
                                            matchedCountry = country;
                                            break;
                                        }
                                        const escapedAliases = aliases.map(alias => alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
                                        if (escapedAliases.length > 0) {
                                            const pattern = new RegExp(`\\b(${escapedAliases.join('|')})\\b`, 'i');
                                            if (pattern.test(location)) {
                                                matchedCountry = country;
                                                break;
                                            }
                                        }
                                    }
                                }

                                masterJobsMetaMap.set(jobId, {
                                    jobId,
                                    title,
                                    company: company || '정보 없음',
                                    location: location || '정보 없음',
                                    workStyle: '정보 없음',
                                    url: `https://www.linkedin.com/jobs/view/${jobId}`,
                                    source: isDirect ? 'DIRECT' : 'related',
                                    geo: matchedCountry
                                });
                            }
                        });
                    } catch (err: any) {
                        console.error(`⚠️ 파일 읽기 오류 [${file}]: ${err.message}`);
                    }
                    if (fileCount % 100 === 0) await new Promise<void>(resolve => setImmediate(resolve));
                }

                if (localSkipCount > 0) {
                    console.log(`⚡ 분석 완료된 상세 HTML 파일 ${FormatUtils.formatThousand(localSkipCount)}개는 분석을 건너뛰었습니다 (캐시 적용).`);
                }
            }
        }

        // directJobsMetaMap에 있는 모든 항목을 masterJobsMetaMap에 DIRECT로 갱신 또는 추가
        directJobsMetaMap.forEach((meta, jobId) => {
            const existing = masterJobsMetaMap.get(jobId);
            
            // country.json 기준 맵핑
            const stdLoc = UrlUtils.standardizeLocation(meta.location);
            let matchedCountry = 'Others';
            for (const country of Object.keys(localCountryMapping)) {
                if (stdLoc.toLowerCase() === country.toLowerCase()) {
                    matchedCountry = country;
                    break;
                }
            }
            if (matchedCountry === 'Others') {
                for (const [country, aliases] of Object.entries(localCountryMapping)) {
                    if (country === 'South Korea' && /[가-힣]/.test(meta.location)) {
                        matchedCountry = country;
                        break;
                    }
                    const escapedAliases = aliases.map(alias => alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
                    if (escapedAliases.length > 0) {
                        const pattern = new RegExp(`\\b(${escapedAliases.join('|')})\\b`, 'i');
                        if (pattern.test(meta.location)) {
                            matchedCountry = country;
                            break;
                        }
                    }
                }
            }

            masterJobsMetaMap.set(jobId, {
                jobId,
                title: existing?.title || meta.title || '정보 없음',
                company: existing?.company || meta.company || '정보 없음',
                location: existing?.location || meta.location || '정보 없음',
                workStyle: existing?.workStyle || meta.workStyle || '정보 없음',
                url: meta.url,
                source: 'DIRECT',
                geo: existing?.geo || matchedCountry
            });
        });

        // config.json에서 target locations 로드
        let targetLocations = ['South Korea', 'United Arab Emirates', 'Japan'];
        try {
            const configPath = path.join(__dirname, '..', '..', 'config', 'config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                if (config.search_targets) {
                    targetLocations = config.search_targets.map((t: any) => t.location);
                }
            }
        } catch (e: any) {
            console.warn(`⚠️ config.json 로드 실패, 기본 3개국 타겟 폴백 적용: ${e.message}`);
        }

        // target locations에 부합하는 건들만 필터링하여 큐 파일 및 Redis 주입용 Set 구성
        const filteredDirectJobIds = new Set<string>();
        directJobIds.forEach(jobId => {
            const meta = masterJobsMetaMap.get(jobId);
            if (meta && targetLocations.includes(meta.geo)) {
                filteredDirectJobIds.add(jobId);
            }
        });

        const filteredRecommendedJobIds = new Set<string>();
        recommendedJobIds.forEach(jobId => {
            const meta = masterJobsMetaMap.get(jobId);
            if (meta && targetLocations.includes(meta.geo)) {
                filteredRecommendedJobIds.add(jobId);
            }
        });

        const parentDir = path.dirname(outputUrlsPath);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        // 3-A. 🛡️ 마스터 공고 상세 메타데이터 대상 urls.json 및 history 스냅샷 에 저장 (구분 없음)
        const jsonUrlsPath = path.join(parentDir, 'urls.json');
        const masterList = Array.from(masterJobsMetaMap.values());
        const jsonContent = JSON.stringify(masterList, null, 2);
        fs.writeFileSync(jsonUrlsPath, jsonContent, 'utf-8');
        console.log(`✅ 전체 채용공고(추천 포함) 상세 정보를 ${jsonUrlsPath}에 저장했습니다. 총 ${FormatUtils.formatThousand(masterList.length)} 개.`);

        // 3안: 날짜/시간별 스냅샷 백업 저장
        const historyDir = path.join(parentDir, 'urls');
        if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir, { recursive: true });
        }
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
        const snapshotPath = path.join(historyDir, `${timestamp}.json`);
        fs.writeFileSync(snapshotPath, jsonContent, 'utf-8');
        console.log(`💾 urls.json 스냅샷 백업 저장 완료 ➡️ ${snapshotPath}`);

        // 3-B. 📊 실시간 수집 현황 통계 대시보드 출력
        let totalCount = masterList.length;
        let targetTotal = 0;
        let targetDownloaded = 0;
        
        masterList.forEach((job: any) => {
            const isTarget = targetLocations.includes(job.geo);
            if (isTarget) {
                targetTotal++;
                if (cacheSet.has(job.jobId)) {
                    targetDownloaded++;
                }
            }
        });

        const totalPendingIds = new Set([
            ...filteredDirectJobIds,
            ...filteredRecommendedJobIds
        ]);
        const targetPending = totalPendingIds.size;

        console.log('\n==================================================');
        console.log('📊 [수집 현황 통계 대시보드]');
        console.log('==================================================');
        console.log(`- 전체 수집된 마스터 공고 수량: ${FormatUtils.formatThousand(totalCount)} 개`);
        console.log(`- 타겟 3개국 (${targetLocations.join(', ')}) 총 공고 수량: ${FormatUtils.formatThousand(targetTotal)} 개`);
        console.log(`- 타겟 3개국 이미 수집된 수량 (HTML 소장): ${FormatUtils.formatThousand(targetDownloaded)} 개`);
        console.log(`- 타겟 3개국 신규 크롤링 대상 수량 (Redis 큐 등록): ${FormatUtils.formatThousand(targetPending)} 개`);
        console.log(`  └─ 직접 검색 공고: ${FormatUtils.formatThousand(filteredDirectJobIds.size)} 개`);
        console.log(`  └─ 추천/유사 공고: ${FormatUtils.formatThousand(filteredRecommendedJobIds.size)} 개`);
        console.log('==================================================\n');

        // 4. 🏢 회사 관련 URL을 정규화 및 중복 제거하여 compay/lists/urls.txt 에 저장
        const compayUrlsPath = path.join(__dirname, '..', '..', 'data', 'compay', 'lists', 'urls.txt');
        fs.mkdirSync(path.dirname(compayUrlsPath), { recursive: true });
        const companyWriter = fs.createWriteStream(compayUrlsPath, 'utf-8');
        let companyUrlsCount = 0;

        extractedCompanyIds.forEach(companyId => {
            companyWriter.write(`https://www.linkedin.com/company/${companyId}\n`);
            companyUrlsCount++;
        });

        companyWriter.end();

        await new Promise<void>((resolve, reject) => {
            companyWriter.on('finish', () => resolve());
            companyWriter.on('error', (err) => reject(err));
        });

        console.log(`✅ 총 ${FormatUtils.formatThousand(companyUrlsCount)} 개의 회사 URL을 정규화 및 중복 제거하여 ${compayUrlsPath}에 저장했습니다.`);

        // 5. 🐳 Redis 연동: 기존 대기열을 비우고 신규 생성된 URL 대기열 주입 (필터링된 순수 검색 결과만 전송)
        const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
        try {
            console.log(`📡 [Redis Queue] Connecting to Redis at ${redisUrl} to sync queues...`);
            const Redis = require('ioredis');
            const redis = new Redis(redisUrl, { maxRetriesPerRequest: 1 });
            
            // 연결 제한 시간 설정
            await new Promise<void>((resolve, reject) => {
                const timer = setTimeout(() => {
                    redis.disconnect();
                    reject(new Error('Connection timeout'));
                }, 2000);
                redis.once('connect', () => {
                    clearTimeout(timer);
                    resolve();
                });
            });

            console.log('🧹 [Redis Queue] Clearing existing jobs_queue and company_queue...');
            await redis.del('jobs_queue', 'company_queue');

            if (cacheSet.size > 0) {
                console.log(`📥 [Redis Cache] Synchronizing ${cacheSet.size} downloaded job IDs to Redis set 'completed_jobs'...`);
                const chunkArray = Array.from(cacheSet);
                const chunkSize = 1000;
                for (let i = 0; i < chunkArray.length; i += chunkSize) {
                    const chunk = chunkArray.slice(i, i + chunkSize);
                    await redis.sadd('completed_jobs', ...chunk);
                }
            }

            if (totalPendingIds.size > 0) {
                const jobUrls = Array.from(totalPendingIds).map(id => `https://www.linkedin.com/jobs/view/${id}`);
                console.log(`📥 [Redis Queue] Pushing ${totalPendingIds.size} job URLs to 'jobs_queue'...`);
                
                // Chunk pushing to prevent Redis request limit errors
                const chunkSize = 1000;
                for (let i = 0; i < jobUrls.length; i += chunkSize) {
                    const chunk = jobUrls.slice(i, i + chunkSize);
                    await redis.rpush('jobs_queue', ...chunk);
                }
            }

            if (companyUrlsCount > 0) {
                const companyUrls = Array.from(extractedCompanyIds).map(id => `https://www.linkedin.com/company/${id}`);
                console.log(`📥 [Redis Queue] Pushing ${companyUrlsCount} company URLs to 'company_queue'...`);
                
                const chunkSize = 1000;
                for (let i = 0; i < companyUrls.length; i += chunkSize) {
                    const chunk = companyUrls.slice(i, i + chunkSize);
                    await redis.rpush('company_queue', ...chunk);
                }
            }

            console.log('✅ [Redis Queue] Successfully synchronized all queues in Redis.');
            await redis.quit();
        } catch (redisErr: any) {
            console.warn(`⚠️ [Redis Queue Warning] Redis 연결에 실패하여 대기열 동기화를 건너뜁니다: ${redisErr.message}`);
        }

        // MongoDB 연결 종료
        try {
            const { MongoDatabase } = require('../database/mongo');
            await MongoDatabase.getInstance().close();
        } catch (e) {}
    }

    /**
     * 🚀 직접 실행 컨트롤러 엔트리 메서드
     */
    public async run(): Promise<void> {
        const action = process.argv[2];
        
        if (action === 'filter') {
            const cachePath = process.argv[3];
            const urlsPath = process.argv[4];
            const outputPath = process.argv[5];
            
            if (!urlsPath || !outputPath) {
                console.error('❌ 사용법: npx ts-node url_manager.ts filter <캐시_경로> <URL_원본_경로> <결과_저장_경로>');
                process.exit(1);
            }
            
            await this.filterUrls(cachePath, urlsPath, outputPath);
            process.exit(0);
        } else if (action === 'extract') {
            const listsDir = process.argv[3];
            const htmlDir = process.argv[4];
            const outputUrlsPath = process.argv[5];

            if (!listsDir || !htmlDir || !outputUrlsPath) {
                console.error('❌ 사용법: npx ts-node url_manager.ts extract <목록_디렉토리> <HTML_디렉토리> <결과_저장_경로>');
                process.exit(1);
            }

            await this.extractAndFilterUrls(listsDir, htmlDir, outputUrlsPath);
            process.exit(0);
        }
        
        console.error('❌ 알 수 없는 명령어입니다. 사용법: npx ts-node url_manager.ts [filter|extract] ...');
        process.exit(1);
    }
}

if (require.main === module) {
    new LinkedInUrlManager().run();
}
