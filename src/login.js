const playwright = require('playwright');
const fs = require('fs');
const path = require('path');

const SESSION_PATH = path.join(__dirname, '..', 'config', 'session.json');

console.log('🌐 [시작] 링크드인 자동 로그인 세션 획득 도구를 시작합니다.');

(async () => {
    let browser;
    try {
        // 1. config/ 디렉토리 자동 생성
        const configDir = path.dirname(SESSION_PATH);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        // 2. 사용자가 조작해야 하므로 헤드풀(headless: false) 브라우저 기동
        console.log('🚀 브라우저 창을 띄우는 중입니다...');
        browser = await playwright.chromium.launch({
            headless: false,
            args: ['--start-maximized'] // 화면 최대화 실행
        });

        // 3. 브라우저 컨텍스트 생성 (사용자 친화적 viewport 크기 적용)
        const context = await browser.newContext({
            viewport: null, // 시스템 최대 창 크기를 사용하도록 설정
            locale: 'ko-KR' // 한국어 선호 로케일 주입
        });

        const page = await context.newPage();

        // 4. 링크드인 로그인 페이지로 이동
        console.log('🔗 링크드인 로그인 페이지로 이동합니다...');
        await page.goto('https://www.linkedin.com/login', { waitUntil: 'domcontentloaded' });

        console.log('\n==================================================================');
        console.log('🔑 [수동 조작 요구] 브라우저 창에서 로그인을 완료해 주세요!');
        console.log('💡 2차 인증(OTP, 메일 승인 등)이 필요한 경우에도 브라우저 내에서 직접 수행해 주세요.');
        console.log('⏱️  최대 대기 시간은 3분(180초)입니다.');
        console.log('==================================================================\n');

        // 5. 사용자가 로그인에 성공하여 메인 피드(/feed) 또는 채용 페이지(/jobs)로 도달할 때까지 대기
        // 최대 3분(180000ms) 대기 설정
        await page.waitForURL(url => {
            const path = url.pathname;
            return path.includes('/feed') || path.includes('/jobs');
        }, { timeout: 180000 });

        console.log('✅ 로그인 성공이 감지되었습니다!');
        console.log('💾 세션 정보(쿠키 및 로컬 스토리지)를 추출하는 중...');
        
        // 1초간 세션이 브라우저에 안착될 수 있도록 미세 대기
        await page.waitForTimeout(1500);

        // 6. 브라우저의 현재 상태(쿠키, 스토리지 등)를 세션 파일로 덤프
        await context.storageState({ path: SESSION_PATH });
        
        console.log(`✨ 성공! 세션 데이터가 안전하게 저장되었습니다: ${SESSION_PATH}`);
        console.log('💡 이제 로그인 없이 무인으로 수집 파이프라인(make list)을 가동할 수 있습니다.');

        await browser.close();
        process.exit(0);

    } catch (error) {
        if (error.name === 'TimeoutError') {
            console.error('\n❌ 에러: 로그인 제한 시간(3분)이 초과되었습니다.');
            console.error('💡 브라우저가 강제 종료되었습니다. 다시 시도하려면 [make login]을 실행해 주세요.');
        } else {
            console.error(`\n❌ 예기치 못한 에러 발생: ${error.message}`);
        }
        if (browser) await browser.close();
        process.exit(1);
    }
})();
