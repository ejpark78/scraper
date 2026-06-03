import * as fs from 'fs';
import * as path from 'path';
import { UrlUtils, DateUtils, FormatUtils, NamingUtils } from './utils';
import { CompanyMarkdownConverter } from './company_converter';
import { LinkedInCrawler } from './crawler';

export class CompanyScrapingPipeline {
    private readonly crawler: LinkedInCrawler;
    private readonly converter: CompanyMarkdownConverter;
    private readonly baseDir: string;
    private readonly htmlDir: string;
    private readonly mdDir: string;
    private readonly cacheListPath: string;

    constructor() {
        this.crawler = new LinkedInCrawler();
        this.converter = new CompanyMarkdownConverter();
        this.baseDir = path.join(__dirname, '..', 'data', 'compay');
        this.htmlDir = path.join(this.baseDir, 'html');
        this.mdDir = path.join(this.baseDir, 'markdown');
        this.cacheListPath = path.join(this.baseDir, 'lists', 'cache.list');
    }

    /**
     * 파이프라인 구동 메인 메서드
     */
    public async run(urlsFile: string): Promise<void> {
        if (!fs.existsSync(urlsFile)) {
            console.error(`❌ 회사 URL 목록 파일을 찾을 수 없습니다: ${urlsFile}`);
            process.exit(1);
        }

        console.log(`🚀 [시작] ${urlsFile} 기반 회사 정보 수집 및 백업 자동화 파이프라인 가동`);

        // 초기 디렉토리 구축
        fs.mkdirSync(this.htmlDir, { recursive: true });
        fs.mkdirSync(this.mdDir, { recursive: true });
        fs.mkdirSync(path.dirname(this.cacheListPath), { recursive: true });

        // 1. 로그인 상태 확인
        const sessionPath = path.join(__dirname, '..', 'config', 'session.json');
        const loginStatus = fs.existsSync(sessionPath) ? '[로그인됨]' : '[로그인안됨]';
        if (!fs.existsSync(sessionPath)) {
            console.warn('⚠️ [중요 경고] 로그인 세션이 존재하지 않습니다. 먼저 [make login]을 기동하여 로그인해 주세요.');
        }

        // 2. cache.list 로드하여 기 수집된 companyId 셋 구축
        const cacheSet = new Set<string>();
        if (fs.existsSync(this.cacheListPath)) {
            const cacheContent = fs.readFileSync(this.cacheListPath, 'utf-8');
            cacheContent.split(/\r?\n/).forEach(id => {
                const trimmed = id.trim();
                if (trimmed) cacheSet.add(trimmed);
            });
        }
        console.log(`✅ 총 ${FormatUtils.formatThousand(cacheSet.size)} 개의 기존 수집 완료 정보를 cache.list에서 로드했습니다.`);

        // 3. urlsFile 에서 고유 회사 URL 로드 및 필터링
        const rawLines = fs.readFileSync(urlsFile, 'utf-8').split(/\r?\n/);
        const filteredUrls: string[] = [];
        const processedIds = new Set<string>(); // 파일 내부 중복 차단

        rawLines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            const companyId = UrlUtils.extractCompanyId(trimmed);
            if (!companyId) return;

            if (!cacheSet.has(companyId) && !processedIds.has(companyId)) {
                filteredUrls.push(trimmed);
                processedIds.add(companyId);
            }
        });

        const origCount = rawLines.filter(l => l.trim() && !l.trim().startsWith('#')).length;
        const filteredCount = filteredUrls.length;
        console.log(`📊 전체 대상: ${FormatUtils.formatThousand(origCount)}건 | 신규 처리 대상: ${FormatUtils.formatThousand(filteredCount)}건`);

        if (filteredCount === 0) {
            console.log('🎉 [종료] 모든 회사 정보가 이미 수집되었습니다.');
            process.exit(0);
        }

        // 4. URL 순회 수집 시작
        const startTime = Date.now();
        let currentIndex = 0;

        for (const url of filteredUrls) {
            currentIndex++;
            const companyId = UrlUtils.extractCompanyId(url);

            // 진행 시간 및 ETR(예상 완료 시간) 계산
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
            console.log(`🏢 [${currentIndexFmt}/${filteredCountFmt}][${runtimeStr}/${etrStr}]${loginStatus} 대상 ID: ${companyId} | URL: ${decodeURIComponent(url)}`);
            console.log('==================================================');

            const tempHtmlPath = path.join(this.htmlDir, `temp_${companyId}.html`);

            try {
                // 1) HTML 스크래핑
                console.log('📥 [1/3] 회사 정보 웹페이지 덤프 중 (Playwright)...');
                await this.crawler.scrapeCompanyAbout(url, tempHtmlPath);

                if (!fs.existsSync(tempHtmlPath) || fs.statSync(tempHtmlPath).size === 0) {
                    console.error('❌ 회사 HTML을 정상적으로 가져오지 못했습니다. 다음 회사로 넘어갑니다.');
                    if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
                    continue;
                }

                // 2) 핵심 정보 파싱 및 마크다운 변환
                console.log('🔍 [2/3] 회사명 및 메타데이터 파싱 중...');
                const htmlContent = fs.readFileSync(tempHtmlPath, 'utf-8');
                const meta = this.converter.convertHtmlToMarkdown(htmlContent, companyId, url);

                // 국가 폴더명 결정 (ISO 코드 ➡️ 영문 국가명 변환)
                let countryDir = 'Unknown';
                if (meta.hqCountry && meta.hqCountry !== '정보 없음') {
                    countryDir = NamingUtils.convertCountryCodeToName(meta.hqCountry);
                }

                // 회사명 기반으로 다국어 안전한 파일명 생성
                const safeFileName = meta.companyName
                    .replace(/[\/\\:\*\?"<>\|]/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim() || companyId;

                const finalHtmlDir = path.join(this.htmlDir, countryDir);
                const finalMdDir = path.join(this.mdDir, countryDir);

                if (!fs.existsSync(finalHtmlDir)) {
                    fs.mkdirSync(finalHtmlDir, { recursive: true });
                }
                if (!fs.existsSync(finalMdDir)) {
                    fs.mkdirSync(finalMdDir, { recursive: true });
                }

                const finalMdPath = path.join(finalMdDir, `${safeFileName}.md`);
                const finalHtmlPath = path.join(finalHtmlDir, `${safeFileName}.html`);

                // 3) 프리티어 포맷팅 및 최종 마크다운/HTML 저장
                console.log('🧹 [3/3] Prettier 포맷팅 후 파일 최종 저장 중...');
                await this.converter.prettifyAndSave(meta.rawContent, finalMdPath);
                
                // 임시 HTML 파일을 최종 회사명 HTML로 이동
                if (fs.existsSync(finalHtmlPath)) {
                    fs.unlinkSync(finalHtmlPath); // 중복 덮어쓰기 대비 제거
                }
                fs.renameSync(tempHtmlPath, finalHtmlPath);
                
                console.log(`✨ 최종 저장 완료 (국가: ${countryDir}):`);
                console.log(`   - Markdown: ${finalMdPath}`);
                console.log(`   - HTML: ${finalHtmlPath}`);

                // cache.list 기록 및 갱신
                cacheSet.add(companyId);
                fs.appendFileSync(this.cacheListPath, `${companyId}\n`, 'utf-8');

            } catch (err: any) {
                console.error(`❌ 회사 ${companyId} 처리 도중 오류 발생: ${err.message}`);
                if (fs.existsSync(tempHtmlPath)) {
                    fs.unlinkSync(tempHtmlPath);
                }
            }
        }

        console.log('\n🎉 [종료] 회사 정보 일괄 수집 완료! data/compay/ 폴더를 확인해 주세요.');
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
