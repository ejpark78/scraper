import * as fs from 'fs';
import * as path from 'path';
import { DateUtils, FormatUtils } from '../utils';

export abstract class BasePipeline<TMeta> {
    protected readonly cacheListPath: string;
    protected readonly htmlDir: string;
    protected readonly mdDir: string;
    protected readonly baseDir: string;
    
    constructor(baseDir: string, cacheListName: string = 'cache.list') {
        this.baseDir = baseDir;
        this.htmlDir = path.join(baseDir, 'html');
        this.mdDir = path.join(baseDir, 'markdown');
        this.cacheListPath = path.join(baseDir, 'lists', cacheListName);
    }
    
    // 🛡️ 하위 클래스에서 재정의할 추상 훅 메서드들
    protected abstract extractId(url: string): string;
    protected abstract getDomainName(): string; // "채용공고" 또는 "회사정보"
    protected abstract executeScrape(url: string, tempHtmlPath: string): Promise<void>;
    protected abstract processMetadata(htmlContent: string, id: string, url: string): TMeta;
    protected abstract saveResults(meta: TMeta, id: string, tempHtmlPath: string): Promise<{ mdPath: string; htmlPath: string; targetDirName: string }>;

    /**
     * 🚀 파이프라인 구동 메인 템플릿 메서드
     */
    public async run(urlsFile: string): Promise<void> {
        if (!fs.existsSync(urlsFile)) {
            console.error(`❌ ${this.getDomainName()} URL 목록 파일을 찾을 수 없습니다: ${urlsFile}`);
            process.exit(1);
        }

        console.log(`🚀 [시작] ${urlsFile} 기반 ${this.getDomainName()} 정보 수집 및 백업 자동화 파이프라인 가동`);

        // 초기 디렉토리 구축
        fs.mkdirSync(this.htmlDir, { recursive: true });
        fs.mkdirSync(this.mdDir, { recursive: true });
        fs.mkdirSync(path.dirname(this.cacheListPath), { recursive: true });

        // 로그인 상태 확인
        const sessionPath = path.join(__dirname, '..', '..', 'config', 'session.json');
        const loginStatus = fs.existsSync(sessionPath) ? '[로그인됨]' : '[로그인안됨]';

        // 1. cache.list 로드하여 기 수집된 고유 ID 셋 구축
        const cacheSet = new Set<string>();
        if (fs.existsSync(this.cacheListPath)) {
            const cacheContent = fs.readFileSync(this.cacheListPath, 'utf-8');
            cacheContent.split(/\r?\n/).forEach(id => {
                const trimmed = id.trim();
                if (trimmed) cacheSet.add(trimmed);
            });
        }
        console.log(`✅ 총 ${FormatUtils.formatThousand(cacheSet.size)} 개의 기존 수집 완료 정보를 cache.list에서 로드했습니다.`);

        // 2. urlsFile 에서 고유 대상 URL 로드 및 필터링
        const rawLines = fs.readFileSync(urlsFile, 'utf-8').split(/\r?\n/);
        const filteredUrls: string[] = [];
        const processedIds = new Set<string>(); // 파일 내부 중복 차단

        rawLines.forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            const id = this.extractId(trimmed);
            if (!id) return;

            if (!cacheSet.has(id) && !processedIds.has(id)) {
                filteredUrls.push(trimmed);
                processedIds.add(id);
            }
        });

        const origCount = rawLines.filter(l => l.trim() && !l.trim().startsWith('#')).length;
        const filteredCount = filteredUrls.length;
        console.log(`📊 전체 대상: ${FormatUtils.formatThousand(origCount)}건 | 신규 처리 대상: ${FormatUtils.formatThousand(filteredCount)}건`);

        if (filteredCount === 0) {
            console.log(`🎉 [종료] 모든 ${this.getDomainName()} 정보가 이미 수집되었습니다.`);
            process.exit(0);
        }

        // 3. URL 순회 수집 시작
        const startTime = Date.now();
        let currentIndex = 0;

        for (const url of filteredUrls) {
            currentIndex++;
            const id = this.extractId(url);

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
            console.log(`🏢 [${currentIndexFmt}/${filteredCountFmt}][${runtimeStr}/${etrStr}]${loginStatus} 대상 ID: ${id} | URL: ${decodeURIComponent(url)}`);
            console.log('==================================================');

            const tempHtmlPath = path.join(this.htmlDir, `temp_${id}.html`);

            try {
                // 1) HTML 스크래핑
                console.log(`📥 [1/3] ${this.getDomainName()} 정보 웹페이지 덤프 중...`);
                await this.executeScrape(url, tempHtmlPath);

                if (!fs.existsSync(tempHtmlPath) || fs.statSync(tempHtmlPath).size === 0) {
                    console.error('❌ HTML을 정상적으로 가져오지 못했습니다. 다음 타겟으로 넘어갑니다.');
                    if (fs.existsSync(tempHtmlPath)) fs.unlinkSync(tempHtmlPath);
                    continue;
                }

                // 2) 핵심 정보 파싱 및 변환
                console.log('🔍 [2/3] 메타데이터 파싱 및 마크다운 변환 중...');
                const htmlContent = fs.readFileSync(tempHtmlPath, 'utf-8');
                const meta = this.processMetadata(htmlContent, id, url);

                // 3) 최종 파일 저장
                console.log('🧹 [3/3] Prettier 포맷팅 후 파일 최종 저장 중...');
                const paths = await this.saveResults(meta, id, tempHtmlPath);
                
                console.log(`✨ 최종 저장 완료 (분류: ${paths.targetDirName}):`);
                console.log(`   - Markdown: ${paths.mdPath}`);
                console.log(`   - HTML: ${paths.htmlPath}`);

                // cache.list 기록 및 갱신
                cacheSet.add(id);
                fs.appendFileSync(this.cacheListPath, `${id}\n`, 'utf-8');

            } catch (err: any) {
                console.error(`❌ 대상 ${id} 처리 도중 오류 발생: ${err.message}`);
                if (fs.existsSync(tempHtmlPath)) {
                    fs.unlinkSync(tempHtmlPath);
                }

                // 세션 만료 및 Auth Wall(로그인 창) 감지 시 전체 파이프라인 중단 처리
                if (err.message && (err.message.includes('세션 만료') || err.message.includes('Auth Wall') || err.message.includes('로그인 요청'))) {
                    console.error(`\n🛑 [핵심 차단] 링크드인 로그인 세션이 만료되었거나 풀렸습니다.`);
                    console.error(`💡 [해결 방법]:`);
                    console.error(`   1. 터미널에 [make login]을 다시 실행하여 링크드인 브라우저 로그인을 갱신해 주세요.`);
                    console.error(`   2. 완료되면 다시 파이프라인을 기동하시면 중단된 지점부터 이어서 수집이 가능해집니다.\n`);
                    process.exit(1);
                }
            }
        }

        console.log(`\n🎉 [종료] ${this.getDomainName()} 정보 일괄 수집 완료! ${this.baseDir} 폴더를 확인해 주세요.`);
    }
}
