/**
 * @module open
 * @description Core functionality or script runner for open.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies playwright, fs, path
 * @lastUpdated 2026-06-11
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// 📅 YYYY-MM-DD_HH-mm-ss 형식의 타임스탬프 생성 헬퍼
function getTimestamp(): string {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

async function runBrowser() {
    const sessionPath = path.join(process.env.SESSION_DIR || path.resolve(process.cwd(), 'data/sessions'), `${process.env.SITE || 'linkedin'}.json`);
    const htmlDir = path.join(__dirname, '..', '..', 'data', 'browser', 'html');
    const jsonDir = path.join(__dirname, '..', '..', 'data', 'browser', 'json');

    // 수집 대상 폴더 생성
    if (!fs.existsSync(htmlDir)) fs.mkdirSync(htmlDir, { recursive: true });
    if (!fs.existsSync(jsonDir)) fs.mkdirSync(jsonDir, { recursive: true });

    console.log('🚀 [세션 브라우저 기동] 브라우저 인스턴스를 시작합니다...');

    const browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized', '--disable-blink-features=AutomationControlled'] // 화면 최대화 및 자동화 감지 방지
    });

    const contextOptions: any = {
        viewport: null, // 최대화 크기 반영을 위해 null 설정
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        locale: 'en-US'
    };

    // 🔑 세션 주입 판단
    if (fs.existsSync(sessionPath)) {
        contextOptions.storageState = sessionPath;
        console.log(`🔑 [세션 주입] 기존 세션 파일(${path.basename(sessionPath)})을 주입하여 기동합니다.`);
    } else {
        console.log(`⚠️  [로그인 안됨] 세션 파일(${path.basename(sessionPath)})이 없습니다. 브라우저 내에서 직접 로그인을 진행해 주세요.`);
    }

    const context = await browser.newContext(contextOptions);

    // 🛡️ Google OAuth 로그인 시 "This browser or app may not be secure" 에러 방지를 위한 webdriver 감지 우회
    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    const page = await context.newPage();

    let lastSavedContentLength = 0;
    let saveTimeout: NodeJS.Timeout | null = null;

    // 💾 페이지 HTML 및 비동기 결과물 최종 DOM 덤프 함수
    async function saveHtmlDump(url: string, trigger: string) {
        try {
            if (!url || url === 'about:blank') return;

            // 이미 저장 진행중인 타이머가 있으면 클리어
            if (saveTimeout) {
                clearTimeout(saveTimeout);
                saveTimeout = null;
            }

            // JS 비동기 데이터 렌더링을 위해 최대 3초 networkidle 대기
            try {
                await page.waitForLoadState('networkidle', { timeout: 3000 });
            } catch (e) {
                // networkidle 대기 시간 초과되어도 저장 계속 진행
            }
            // 최종 JS 렌더링 보정을 위해 추가 1.5초 대기
            await new Promise(resolve => setTimeout(resolve, 1500));

            const htmlContent = await page.content();
            const timestamp = getTimestamp();
            
            // URL을 기반으로 가독성 높은 힌트 문자열 추출
            let urlHint = 'page';
            try {
                const parsed = new URL(url);
                urlHint = parsed.pathname.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
                if (!urlHint || urlHint === '_') urlHint = 'home';
            } catch (e) {}

            const filename = `${timestamp}_${urlHint}.html`;
            const savePath = path.join(htmlDir, filename);

            fs.writeFileSync(savePath, htmlContent, 'utf-8');
            console.log(`💾 [HTML 저장] (${trigger}) ➡️ data/browser/html/${filename} (${(htmlContent.length / 1024).toFixed(1)} KB)`);

            lastSavedContentLength = htmlContent.length;
        } catch (err: any) {
            console.error(`⚠️ [HTML 저장 실패]: ${err.message}`);
        }
    }

    // 1️⃣ 네비게이션 발생 감지 (사용자가 페이지 이동 시)
    page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) {
            const url = frame.url();
            if (url === 'about:blank') return;
            
            console.log(`🌐 [페이지 이동 감지] ➡️ URL: ${url}`);
            
            // 디바운스 기법 적용 (네비게이션 연속 발생 시 부하 최소화)
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                saveHtmlDump(url, 'framenavigated');
            }, 1500);
        }
    });

    // 2️⃣ JS로 로딩되는 비동기 API 데이터(JSON) 실시간 감지 및 수집
    page.on('response', async (response) => {
        try {
            const url = response.url();
            const status = response.status();

            // 성공적인(200번대) 응답 및 유효성 확인
            if (status < 200 || status >= 300) return;

            const contentType = response.headers()['content-type'] || '';
            
            // JSON 및 API/GraphQL 통신 필터링
            if (contentType.includes('application/json') || url.includes('/api/') || url.includes('/graphql')) {
                const text = await response.text();
                
                // 실제로 유효한 JSON인지 검사
                try {
                    JSON.parse(text);
                } catch (e) {
                    return; // JSON이 아닌 경우 패스
                }

                const timestamp = getTimestamp();
                let apiName = 'api';
                
                try {
                    const parsedUrl = new URL(url);
                    // 엔드포인트명 추출
                    apiName = parsedUrl.pathname.split('/').filter(Boolean).pop() || 'api';
                    
                    // GraphQL 등의 경우 operationName이나 queryId를 추가하여 고유성 확보
                    const opName = parsedUrl.searchParams.get('operationName') || parsedUrl.searchParams.get('queryId');
                    if (opName) {
                        apiName = `${apiName}_${opName}`;
                    }
                } catch (e) {}

                const filename = `${timestamp}_${apiName}.json`;
                const savePath = path.join(jsonDir, filename);

                fs.writeFileSync(savePath, text, 'utf-8');
                console.log(`📡 [비동기 API 수집] ➡️ data/browser/json/${filename} (${(text.length / 1024).toFixed(1)} KB)`);
            }
        } catch (err: any) {
            // response.text() 읽기 도중 발생할 수 있는 네트워크 파기 건 무시
        }
    });

    // 3️⃣ 사용자가 페이지 이동 없이 스크롤하여 추가 JS 데이터를 로드하는 경우 대응 (주기적 DOM 감시)
    const intervalId = setInterval(async () => {
        try {
            if (page.isClosed()) return;
            const currentUrl = page.url();
            if (!currentUrl || currentUrl === 'about:blank') return;

            const currentHtml = await page.content();
            const lengthDiff = Math.abs(currentHtml.length - lastSavedContentLength);

            // 이전 저장본 대비 크기가 15% 이상 달라졌다면 비동기 데이터 추가 로딩으로 판단하여 자동 갱신 저장
            if (lastSavedContentLength > 0 && (lengthDiff / lastSavedContentLength) > 0.15) {
                console.log(`🔄 [비동기 데이터 갱신 감지] DOM 크기 변화가 감지되었습니다. (변화폭: ${(lengthDiff / 1024).toFixed(1)} KB)`);
                await saveHtmlDump(currentUrl, 'dynamic_update');
            }
        } catch (e) {
            // 브라우저 종료 도중 발생하는 에러 무시
        }
    }, 6000);

    // 🚪 탭/브라우저가 닫힐 때 세션을 자동으로 갱신 저장
    page.on('close', async () => {
        console.log('\n🚪 브라우저 페이지가 닫혔습니다.');
        clearInterval(intervalId);
        if (saveTimeout) clearTimeout(saveTimeout);

        try {
            const sessionDir = path.dirname(sessionPath);
            if (!fs.existsSync(sessionDir)) {
                fs.mkdirSync(sessionDir, { recursive: true });
            }
            await context.storageState({ path: sessionPath });
            console.log(`💾 [세션 자동 갱신] 최신 토큰 정보를 성공적으로 업데이트했습니다 ➡️ ${sessionPath}`);
        } catch (err: any) {
            console.error(`⚠️ [세션 갱신 실패]: ${err.message}`);
        }
        process.exit(0);
    });

    // 🛑 Ctrl+C 종료 등 프로세스 중단 시 안전하게 브라우저 닫기 및 세션 백업
    process.on('SIGINT', async () => {
        console.log('\n🛑 [프로세스 종료 신호 감지] 브라우저 종료 및 세션을 안전하게 백업합니다...');
        clearInterval(intervalId);
        if (saveTimeout) clearTimeout(saveTimeout);
        try {
            await context.storageState({ path: sessionPath });
            console.log(`💾 [세션 백업 완료] ➡️ ${sessionPath}`);
        } catch (e) {}
        await browser.close();
        process.exit(0);
    });

    // 기본 최초 진입 페이지 로딩 (LinkedIn 홈)
    console.log('📡 [이동] https://www.linkedin.com 으로 이동합니다. 브라우저를 통해 자유롭게 수집을 진행하세요.');
    await page.goto('https://www.linkedin.com', { waitUntil: 'domcontentloaded' });

    // 브라우저 닫힘 이벤트 무제한 대기
    await page.waitForEvent('close', { timeout: 0 });
}

runBrowser().catch((err) => {
    console.error(`❌ 브라우저 실행기 구동 중 심각한 오류 발생: ${err.message}`);
    process.exit(1);
});
