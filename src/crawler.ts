import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { LinkedInUrlManager, Config } from './jobs/url_manager';
import { HtmlMinifier, DateUtils, UrlUtils } from './utils';

// ⚙️ LinkedIn Playwright 스크래퍼 및 인증 통합 OOP 엔진 (TypeScript)

export interface ICrawler {
    login(): Promise<void>;
    scrapeJob(url: string, outputPath: string): Promise<void>;
    scrapeList(configFilePath: string): Promise<void>;
    scrapeCompanyAbout(url: string, outputPath: string): Promise<void>;
}

export class LinkedInCrawler implements ICrawler {
    private readonly sessionPath: string = path.join(__dirname, '..', 'config', 'session.json');
    private readonly useLogin: boolean;

    constructor(options: { login?: boolean } = {}) {
        this.useLogin = options.login !== undefined ? options.login : (process.env.LOGIN === 'true' || process.env.AUTH === 'true');
    }

    /**
     * 지능형 스크롤 함수: 레이아웃 변화에 상관없이 채용 공고 카드가 다 나타나도록 스크롤다운 유도
     */
    private async autoScroll(page: Page): Promise<void> {
        console.log('🖱️  [목록 스크롤] 카드 로딩을 위해 채용 공고 패널을 스크롤하고 있습니다...');
        await page.evaluate(async () => {
            const selectors = [
                '.jobs-search-results-list',
                '.scaffold-layout__list',
                'div[data-job-id]',
                'main section'
            ];

            let container: HTMLElement | null = null;
            for (const sel of selectors) {
                const el = document.querySelector(sel) as HTMLElement | null;
                if (el) {
                    container = (el.closest('[class*="scroll"]') || el.closest('[class*="list"]') || el) as HTMLElement;
                    break;
                }
            }

            const scrollTarget = container || window;
            
            await new Promise<void>((resolve) => {
                let totalHeight = 0;
                const distance = 120;
                const timer = setInterval(() => {
                    const scrollHeight = (scrollTarget instanceof Window) ? document.body.scrollHeight : scrollTarget.scrollHeight;
                    
                    if (scrollTarget instanceof Window) {
                        window.scrollBy(0, distance);
                    } else {
                        scrollTarget.scrollBy(0, distance);
                    }
                    totalHeight += distance;

                    if (totalHeight >= scrollHeight || totalHeight > 10000) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 150);
            });
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    /**
     * 1회성 로그인 인증 세션 획득 로직
     */
    public async login(): Promise<void> {
        console.log('🌐 1회성 로그인 인증 브라우저를 구동합니다...');
        const configDir = path.dirname(this.sessionPath);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        const browser: Browser = await chromium.launch({
            headless: false,
            args: ['--disable-blink-features=AutomationControlled']
        });
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 },
            locale: 'en-US'
        });

        // 🛡️ Google OAuth 로그인 시 "This browser or app may not be secure" 에러 방지를 위한 webdriver 감지 우회
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });
        });

        const page: Page = await context.newPage();

        console.log('📡 LinkedIn 로그인 페이지로 이동합니다. 인증을 완료해 주세요...');
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

        try {
            await page.waitForURL('**/feed/**', { timeout: 300000 });
            console.log('✅ 로그인이 성공적으로 감지되었습니다!');
            
            await context.storageState({ path: this.sessionPath });
            console.log(`💾 인증 토큰 세션 정보 저장 완료 ➡️ ${this.sessionPath}`);
        } catch (err: any) {
            console.error(`⚠️ 로그인 상태 수집 시간 초과 혹은 오류 발생: ${err.message}`);
        } finally {
            await browser.close();
        }
    }

    /**
     * 단일 공고 내용 크롤러 (더보기 버튼 클릭 지원)
     */
    public async scrapeJob(url: string, outputPath: string): Promise<void> {
        const isLoggedIn = this.useLogin && fs.existsSync(this.sessionPath);
        const isHeadless = process.env.HEADLESS !== 'false';
        const browser: Browser = await chromium.launch({
            headless: isHeadless,
            args: ['--disable-blink-features=AutomationControlled']
        });
        
        try {
            const contextOptions: any = {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 800 },
                locale: 'en-US'
            };
            if (isLoggedIn) {
                contextOptions.storageState = this.sessionPath;
            }

            const context = await browser.newContext(contextOptions);
            await context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
            });
            const page: Page = await context.newPage();

            console.log('🌐 [1/4] 브라우저 기동 및 페이지 이동 중...');
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await new Promise(resolve => setTimeout(resolve, 2000));

            const title = await page.title();
            if (title.includes('Sign In') || title.includes('로그인')) {
                throw new Error('⚠️ 세션 만료 또는 로그인 요청 화면 감지됨');
            }

            console.log(`🔗 [2/4] 페이지 로딩 완료: ${decodeURIComponent(url)}`);

            const showMoreSelector = 'button.show-more-less-html__button--more, button[aria-label*="show more" i], button.jobs-description__footer-button';
            const button = await page.$(showMoreSelector);
            if (button) {
                console.log('🖱️ [3/4] 버튼 발견, 클릭하여 본문 확장 중...');
                try {
                    // 🛡️ Playwright의 물리적 마우스 가로채기(Overlay interception) 타임아웃 오류를 완벽히 차단하기 위해 DOM 자바스크립트 직접 클릭 발송
                    await page.evaluate((selector) => {
                        const el = document.querySelector(selector) as HTMLElement | null;
                        if (el) el.click();
                    }, showMoreSelector);
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (clickErr: any) {
                    console.warn(`⚠️ 본문 확장 클릭 도중 예외 발생 (스킵하지 않고 로드된 HTML은 그대로 보존 수집함): ${clickErr.message}`);
                }
            } else {
                console.log('💡 [3/4] 추가로 확장할 더 보기 버튼이 없습니다.');
            }

            console.log('💾 [4/4] 렌더링 완료! 파일 저장 중...');
            const htmlContent = await page.content();
            const minifiedHtml = await HtmlMinifier.minify(htmlContent);
            
            const parentDir = path.dirname(outputPath);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }
            fs.writeFileSync(outputPath, minifiedHtml, 'utf-8');
            console.log(`✨ 백업 성공 (압축 및 포맷팅 완료: ${(minifiedHtml.length / 1024).toFixed(1)} KB) -> ${outputPath}`);

        } finally {
            await browser.close();
        }
    }

    /**
     * 회사 정보 (/about/ 페이지) 크롤러
     */
    public async scrapeCompanyAbout(url: string, outputPath: string): Promise<void> {
        const isLoggedIn = this.useLogin && fs.existsSync(this.sessionPath);
        if (!isLoggedIn) {
            console.warn('⚠️ [경고] 로그인 세션 파일(session.json)이 없거나 login 옵션이 활성화되지 않아 비로그인으로 동작합니다. 회사 정보 스크래핑은 실패할 확률이 매우 높습니다.');
        }

        // URL 정규화: 끝에 /about/ 이 없으면 자동으로 추가
        let targetUrl = url.trim();
        if (!targetUrl.replace(/\/$/, '').endsWith('/about')) {
            targetUrl = targetUrl.replace(/\/$/, '') + '/about/';
        }

        const isHeadless = process.env.HEADLESS !== 'false';
        const browser: Browser = await chromium.launch({
            headless: isHeadless,
            args: ['--disable-blink-features=AutomationControlled']
        });
        
        try {
            const contextOptions: any = {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 800 },
                locale: 'en-US'
            };
            if (isLoggedIn) {
                contextOptions.storageState = this.sessionPath;
            }

            const context = await browser.newContext(contextOptions);
            await context.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
            });
            const page: Page = await context.newPage();

            console.log(`🌐 [1/4] 브라우저 기동 및 회사 정보 페이지 이동 중... (${decodeURIComponent(targetUrl)})`);
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // 페이지 타이틀 체크
            const title = await page.title();
            if (title.includes('Sign In') || title.includes('로그인') || title.includes('Sign Up') || page.url().includes('authwall')) {
                throw new Error('⚠️ 세션 만료 또는 로그인 요청 화면(Auth Wall) 감지됨');
            }

            console.log(`🔗 [2/4] 페이지 로딩 완료 (타이틀: ${title})`);
            
            // 비동기 하이드레이션 완료를 위한 핵심 셀렉터 대기
            console.log('⏳ [3/4] 회사 정보 카드 렌더링 대기 중...');
            try {
                await page.waitForSelector('.org-page-details-module__card-spacing, dl', { timeout: 10000 });
            } catch (selErr) {
                console.warn('⚠️ 회사 세부 정보 카드가 10초 이내에 나타나지 않았습니다. 계속해서 덤프를 진행합니다.');
            }

            console.log('💾 [4/4] 렌더링 완료! 파일 저장 중...');
            const htmlContent = await page.content();
            const minifiedHtml = await HtmlMinifier.minify(htmlContent);
            
            const parentDir = path.dirname(outputPath);
            if (!fs.existsSync(parentDir)) {
                fs.mkdirSync(parentDir, { recursive: true });
            }
            fs.writeFileSync(outputPath, minifiedHtml, 'utf-8');
            console.log(`✨ 회사 정보 백업 성공 (압축 및 포맷팅 완료: ${(minifiedHtml.length / 1024).toFixed(1)} KB) -> ${outputPath}`);

        } finally {
            await browser.close();
        }
    }

    /**
     * 채용 목록 배치 수집 크롤러
     */
    public async scrapeList(configFilePath: string): Promise<void> {
        const isLoggedIn = this.useLogin && fs.existsSync(this.sessionPath);
        if (!isLoggedIn) {
            console.log('⚠️  [안내] 로그인 세션 파일(session.json)이 발견되지 않았거나 login 옵션이 활성화되지 않아 비로그인(Public) 모드로 동작합니다.');
            console.log('💡 direct_urls는 수집 대상에서 자동으로 제외되며, 일반 검색 결과 수집만 진행합니다.');
        }

        if (!fs.existsSync(configFilePath)) {
            throw new Error(`지정한 입력 대상 설정 파일을 찾을 수 없습니다: ${configFilePath}`);
        }

        console.log('🚀 [시작] 링크드인 채용 목록 백그라운드 수집을 시작합니다.');

        const ext = path.extname(configFilePath).toLowerCase();
        let urls: string[] = [];

        if (ext === '.json') {
            const config: Config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
            const urlManager = new LinkedInUrlManager();
            urls = urlManager.generateUrls(config, { skipDirectUrls: !isLoggedIn });
        } else {
            urls = fs.readFileSync(configFilePath, 'utf-8')
                .split(/\r?\n/)
                .map(line => {
                    let clean = line.trim();
                    if (clean.endsWith('\\')) {
                        clean = clean.slice(0, -1).trim();
                    }
                    return clean;
                })
                .filter(line => line.length > 0 && !line.startsWith('#') && line.startsWith('http'));
        }

        if (urls.length === 0) {
            console.log('💡 [안내] 수집할 채용 목록 URL이 없습니다. config.json 또는 config.list 내용을 확인해 주세요.');
            return;
        }

        console.log(`📋 총 ${urls.length} 개의 목록 URL이 감지되었습니다.`);

        const parallelLimit = parseInt(process.env.PARALLEL || '1', 10);
        console.log(`⚙️  동시 작업 스레드(Playwright) 제한 설정: ${parallelLimit}개`);

        const isHeadless = process.env.HEADLESS !== 'false';
        const browser: Browser = await chromium.launch({
            headless: isHeadless,
            args: ['--disable-blink-features=AutomationControlled']
        });
        
        try {
            const contextOptions: any = {
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                viewport: { width: 1280, height: 800 },
                locale: 'en-US'
            };
            if (isLoggedIn) {
                contextOptions.storageState = this.sessionPath;
            }

            const loginStatus = isLoggedIn ? '[AUTHED]' : '[UNAUTHED]';
            const startTime = Date.now();
            let currentIndex = 0;

            const runDate = new Date();
            const pad = (n: number) => String(n).padStart(2, '0');
            const batchFolderName = `${runDate.getFullYear()}${pad(runDate.getMonth() + 1)}${pad(runDate.getDate())}_${pad(runDate.getHours())}${pad(runDate.getMinutes())}${pad(runDate.getSeconds())}`;

            const worker = async (url: string) => {
                currentIndex++;
                const myIndex = currentIndex;
                
                const d = new Date();
                const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}_${pad(d.getMinutes())}_${pad(d.getSeconds())}_${Math.random().toString(36).substring(2, 6)}`;

                // 진행 시간 및 ETR(예상 완료 시간) 계산
                const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
                const runtimeStr = DateUtils.formatSeconds(elapsedSeconds);
                
                let etrStr = '계산 중...';
                if (myIndex > 1) {
                    const completedCount = myIndex - 1;
                    const remainingCount = urls.length - completedCount;
                    const avgSpeed = elapsedSeconds / completedCount;
                    const remainingSeconds = Math.floor(avgSpeed * remainingCount);
                    etrStr = DateUtils.formatSeconds(remainingSeconds);
                }

                console.log(`\n──────────────────────────────────────────────────`);
                console.log(`📡 [${myIndex}/${urls.length}][${runtimeStr}/${etrStr}]${loginStatus} 목록 수집 중: ${decodeURIComponent(url)}`);
                console.log(`──────────────────────────────────────────────────`);

                const context = await browser.newContext(contextOptions);
                await context.addInitScript(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                });
                const page = await context.newPage();

                try {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
                    await new Promise(resolve => setTimeout(resolve, 3000));

                    const title = await page.title();
                    if (title.includes('Sign In') || title.includes('로그인') || title.includes('Security Challenge')) {
                        console.error('⚠️  [경고] 로그인 또는 보안 인증(Captcha) 화면이 감지되었습니다.');
                        if (isLoggedIn) {
                            console.error('💡 세션이 만료되었을 수 있으니 다시 [make login]을 실행하여 로그인 상태를 갱신해 주세요.');
                        } else {
                            console.log('💡 비로그인 모드로 동작 중 발생한 제한입니다. 전체 데이터를 수집하려면 [make login]을 통해 세션을 덤프한 후 실행해 주세요.');
                        }
                        throw new Error('AUTH_FAIL');
                    }

                    await this.autoScroll(page);

                    const htmlContent = await page.content();
                    const minifiedHtml = await HtmlMinifier.minify(htmlContent);

                    // ⚡ [MongoDB 적재] ⚡
                    try {
                        const { MongoDatabase } = require('./database/mongo');
                        const dbInstance = MongoDatabase.getInstance();
                        const bronzeLists = await dbInstance.getCollection('bronze.lists');
                        await bronzeLists.updateOne(
                            { listId: timestamp },
                            {
                                $set: {
                                    listId: timestamp,
                                    listUrl: url,
                                    rawHtml: minifiedHtml,
                                    batchId: batchFolderName,
                                    collectedAt: new Date()
                                }
                            },
                            { upsert: true }
                        );
                        console.log(`📡 [MongoDB Write] Successfully saved List ID ${timestamp} to bronze.lists. (${(minifiedHtml.length / 1024).toFixed(1)} KB)`);

                        // ⚡ [대안 A] 자동 URL 추출 및 Redis 큐 적재 실행
                        await this.extractAndPushJobs(minifiedHtml, url);
                    } catch (dbErr: any) {
                        console.error(`❌ [MongoDB Write Error] Failed to write list to DB: ${dbErr.message}`);
                    }
                } finally {
                    await context.close();
                }
            };

            const executing = new Set<Promise<void>>();
            let authFailed = false;

            for (const url of urls) {
                if (authFailed) break;

                const p = worker(url).catch((err) => {
                    if (err.message === 'AUTH_FAIL') {
                        authFailed = true;
                    } else {
                        console.error(`⚠️ URL 수집 실패 (${url}): ${err.message}`);
                    }
                }).then(() => {
                    executing.delete(p);
                });
                executing.add(p);
                
                if (executing.size >= parallelLimit) {
                    await Promise.race(executing);
                }
            }
            await Promise.all(executing);

            if (authFailed) {
                console.log('\n🛑 로그인 세션 또는 인증 오류로 인해 작업을 중단했습니다.');
            } else {
                console.log('\n🎉 모든 목록 URL의 무인 백그라운드 수집을 정상적으로 마쳤습니다!');
            }
        } finally {
            await browser.close();
        }
    }

    /**
     * ⚡ [대안 A] 목록 수집 완료 시 자동 URL 추출 및 Redis 큐 적재
     */
    private async extractAndPushJobs(htmlContent: string, listUrl: string): Promise<void> {
        try {
            console.log(`🔍 [Auto-Extract] Extracting job URLs from list: ${decodeURIComponent(listUrl)}`);
            const cheerio = require('cheerio');
            const $ = cheerio.load(htmlContent);
            const { MongoDatabase } = require('./database/mongo');
            const dbInstance = MongoDatabase.getInstance();
            const jobUrlsColl = await dbInstance.getCollection('bronze.job_urls');
            const companyUrlsColl = await dbInstance.getCollection('bronze.company_urls');
            const bronzeJobs = await dbInstance.getCollection('bronze.jobs');

            const redisUrl = process.env.REDIS_URL || 'redis://redis:6379';
            const Redis = require('ioredis');
            const redis = new Redis(redisUrl);

            // 1. target locations 로드
            let targetLocations = ['South Korea', 'United Arab Emirates', 'Japan'];
            try {
                const configPath = path.join(__dirname, '..', 'config', 'config.json');
                if (fs.existsSync(configPath)) {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    if (config.search_targets) {
                        targetLocations = config.search_targets.map((t: any) => t.location);
                    }
                }
            } catch (e: any) {}

            // 2. country mapping 로드
            let countryMapping: Record<string, string[]> = {};
            try {
                const countryJsonPath = path.join(__dirname, '..', 'config', 'country.json');
                if (fs.existsSync(countryJsonPath)) {
                    countryMapping = JSON.parse(fs.readFileSync(countryJsonPath, 'utf-8'));
                }
            } catch (e: any) {}

            const parseGeo = (loc: string): string => {
                const std = UrlUtils.standardizeLocation(loc);
                if (std === 'unknown-location') return 'Others';
                for (const country of Object.keys(countryMapping)) {
                    if (std.toLowerCase() === country.toLowerCase()) return country;
                }
                for (const [country, aliases] of Object.entries(countryMapping)) {
                    if (country === 'South Korea' && /[가-힣]/.test(loc)) return country;
                    const escapedAliases = aliases.map(alias => alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
                    if (escapedAliases.length > 0) {
                        const pattern = new RegExp(`\\b(${escapedAliases.join('|')})\\b`, 'i');
                        if (pattern.test(loc)) return country;
                    }
                }
                return 'Others';
            };

            // 3. 완료된 캐시 로드
            const completedCache = new Set<string>();
            const completedDocs = await bronzeJobs.find({}, { projection: { jobId: 1, _id: 0 } }).toArray();
            completedDocs.forEach((d: any) => {
                if (d.jobId) completedCache.add(d.jobId);
            });

            // 4. Job URL 추출
            const foundJobs: any[] = [];
            $('a[href*="/jobs/view/"]').each((_: any, el: any) => {
                const href = $(el).attr('href') || '';
                const jobId = UrlUtils.extractJobId(href);
                if (!jobId || !/^\d+$/.test(jobId)) return;

                const title = $(el).text().replace(/\s+/g, ' ').trim();
                if (!title || title.length < 2) return;

                let company = '정보 없음';
                let location = '정보 없음';

                const parent = $(el).closest('li, div, section');
                if (parent.length > 0) {
                    const companyText = parent.find('[class*="company"], [class*="subtitle"]').first().text().replace(/\s+/g, ' ').trim();
                    if (companyText) company = companyText;
                    const locText = parent.find('[class*="location"], [class*="metadata"]').first().text().replace(/\s+/g, ' ').trim();
                    if (locText) {
                        location = locText.split(/\d+\s+days?\s+ago|\d+\s+weeks?\s+ago/i)[0].trim();
                    }
                }

                const geo = parseGeo(location);
                if (targetLocations.includes(geo)) {
                    foundJobs.push({
                        jobId,
                        title,
                        company,
                        location,
                        geo,
                        url: `https://www.linkedin.com/jobs/view/${jobId}`
                    });
                }
            });

            // 5. 회사 URL 추출 및 MongoDB 저장
            const companyHrefRegex = /href="([^"]*\/comp(?:any|ay)\/[^"]*)"/g;
            let compMatch;
            companyHrefRegex.lastIndex = 0;
            while ((compMatch = companyHrefRegex.exec(htmlContent)) !== null) {
                let url = compMatch[1].trim().split('?')[0].replace(/\/$/, '');
                if (url.startsWith('/company') || url.startsWith('/compay')) {
                    url = 'https://www.linkedin.com' + url;
                }
                if (url.startsWith('http') && (url.includes('/company/') || url.includes('/compay/'))) {
                    const companyId = UrlUtils.extractCompanyId(url);
                    if (companyId) {
                        await companyUrlsColl.updateOne(
                            { companyId },
                            {
                                $set: {
                                    companyId,
                                    url: `https://www.linkedin.com/company/${companyId}`,
                                    status: 'new',
                                    updatedAt: new Date()
                                },
                                $setOnInsert: { pushedToRedis: false }
                            },
                            { upsert: true }
                        );
                    }
                }
            }

            // 6. DB 저장 및 Redis 큐 적재
            let pushedCount = 0;
            for (const job of foundJobs) {
                const isCompleted = completedCache.has(job.jobId);
                const currentDoc = await jobUrlsColl.findOne({ jobId: job.jobId });
                const alreadyPushed = currentDoc?.pushedToRedis === true;

                await jobUrlsColl.updateOne(
                    { jobId: job.jobId },
                    {
                        $set: {
                            jobId: job.jobId,
                            url: job.url,
                            title: job.title,
                            company: job.company,
                            location: job.location,
                            geo: job.geo,
                            source: 'DIRECT',
                            status: isCompleted ? 'completed' : 'new',
                            updatedAt: new Date()
                        },
                        $setOnInsert: {
                            pushedToRedis: isCompleted ? true : false
                        }
                    },
                    { upsert: true }
                );

                if (!isCompleted && !alreadyPushed) {
                    await redis.rpush('jobs_queue', job.url);
                    await jobUrlsColl.updateOne(
                        { jobId: job.jobId },
                        { $set: { pushedToRedis: true } }
                    );
                    pushedCount++;
                }
            }
            if (foundJobs.length > 0) {
                console.log(`📋 [Auto-Extract Details] Extracted target jobs:\n${JSON.stringify(foundJobs, null, 2)}`);
            }
            console.log(`✅ [Auto-Extract] Extracted ${foundJobs.length} target jobs. Pushed ${pushedCount} new jobs to Redis jobs_queue.`);
            await redis.quit();
        } catch (err: any) {
            console.error(`❌ [Auto-Extract Error] Failed to extract/push: ${err.message}`);
        }
    }

    /**
     * 🚀 직접 실행 컨트롤러 엔트리 메서드
     */
    public async run(): Promise<void> {
        const command = process.argv[2];

        try {
            if (command === 'login') {
                await this.login();
                process.exit(0);
            } else if (command === 'job') {
                const url = process.argv[3];
                const outputPath = process.argv[4];
                if (!url || !outputPath) {
                    console.error('❌ 사용법: npx ts-node crawler.ts job <공고_URL> <저장_HTML_경로>');
                    process.exit(1);
                }
                await this.scrapeJob(url, outputPath);
                process.exit(0);
            } else if (command === 'list') {
                const configFile = process.argv[3];
                if (!configFile) {
                    console.error('❌ 사용법: npx ts-node crawler.ts list <설정_파일_경로>');
                    process.exit(1);
                }
                await this.scrapeList(configFile);
                process.exit(0);
            } else if (command === 'company') {
                const url = process.argv[3];
                const outputPath = process.argv[4];
                if (!url || !outputPath) {
                    console.error('❌ 사용법: npx ts-node crawler.ts company <회사_URL> <저장_HTML_경로>');
                    process.exit(1);
                }
                await this.scrapeCompanyAbout(url, outputPath);
                process.exit(0);
            } else {
                console.error('❌ 알 수 없는 명령어입니다. 사용 가능한 명령: login, job, list, company');
                process.exit(1);
            }
        } catch (err: any) {
            console.error(`\n❌ 크롤러 구동 에러: ${err.message}`);
            process.exit(1);
        }
    }
}

// 🏭 크롤러를 동적으로 생성하는 팩토리 클래스 (Factory Method Pattern 적용)
export class CrawlerFactory {
    public static createCrawler(platform: string): ICrawler {
        const lowerPlatform = platform.toLowerCase().trim();
        if (lowerPlatform === 'linkedin') {
            return new LinkedInCrawler();
        }
        
        // 💡 Wanted 등 향후 새로운 타겟 플랫폼 확장 시 이곳에 분기만 간단히 추가하면 됨.
        // else if (lowerPlatform === 'wanted') {
        //     return new WantedCrawler();
        // }
        
        throw new Error(`[CrawlerFactory] 지원하지 않는 수집 플랫폼입니다: ${platform}`);
    }
}

if (require.main === module) {
    const lastArg = process.argv[process.argv.length - 1];
    const platform = (lastArg && ['linkedin'].includes(lastArg.toLowerCase())) ? lastArg : 'linkedin';
    try {
        const crawler = CrawlerFactory.createCrawler(platform) as LinkedInCrawler;
        crawler.run();
    } catch (err: any) {
        console.error(`❌ 크롤러 구동 실패: ${err.message}`);
        process.exit(1);
    }
}

