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
        console.log('🔍 로컬에 저장 완료된 HTML 파일들로부터 캐시 ID 목록 생성 중...');
        
        // 1. 📂 이미 소장 완료된 HTML 파일의 ID 세트 수집
        const localHtmlFiles = IOUtils.getAllFiles(htmlDir, '.html');
        const cacheSet = new Set<string>();
        localHtmlFiles.forEach(file => {
            const id = path.basename(file, '.html');
            if (id && /^\d+$/.test(id)) {
                cacheSet.add(id);
            }
        });

        console.log(`📊 수집 완료된 캐시 인덱스: ${FormatUtils.formatThousand(cacheSet.size)} 개`);
        console.log('🔍 lists/ 및 html/ 내의 파일들에서 채용공고 및 회사 주소(URL)를 정밀 분석 및 추출하는 중...');

        // 2. 🔍 lists/ 및 html/ 폴더 하위의 모든 HTML에서 링크 추출
        const targetHtmlDirs = [listsDir, htmlDir];
        const allHtmlFiles: string[] = [];
        targetHtmlDirs.forEach(dir => {
            if (fs.existsSync(dir)) {
                allHtmlFiles.push(...IOUtils.getAllFiles(dir, '.html'));
            }
        });

        const extractedJobIds = new Set<string>();
        const extractedCompanyIds = new Set<string>();

        // HTML 본문에서 링크를 추출하기 위한 정밀 정규식 패턴 (/jobs/view/숫자 혹은 /view/숫자)
        // 예: href="https://www.linkedin.com/jobs/view/4416396794/"
        const hrefRegex = /href="([^"]*\/view\/[^"]*)"/g;
        // /company/ 또는 /compay/ 가 들어간 링크 추출 패턴
        const companyHrefRegex = /href="([^"]*\/comp(?:any|ay)\/[^"]*)"/g;

        let fileCount = 0;
        for (const file of allHtmlFiles) {
            fileCount++;
            try {
                let content: string | null = fs.readFileSync(file, 'utf-8');
                
                // 채용공고 URL 추출
                let match;
                hrefRegex.lastIndex = 0;
                while ((match = hrefRegex.exec(content)) !== null) {
                    let url = match[1].trim();
                    if (!url) continue;

                    // A. Canonical 가공: 쿼리 파라미터(?...) 제거 및 끝 슬래시 제거
                    url = url.split('?')[0].replace(/\/$/, '');

                    // B. 상대 경로를 절대 주소로 안전 복원
                    if (url.startsWith('/jobs')) {
                        url = 'https://www.linkedin.com' + url;
                    }

                    if (url.startsWith('http') && url.includes('/view/')) {
                        const jobId = UrlUtils.extractJobId(url);
                        if (jobId && !cacheSet.has(jobId)) {
                            extractedJobIds.add(jobId);
                        }
                    }
                }

                // 회사 URL 추출
                let compMatch;
                companyHrefRegex.lastIndex = 0;
                while ((compMatch = companyHrefRegex.exec(content)) !== null) {
                    let url = compMatch[1].trim();
                    if (!url) continue;

                    // A. Canonical 가공: 쿼리 파라미터(?...) 제거 및 끝 슬래시 제거
                    url = url.split('?')[0].replace(/\/$/, '');

                    // B. 상대 경로를 절대 주소로 안전 복원
                    if (url.startsWith('/company') || url.startsWith('/compay')) {
                        url = 'https://www.linkedin.com' + url;
                    }

                    if (url.startsWith('http') && (url.includes('/company/') || url.includes('/compay/'))) {
                        const companyId = UrlUtils.extractCompanyId(url);
                        if (companyId) {
                            extractedCompanyIds.add(companyId);
                        }
                    }
                }

                // 메모리 누수 방지 및 릴리즈 촉진
                content = null;

            } catch (err: any) {
                console.error(`⚠️ 파일 읽기 오류 [${file}]: ${err.message}`);
            }

            // ⚡ 메모리 OOM 방지 핵심: 100개 파일마다 Node.js 이벤트 루프에 제어권을 양보하여 V8 GC 동작 유도
            if (fileCount % 100 === 0) {
                await new Promise<void>(resolve => setImmediate(resolve));
            }
        }

        const parentDir = path.dirname(outputUrlsPath);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        // 3. 🛡️ 수집본(cacheSet)에 있는 ID를 사전 배제(필터링)하여 최종 신규 대상 urls.txt 적재
        let newUrlsCount = 0;
        const outputWriter = fs.createWriteStream(outputUrlsPath, 'utf-8');

        extractedJobIds.forEach(jobId => {
            outputWriter.write(`https://www.linkedin.com/jobs/view/${jobId}\n`);
            newUrlsCount++;
        });

        outputWriter.end();

        await new Promise<void>((resolve, reject) => {
            outputWriter.on('finish', () => resolve());
            outputWriter.on('error', (err) => reject(err));
        });

        console.log(`✅ 이미 수집된 대상을 제외하고 총 ${FormatUtils.formatThousand(newUrlsCount)} 개의 신규 URL을 ${outputUrlsPath}에 깔끔하게 저장했습니다.`);

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

        // 5. 🐳 Redis 연동: 기존 대기열을 비우고 신규 생성된 URL 대기열 주입
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

            if (newUrlsCount > 0) {
                const jobUrls = Array.from(extractedJobIds).map(id => `https://www.linkedin.com/jobs/view/${id}`);
                console.log(`📥 [Redis Queue] Pushing ${newUrlsCount} job URLs to 'jobs_queue'...`);
                
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
