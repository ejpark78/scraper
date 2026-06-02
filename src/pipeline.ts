import * as fs from 'fs';
import * as path from 'path';
import { UrlUtils, DateUtils, FormatUtils, NamingUtils } from './utils';
import { IMarkdownConverter, MarkdownConverterFactory } from './markdown_converter';
import { ICrawler, CrawlerFactory } from './crawler';
import { IUrlManager, LinkedInUrlManager } from './url_manager';

// ⚙️ LinkedIn Job Scraper 통합 Node.js 오케스트레이션 OOP 엔진 (TypeScript)
// 생성자 주입(Constructor Injection) 방식을 적용하여 크롤러, 컨버터, URL 필터 매니저 의존성을 완벽하게 캡슐화합니다.
// 팩토리 메서드 패턴(Factory Method Pattern)을 탑재하여 타겟 플랫폼에 알맞은 파서와 수집 엔진을 동적으로 주입합니다.

export class ScrapingPipeline {
    constructor(
        private readonly crawler: ICrawler,
        private readonly converter: IMarkdownConverter,
        private readonly urlManager: IUrlManager
    ) {}

    /**
     * 🛡️ HTML 캐시 서브디렉토리 재귀 탐색 헬퍼
     */
    private getAllHtmlFiles(dir: string): string[] {
        let results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                results = results.concat(this.getAllHtmlFiles(fullPath));
            } else if (file.endsWith('.html')) {
                results.push(fullPath);
            }
        });
        return results;
    }

    /**
     * 🚀 파이프라인 구동 주 기동 메서드
     */
    public async run(urlsFile: string): Promise<void> {
        if (!fs.existsSync(urlsFile)) {
            console.error(`❌ 파일을 찾을 수 없습니다: ${urlsFile}`);
            process.exit(1);
        }

        console.log(`🚀 [시작] ${urlsFile} 기반 채용 공고 추출 및 백업 자동화 파이프라인 가동`);

        // 📂 초기 디렉토리 구축
        const baseDir = path.join(__dirname, '..', 'data', 'jobs');
        const cacheListPath = path.join(baseDir, 'lists', 'cache.list');
        const recentHtmlDir = path.join(baseDir, 'recent', 'html');
        const recentMdDir = path.join(baseDir, 'recent', 'markdown');
        
        fs.mkdirSync(recentHtmlDir, { recursive: true });
        fs.mkdirSync(recentMdDir, { recursive: true });

        // 1. 🛡️ 로그인 상태 체크 (config/session.json 존재 여부 기준)
        const sessionPath = path.join(__dirname, '..', 'config', 'session.json');
        const loginStatus = fs.existsSync(sessionPath) ? '[로그인됨]' : '[로그인안됨]';

        // 2. ⚡ 기존 수집 완료된 HTML 캐시 스캔 및 cache.list 실시간 갱신 (O(1) 초고속)
        console.log('🔍 기존 수집된 HTML 기반으로 cache.list 갱신 중...');
        const htmlDir = path.join(baseDir, 'html');
        fs.mkdirSync(htmlDir, { recursive: true });

        const cachedHtmlFiles = this.getAllHtmlFiles(htmlDir);
        const cacheSet = new Set<string>();
        const cacheMap = new Map<string, string>();
        cachedHtmlFiles.forEach(file => {
            const id = path.basename(file, '.html');
            if (id && /^\d+$/.test(id)) {
                cacheSet.add(id);
                cacheMap.set(id, file);
            }
        });

        // cache.list 파일 영구 적재
        fs.mkdirSync(path.dirname(cacheListPath), { recursive: true });
        fs.writeFileSync(cacheListPath, Array.from(cacheSet).join('\n') + '\n', 'utf-8');
        console.log(`✅ 총 ${FormatUtils.formatThousand(cacheSet.size)} 개의 기존 수집본을 cache.list에 등록했습니다.`);

        // 3. 📝 urls.txt 에서 중복 및 이미 완료된 캐시 대조 사전 필터링 (메모리 단에서 초고속 매칭)
        const rawUrls = fs.readFileSync(urlsFile, 'utf-8').split(/\r?\n/);
        const filteredUrls: string[] = [];
        rawUrls.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            
            const jobId = UrlUtils.extractJobId(trimmed);
            if (!jobId || !cacheSet.has(jobId)) {
                filteredUrls.push(trimmed);
            }
        });

        const origCount = rawUrls.filter(l => l.trim() && !l.trim().startsWith('#')).length;
        const filteredCount = filteredUrls.length;
        console.log(`📊 전체 대상: ${FormatUtils.formatThousand(origCount)}건 | 신규 처리 대상: ${FormatUtils.formatThousand(filteredCount)}건`);

        if (filteredCount === 0) {
            console.log('🎉 [종료] 모든 채용 공고가 이미 정상 수집되었습니다.');
            process.exit(0);
        }

        // 4. 🔄 URL 순회 수집 파이프라인 구동
        const startTime = Date.now();
        let currentIndex = 0;

        for (const url of filteredUrls) {
            currentIndex++;
            const jobId = UrlUtils.extractJobId(url);

            // 시간 계산 (런타임 & 예상 남은 시간 ETR)
            const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
            const runtimeStr = DateUtils.formatSeconds(elapsedSeconds);
            
            let etrStr = '계산 중...';
            if (currentIndex > 1) {
                const completedCount = currentIndex - 1;
                const remainingCount = filteredCount - completedCount;
                const avgSpeed = elapsedSeconds / completedCount;
                const remainingSeconds = Math.floor(avgSpeed * remainingCount);
                etrStr = DateUtils.formatSeconds(remainingSeconds);
            }

            const currentIndexFmt = FormatUtils.formatThousand(currentIndex);
            const filteredCountFmt = FormatUtils.formatThousand(filteredCount);

            console.log('\n==================================================');
            console.log(`🌐 [${currentIndexFmt}/${filteredCountFmt}][${runtimeStr}/${etrStr}]${loginStatus} 대상 ID: ${jobId} | URL: ${decodeURIComponent(url)}`);
            console.log('==================================================');

            // 🛡️ 기존 HTML 파일 검색 (O(1) 메모리 단 초고속 조회)
            const savedHtml = cacheMap.get(jobId) || '';

            let htmlToProcess = '';
            let isNew = false;
            const tempHtmlPath = path.join(baseDir, `temp_${jobId}.html`);

            if (savedHtml && fs.existsSync(savedHtml) && fs.statSync(savedHtml).size > 0) {
                console.log('📥 [1/4] 이미 저장된 HTML 파일 감지 (다운로드 생략)');
                htmlToProcess = savedHtml;
            } else {
                console.log('📥 [1/4] 웹페이지 저장중 (crawler.ts job)...');
                try {
                    // 주입받은 크롤러 객체의 scrapeJob을 활용해 웹페이지 덤프
                    await this.crawler.scrapeJob(url, tempHtmlPath);
                } catch (err: any) {
                    console.error(`❌ 플레이라이트 실행 도중 오류가 발생했습니다: ${err.message}`);
                }

                if (!fs.existsSync(tempHtmlPath) || fs.statSync(tempHtmlPath).size === 0) {
                    console.error('❌ HTML을 정상적으로 가져오지 못했습니다. 다음 URL로 넘어갑니다.');
                    if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
                    continue;
                }
                htmlToProcess = tempHtmlPath;
                isNew = true;
            }

            // 5. 🔍 핵심 정보 파싱 및 마크다운 변환
            try {
                console.log('🔍 [2/4] 핵심 정보 추출 및 마크다운 변환 중 (markdown_converter.ts)...');
                const htmlContent = fs.readFileSync(htmlToProcess, 'utf-8');
                const meta = this.converter.convertHtmlToMarkdown(htmlContent, htmlToProcess);

                const targetMdDir = path.join(baseDir, 'markdown', meta.locationDirName, meta.postedDate);
                const correctHtmlDir = path.join(htmlDir, meta.locationDirName, meta.postedDate);
                const safeMdFileName = NamingUtils.generateSafeFileName(meta.jobTitle, meta.company);
                const finalPath = path.join(targetMdDir, `${safeMdFileName}.md`);

                console.log(`📂 저장 경로 정의됨: ${finalPath}`);
                console.log('🧹 [3/4] 오픈소스 Prettier 기반 마크다운 정제 중 (markdown_converter.ts)...');
                console.log('⚙️ [오픈소스 Prettier] 기반 마크다운 구문 분석 및 가독성 정제 중...');
                
                // 주입받은 컨버터 객체의 prettifyAndSave 실행
                await this.converter.prettifyAndSave(meta.rawContent, finalPath);
                console.log(`✨ 정제 완료! 저장 위치: ${finalPath}`);

                // HTML 재배치 및 캐시 세트 갱신
                const correctHtmlPath = path.join(correctHtmlDir, `${jobId}.html`);
                if (htmlToProcess !== correctHtmlPath) {
                    if (htmlToProcess === tempHtmlPath) {
                        if (!fs.existsSync(correctHtmlDir)) fs.mkdirSync(correctHtmlDir, { recursive: true });
                        fs.renameSync(tempHtmlPath, correctHtmlPath);
                        console.log(`💾 [완료] 원본 HTML 저장 완료 -> ${correctHtmlPath}`);
                    } else {
                        if (!fs.existsSync(correctHtmlDir)) fs.mkdirSync(correctHtmlDir, { recursive: true });
                        fs.renameSync(htmlToProcess, correctHtmlPath);
                        console.log(`🚚 [HTML 재배치] -> ${correctHtmlPath}`);
                    }
                }

                // 실시간 cache.list 및 메모리 캐시 맵 갱신
                cacheSet.add(jobId);
                cacheMap.set(jobId, correctHtmlPath);
                fs.appendFileSync(cacheListPath, `${jobId}\n`, 'utf-8');

                // 신규 추가 건에 한해 recent 복사본 저장
                if (isNew) {
                    const recHtmlPath = path.join(recentHtmlDir, `${jobId}.html`);
                    const recMdPath = path.join(recentMdDir, `${safeMdFileName}.md`);
                    fs.copyFileSync(correctHtmlPath, recHtmlPath);
                    fs.copyFileSync(finalPath, recMdPath);
                    console.log('🆕 [신규 추가] 새 공고 복사본을 data/jobs/recent/ 하위에 저장 완료!');
                }

                console.log('✨ [4/4] 완료! 최종 마크다운 파일이 생성되었습니다.');

            } catch (err: any) {
                console.error(`❌ 변환 처리 도중 예외가 발생했습니다: ${err.message}`);
                if (htmlToProcess === tempHtmlPath && fs.existsSync(tempHtmlPath)) {
                    fs.unlinkSync(tempHtmlPath);
                }
            }
        }

        // 6. 🧹 사후 정리 작업 (임시 md 파일 및 빈 폴더 삭제)
        const cleanEmptyDirs = (dir: string): void => {
            if (!fs.existsSync(dir)) return;
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                const fullPath = path.join(dir, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    cleanEmptyDirs(fullPath);
                }
            });
            if (dir !== htmlDir && dir !== path.join(baseDir, 'markdown')) {
                const updatedList = fs.readdirSync(dir);
                if (updatedList.length === 0) {
                    fs.rmdirSync(dir);
                }
            }
        };
        cleanEmptyDirs(htmlDir);
        cleanEmptyDirs(path.join(baseDir, 'markdown'));

        console.log('\n🎉 [종료] 일괄 처리 완료! 결과는 \'./data/jobs/html/[근무위치]/[포스팅날짜]/\' 및 \'./data/jobs/markdown/[근무위치]/[포스팅날짜]/\' 폴더를 확인하세요.');
    }
}

// ==========================================
// 🚀 최상위 엔트리 포인트 제어 (의존성 주입 & 팩토리 결합)
// ==========================================
if (require.main === module) {
    const urlsFile = process.argv[2];
    if (!urlsFile) {
        console.error('❌ 사용법: npx ts-node pipeline.ts <URL_목록_파일_경로> [플랫폼(기본값: linkedin)]');
        process.exit(1);
    }

    // CLI 인자로부터 플랫폼 식별 (기본값: linkedin)
    const platform = process.argv[3] || 'linkedin';

    try {
        // 🏭 팩토리 메서드 패턴을 이용하여 플랫폼에 알맞은 크롤러와 컨버터를 동적으로 생성
        const crawler = CrawlerFactory.createCrawler(platform);
        const converter = MarkdownConverterFactory.createConverter(platform);
        const urlManager = new LinkedInUrlManager(); // URL 정리는 우선 기본 필터 활용

        // 의존성 주입(Dependency Injection) 및 실행
        const pipeline = new ScrapingPipeline(crawler, converter, urlManager);
        pipeline.run(urlsFile).catch(err => {
            console.error(`❌ 파이프라인 치명적 오류 발생: ${err.message}`);
            process.exit(1);
        });
    } catch (err: any) {
        console.error(`❌ 파이프라인 기동 실패: ${err.message}`);
        process.exit(1);
    }
}
