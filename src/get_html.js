const playwright = require('playwright');
const fs = require('fs');
const path = require('path');

// 터미널 인자(Args)에서 URL과 저장할 파일 경로 추출
const url = process.argv[2];
const savePath = process.argv[3];

if (!url || !savePath) {
    console.error('❌ 오류: 인자가 부족합니다.');
    console.error('사용법: node get_html.js <대상_URL> <저장할_HTML_경로>');
    process.exit(1);
}

console.error(`\n🌐 [1/4] 브라우저 기동 및 페이지 이동 중...`);

(async () => {
    let browser;
    try {
        // 1. 브라우저 실행
        browser = await playwright.chromium.launch({ headless: true });
        
        // 2. 로그인 세션 정보 로드 옵션 설정
        const SESSION_PATH = path.join(__dirname, '..', 'config', 'session.json');
        const contextOptions = {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 },
            locale: 'en-US'
        };
        if (fs.existsSync(SESSION_PATH)) {
            contextOptions.storageState = SESSION_PATH;
        }

        // 3. 브라우저 컨텍스트 생성 (최신 User-Agent 및 로그인 세션 주입)
        const context = await browser.newContext(contextOptions);
        
        // 4. 새 페이지 열기
        const page = await context.newPage();
        
        // 4. 인자로 받은 URL로 이동 및 네트워크 안정화 대기
        console.error(`🔗 [2/4] 페이지 로딩 중: ${url}`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
        
        // 🛡️ 링크드인 로그인 벽 또는 캡차 보안 챌린지 검출
        const pageTitle = await page.title();
        if (pageTitle.includes('Security Challenge') || pageTitle.includes('Sign In') || pageTitle.includes('로그인')) {
            console.error(`⚠️  [경고] 링크드인 보안 인증(캡차) 또는 로그인 요구 페이지가 감지되었습니다. (페이지 제목: "${pageTitle}")`);
        }

        // "See more" 버튼 확장을 위한 셀렉터 목록
        const seeMoreSelectors = [
            'button.show-more-less-html__button--more',
            'button:has-text("See more")',
            'button:has-text("더 보기")',
            '.jobs-description__footer button',
            'button[aria-label*=\"more\"]'
        ];

        let clicked = false;
        for (const selector of seeMoreSelectors) {
            try {
                const button = page.locator(selector).first();
                if (await button.isVisible()) {
                    console.error(`🖱️ [3/4] 버튼 발견 (${selector}), 클릭하여 본문 확장 중...`);
                    // 🚀 성능 최적화: Playwright의 무거운 Actionability checks(뷰포트 스크롤, 가림 감지 등)로 인한 30초 대기(병목)를 우회하기 위해
                    // DOM 레벨에서 직접 JavaScript 클릭 이벤트를 트리거합니다. (0초 만에 즉시 실행)
                    await button.evaluate(el => el.click());
                    await page.waitForTimeout(2000); // 본문 펼쳐짐 렌더링을 위해 대기
                    clicked = true;
                    break;
                }
            } catch (e) {
                // DOM 클릭 실패 시 일반 Playwright click 시도 (짧은 타임아웃 3초 설정)
                try {
                    const button = page.locator(selector).first();
                    await button.click({ timeout: 3000 });
                    await page.waitForTimeout(2000);
                    clicked = true;
                    break;
                } catch (clickErr) {
                    continue;
                }
            }
        }

        if (!clicked) {
            console.error(`💡 [안내] 명시적인 "See more" 버튼이 보이지 않거나 이미 확장되어 있습니다.`);
        }

        console.error(`💾 [4/4] 렌더링 완료! 파일 저장 중...`);
        
        // 🌟 상위 저장 경로 디렉토리 자동 생성 (디렉토리 누락 방지)
        const parentDir = path.dirname(savePath);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }

        // 전체 HTML 소스를 가져온 후 디스크에 한 번에 파일로 저장합니다.
        const htmlContent = await page.content();
        fs.writeFileSync(savePath, htmlContent, 'utf-8');
        
        console.error(`✨ 백업 성공 -> ${savePath}`);
        await browser.close();
        process.exit(0);

    } catch (error) {
        console.error(`❌ 오류 발생: ${error.message}`);
        if (browser) await browser.close();
        process.exit(1);
    }
})();