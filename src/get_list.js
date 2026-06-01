const playwright = require('playwright');
const fs = require('fs');
const path = require('path');

// 경로 정의
const SESSION_PATH = path.join(__dirname, '..', 'config', 'session.json');
const LIST_DIR = path.join(__dirname, '..', 'list');

// 터미널 인자 확인 (설정 파일 경로)
const configFilePath = process.argv[2];

if (!configFilePath) {
    console.error('❌ 오류: 입력 대상 설정 파일 경로 인자가 누락되었습니다.');
    console.error('사용법: node get_list.js <설정_파일_경로>');
    process.exit(1);
}

const isLoggedIn = fs.existsSync(SESSION_PATH);
if (!isLoggedIn) {
    console.log('⚠️  [안내] 로그인 세션 파일(session.json)이 발견되지 않아 비로그인(Public) 모드로 동작합니다.');
    console.log('💡 direct_urls는 수집 대상에서 자동으로 제외되며, 일반 검색 결과 수집만 진행합니다.');
}

// 설정 파일 존재 여부 검증
if (!fs.existsSync(configFilePath)) {
    console.error('❌ 오류: 지정한 입력 대상 설정 파일을 찾을 수 없습니다: ' + configFilePath);
    process.exit(1);
}

console.log('🚀 [시작] 링크드인 채용 목록 백그라운드 수집을 시작합니다.');

// 헬퍼: 현재 날짜를 YYYY-MM-DDTHH_mm_ss 형태로 포맷팅
function getFormattedTimestamp() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    const seconds = pad(d.getSeconds());
    
    return `${year}-${month}-${day}T${hours}_${minutes}_${seconds}`;
}

// 지능형 스크롤 함수: 레이아웃 변화에 상관없이 채용 공고 카드가 다 나타나도록 스크롤다운 유도
async function autoScrollList(page) {
    console.log('🖱️  [목록 스크롤] 카드 로딩을 위해 채용 공고 패널을 스크롤하고 있습니다...');
    await page.evaluate(async () => {
        // 링크드인 채용 목록 영역을 대표하는 셀렉터 후보군
        const selectors = [
            '.jobs-search-results-list',
            '.scaffold-layout__list',
            'div[data-job-id]',
            'main section'
        ];

        let container = null;
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                // 부모 컨테이너 중 scrollHeight가 있는 적합한 스크롤 영역을 탐색
                container = el.closest('[class*="scroll"]') || el.closest('[class*="list"]') || el;
                break;
            }
        }

        const scrollTarget = container || window;
        
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 120; // 스크롤 보폭
            const timer = setInterval(() => {
                const scrollHeight = scrollTarget.scrollHeight || document.body.scrollHeight;
                
                if (scrollTarget === window) {
                    window.scrollBy(0, distance);
                } else {
                    scrollTarget.scrollBy(0, distance);
                }
                totalHeight += distance;

                // 스크롤이 끝까지 내려갔거나 안전 상한(10,000px)을 넘으면 멈춤
                if (totalHeight >= scrollHeight || totalHeight > 10000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 150); // 150ms 단위로 자연스럽게 이동
        });
    });
    // 추가 렌더링을 위해 대기
    await page.waitForTimeout(2000);
}

(async () => {
    let browser;
    try {
        // 1. 수집 타겟 URL 목록 로드 및 파싱 (JSON 또는 평문 리스트 자동 지원)
        const ext = path.extname(configFilePath).toLowerCase();
        let urls = [];

        if (ext === '.json') {
            const config = JSON.parse(fs.readFileSync(configFilePath, 'utf-8'));
            const { generateUrls } = require('./url_generator');
            urls = generateUrls(config, { skipDirectUrls: !isLoggedIn });
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
            process.exit(0);
        }

        console.log(`📋 총 ${urls.length} 개의 목록 URL이 감지되었습니다.`);

        // 2. 무인 헤드리스(headless: true) 크롬 브라우저 기동
        browser = await playwright.chromium.launch({ headless: true });

        // 3. 로그인 세션 주입 옵션 분기 처리
        const contextOptions = {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 },
            locale: 'en-US'
        };
        if (isLoggedIn) {
            contextOptions.storageState = SESSION_PATH;
        }

        const context = await browser.newContext(contextOptions);
        const page = await context.newPage();

        // 4. URL 리스트 순회 수집
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const timestamp = getFormattedTimestamp();
            const outputFileName = `${timestamp}.html`;
            const savePath = path.join(LIST_DIR, outputFileName);

            console.log(`\n──────────────────────────────────────────────────`);
            console.log(`📡 [${i + 1}/${urls.length}] 목록 수집 중: ${url}`);
            console.log(`──────────────────────────────────────────────────`);

            // 링크드인 목록 이동
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.waitForTimeout(3000); // 초기 데이터 수동 렌더링 3초 안전 대기

            // 🛡️ 혹시 세션 만료로 로그인이 해제되었거나 로그인창으로 밀려났는지 검증
            const title = await page.title();
            if (title.includes('Sign In') || title.includes('로그인') || title.includes('Security Challenge')) {
                console.error('⚠️  [경고] 로그인 또는 보안 인증(Captcha) 화면이 감지되었습니다.');
                if (isLoggedIn) {
                    console.error('💡 세션이 만료되었을 수 있으니 다시 [make login]을 실행하여 로그인 상태를 갱신해 주세요.');
                } else {
                    console.log('💡 비로그인 모드로 동작 중 발생한 제한입니다. 전체 데이터를 수집하려면 [make login]을 통해 세션을 덤프한 후 실행해 주세요.');
                }
                break;
            }

            // 5. 무한 스크롤 및 레이지 카드 로딩 유도
            await autoScrollList(page);

            // 6. 로드된 전체 HTML 소스코드 추출 및 파일 저장
            const htmlContent = await page.content();
            fs.writeFileSync(savePath, htmlContent, 'utf-8');

            console.log(`💾 덤프 성공 -> list/${outputFileName} (${(htmlContent.length / 1024).toFixed(1)} KB)`);
        }

        console.log('\n🎉 모든 목록 URL의 무인 백그라운드 수집을 정상적으로 마쳤습니다!');
        await browser.close();
        process.exit(0);

    } catch (error) {
        console.error(`\n❌ 목록 수집 프로세스 중 치명적 에러 발생: ${error.message}`);
        if (browser) await browser.close();
        process.exit(1);
    }
})();
