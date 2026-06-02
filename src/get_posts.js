const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const cheerio = require('cheerio');
const prettier = require('prettier');

// ⚙️ LinkedIn Job Scraper 통합 Node.js 오케스트레이션 엔진
// 쉘 스크립트(get_posts.sh)가 수행하던 복잡한 오케스트레이션(URL 순회, 실시간 대시보드 런타임/ETR 계산,
// 캐시 파일 갱신, 마크다운 가공, Prettify 및 디렉토리 표준화)을 하나의 초고속 프로세스로 완벽하게 병렬 처리합니다.

// 🕒 초 단위를 시/분/초로 포맷팅
function formatSeconds(totalSec) {
    const H = Math.floor(totalSec / 3600);
    const M = Math.floor((totalSec % 3600) / 60);
    const S = totalSec % 60;
    if (H > 0) {
        return `${H}h ${M}m ${S}s`;
    } else if (M > 0) {
        return `${M}m ${S}s`;
    }
    return `${S}s`;
}

// 🔢 천단위 콤마 포맷터 (예: 3000 -> 3,000)
function formatThousand(num) {
    return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 🔗 다양한 링크드인 공고 URL에서 job_id 추출 (filter_urls.js와 동기화)
function extractJobId(url) {
    const cleanUrl = url.trim().replace(/\/$/, '').split('?')[0];
    const segment = cleanUrl.split('/').pop() || '';
    
    const dashMatch = segment.match(/-([0-9]+)$/);
    if (dashMatch) return dashMatch[1];
    if (/^[0-9]+$/.test(segment)) return segment;
    
    const numberMatch = segment.match(/[0-9]{7,}/);
    return numberMatch ? numberMatch[0] : segment.substring(0, 50);
}

// 🛡️ 근무지 지리 매핑 및 표준화 규칙 적용 (html2md.js와 동일)
function standardizeLocation(rawLocation) {
    if (!rawLocation || rawLocation === '정보 없음' || rawLocation === 'No info') {
        return 'unknown-location';
    }
    const cleanLoc = rawLocation.trim();
    if (/[가-힣]/.test(cleanLoc) || /South Korea|Seoul|Korea|서울|대한민국|Pangyo|Bundang|Gyeonggi/i.test(cleanLoc)) {
        return 'Korea';
    } else if (/Abu Dhabi|Dubai|United Arab Emirates|아부다비|두바이|아랍에미리트|أبو ظبي|دبي|الإمارات|الشارقة|الخيمة/i.test(cleanLoc)) {
        return 'Abu Dhabi';
    } else if (/Singapore|싱가포르/i.test(cleanLoc)) {
        return 'Singapore';
    } else if (/United Kingdom|London|영국/i.test(cleanLoc)) {
        return 'United Kingdom';
    } else if (/Canada|Toronto|캐나다/i.test(cleanLoc)) {
        return 'Canada';
    } else if (/Ireland|Dublin|아일랜드/i.test(cleanLoc)) {
        return 'Ireland';
    } else if (/Germany|Marburg|독일/i.test(cleanLoc)) {
        return 'Germany';
    } else if (/Saudi Arabia|Riyadh|사우디/i.test(cleanLoc)) {
        return 'Saudi Arabia';
    } else if (/Japan|Tokyo|Shibuya|일본/i.test(cleanLoc)) {
        return 'Japan';
    }
    return cleanLoc.replace(/[\/\\:\*\?"<>\|]/g, ' ').trim();
}

// HTML 날짜 추출 관련 헬퍼 (html2md.js와 동일)
function parseRelativeDate(relativeStr, timeStr, baseDateInput) {
    let baseDate = baseDateInput ? new Date(baseDateInput) : new Date();
    if (isNaN(baseDate.getTime())) {
        baseDate = new Date();
    }
    let daysAgo = 0;
    let foundRelative = false;
    
    const matchRegex = /(\d+)\s*(day|week|month|year|hour|minute|second|일|주|달|개월|년|시간|분|초)s?\s*ago/i;
    const matchRegexKo = /(\d+)\s*(일|주|달|개월|년|시간|분|초)\s*전/i;
    const matchRegexRaw = /(\d+)\s*(day|week|month|year|hour|minute|second)s?/i;

    let match = (relativeStr || '').match(matchRegex) || (relativeStr || '').match(matchRegexKo) || (relativeStr || '').match(matchRegexRaw);
    if (match) {
        let val = parseInt(match[1]);
        let unit = match[2].toLowerCase();
        if (unit.startsWith('day') || unit === '일') daysAgo = val;
        else if (unit.startsWith('week') || unit === '주') daysAgo = val * 7;
        else if (unit.startsWith('month') || unit === '달' || unit === '개월') daysAgo = val * 30;
        else if (unit.startsWith('year') || unit === '년') daysAgo = val * 365;
        foundRelative = true;
    }
    
    if (!foundRelative && timeStr) {
        let match = timeStr.match(matchRegex) || timeStr.match(matchRegexKo) || timeStr.match(matchRegexRaw);
        if (match) {
            let val = parseInt(match[1]);
            let unit = match[2].toLowerCase();
            if (unit.startsWith('day') || unit === '일') daysAgo = val;
            else if (unit.startsWith('week') || unit === '주') daysAgo = val * 7;
            else if (unit.startsWith('month') || unit === '달' || unit === '개월') daysAgo = val * 30;
            else if (unit.startsWith('year') || unit === '년') daysAgo = val * 365;
        }
    }
    
    baseDate.setDate(baseDate.getDate() - daysAgo);
    let year = baseDate.getFullYear();
    let month = String(baseDate.getMonth() + 1).padStart(2, '0');
    let day = String(baseDate.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// elementToMarkdown 함수 (html2md.js와 동일)
function elementToMarkdown($, el) {
    let markdown = '';
    const tagName = el.name;
    if (tagName === 'script' || tagName === 'style' || tagName === 'button' || tagName === 'icon' || tagName === 'svg') {
        return '';
    }
    
    $(el).contents().each((i, child) => {
        if (child.type === 'text') {
            markdown += $(child).text();
        } else if (child.type === 'tag') {
            const childTagName = child.name;
            const childNode = $(child);
            
            if (childTagName === 'br') {
                markdown += '\n';
            } else if (childTagName === 'strong' || childTagName === 'b') {
                const rawInner = elementToMarkdown($, child);
                const trimmedInner = rawInner.trim();
                if (trimmedInner) {
                    const leadingSpace = rawInner.match(/^\s*/)[0];
                    const trailingSpace = rawInner.match(/\s*$/)[0];
                    markdown += `${leadingSpace}**${trimmedInner}**${trailingSpace}`;
                }
            } else if (childTagName === 'em' || childTagName === 'i') {
                const rawInner = elementToMarkdown($, child);
                const trimmedInner = rawInner.trim();
                if (trimmedInner) {
                    const leadingSpace = rawInner.match(/^\s*/)[0];
                    const trailingSpace = rawInner.match(/\s*$/)[0];
                    markdown += `${leadingSpace}*${trimmedInner}*${trailingSpace}`;
                }
            } else if (childTagName === 'p') {
                const inner = elementToMarkdown($, child).trim();
                if (inner) {
                    markdown += `\n\n${inner}\n\n`;
                }
            } else if (childTagName === 'li') {
                const inner = elementToMarkdown($, child).trim();
                if (inner) {
                    markdown += `\n- ${inner}`;
                }
            } else if (childTagName.match(/^h[1-6]$/)) {
                const level = parseInt(childTagName.substring(1));
                const inner = elementToMarkdown($, child).trim();
                if (inner) {
                    markdown += `\n\n${'#'.repeat(level)} ${inner}\n\n`;
                }
            } else if (childTagName === 'a') {
                const href = childNode.attr('href') || '';
                const rawInner = elementToMarkdown($, child);
                const trimmedInner = rawInner.trim();
                if (trimmedInner) {
                    const leadingSpace = rawInner.match(/^\s*/)[0];
                    const trailingSpace = rawInner.match(/\s*$/)[0];
                    markdown += `${leadingSpace}[${trimmedInner}](${href})${trailingSpace}`;
                }
            } else if (childTagName === 'ul' || childTagName === 'ol') {
                markdown += `\n${elementToMarkdown($, child)}\n`;
            } else {
                markdown += elementToMarkdown($, child);
            }
        }
    });
    
    return markdown;
}

// HTML 원본을 마크다운으로 가공하고 메타를 뽑아주는 코어 엔진
function convertHtmlToMarkdownCore(htmlContent, htmlPath) {
    const $ = cheerio.load(htmlContent);
    const fileStats = fs.statSync(htmlPath);
    const baseDateInput = fileStats.mtime;

    // 회사명 추출
    let company = $('.topcard__flavor a, .job-details-jobs-unified-top-card__company-name, [data-tracking-control-name="public_jobs_topcard-company-name"]').first().text().trim().replace(/\s+/g, ' ');
    if (!company) {
        let ogDesc = $('meta[property="og:description"]').attr('content') || '';
        if (ogDesc.includes(' hiring ')) {
            company = ogDesc.split(' hiring ')[0].replace(/Posted.*?\.\s*/i, '').trim().replace(/\s+/g, ' ');
        } else {
            company = ogDesc.replace(/Posted.*?\.\s*/i, '').substring(0, 20).trim().replace(/\s+/g, ' ');
        }
    }

    // 공고 제목 추출
    let jobTitle = $('.topcard__title, h1, .job-details-jobs-unified-top-card__job-title').first().text().trim().replace(/\s+/g, ' ');
    if (!jobTitle) {
        let ogTitle = $('meta[property="og:title"]').attr('content') || '';
        jobTitle = ogTitle.includes(' hiring ') ? ogTitle.split(' hiring ')[1]?.split(' in ')[0] : ogTitle;
        if (jobTitle) jobTitle = jobTitle.trim().replace(/\s+/g, ' ');
    }

    // 근무 위치 추출
    let location = $('.topcard__flavor--metadata, .job-details-jobs-unified-top-card__flavor--bullet, .topcard__flavor:nth-child(2)').first().text().trim();
    location = location.replace(/\s+/g, ' ');

    // 근무 형태 및 고용 형태
    let workplaceType = '정보 없음';
    $('.description__job-criteria-item, .job-details-jobs-unified-top-card__job-insight').each((i, el) => {
        const text = $(el).text();
        if (text.includes('Remote') || text.includes('On-site') || text.includes('Hybrid') || text.includes('원격') || text.includes('현장')) {
            workplaceType = text.replace(/\s+/g, ' ').trim();
        }
    });

    let jobType = $('.description__job-criteria-item:nth-child(1), .ui-鈍').first().text().replace(/\s+/g, ' ').trim();

    let applyType = '일반 지원 (External Apply)';
    const applyBtn = $('.apply-button, .jobs-apply-button');
    if (applyBtn.length > 0) {
        if (applyBtn.text().trim().match(/Easy Apply|간편 지원/i)) {
            applyType = '간편 지원 (Easy Apply)';
        }
    }

    let jobLink = $('link[rel="canonical"]').attr('href') || '링크를 찾을 수 없음';

    // 포스팅 날짜 추출
    let dateClass = $('.posted-time-ago__text, .posted-time-ago, .job-details-jobs-unified-top-card__posted-date, .jobs-unified-top-card__posted-date').first().text().trim().replace(/\s+/g, ' ');
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    const metaMatch = metaDesc.match(/Posted\s+([^.]+)\./i);
    let dateMeta = metaMatch ? metaMatch[1].trim() : '';

    let postedDate = parseRelativeDate(dateClass, dateMeta, baseDateInput);

    // 메타 식별 정보 추출 (YAML Front Matter 용)
    const jobIdMatch = htmlPath.match(/(\d+)\.html$/);
    const jobId = jobIdMatch ? jobIdMatch[1] : ($('link[rel="canonical"]').attr('href') || '').match(/(\d+)$/)?.[1] || '정보 없음';
    const companyId = $('meta[name="companyId"]').attr('content') || '정보 없음';
    const industryId = $('meta[name="industryIds"]').attr('content') || '정보 없음';
    const titleId = $('meta[name="titleId"]').attr('content') || '정보 없음';

    // 메인 채용 본문 컨테이너 타겟팅 및 리스트 정렬
    const descriptionContainer = $('.description__text, .jobs-description__content, .jobs-box__html-content');
    let aboutCompanyText = '정보 없음';
    let jdText = '정보 없음';

    if (descriptionContainer.length > 0) {
        const markup = descriptionContainer.find('.show-more-less-html__markup').first();
        const target = markup.length > 0 ? markup : descriptionContainer;
        
        let rawMarkdown = elementToMarkdown($, target[0]);
        let formattedText = rawMarkdown
            .replace(/\r/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        // 회사 소개와 JD 분리 로직 (Split Heuristic)
        const companyEscaped = company ? company.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') : '';
        let splitDone = false;

        if (companyEscaped) {
            const aboutCompanyRegex = new RegExp(`(?:^|\\n)(?:#+\\s+)?(About\\s+Us|About\\s+${companyEscaped}|회사\\s*소개|${companyEscaped}\\s*소개)(?:\\s|\\n|:|$)`, 'i');
            const match = formattedText.match(aboutCompanyRegex);
            if (match) {
                const splitIndex = match.index;
                const remainingText = formattedText.substring(splitIndex);
                const jdStartRegex = /(?:^|\n)(?:#+\\s+)?(Job\s+Description|Role\s+Description|Responsibilities|What\s+you'll\s+do|What\s+you\s+will\s+do|What\s+we\s+are\s+looking\s+for|Qualifications|Requirements|담당\s*업무|주요\s*업무|자격\s*요건|우대\s*사항)(?:\s|\n|:|$)/i;
                const jdMatch = remainingText.match(jdStartRegex);
                if (jdMatch) {
                    const jdSplitIndex = splitIndex + jdMatch.index;
                    aboutCompanyText = formattedText.substring(splitIndex, jdSplitIndex).trim();
                    jdText = formattedText.substring(jdSplitIndex).trim();
                    splitDone = true;
                }
            }
        }

        if (!splitDone) {
            const jdStartRegex = /(?:^|\n)(?:#+\\s+)?(Responsibilities|What\s+you'll\s+do|What\s+you\s+will\s+do|What\s+we\s+are\s+looking\s+for|Qualifications|Requirements|담당\s*업무|주요\s*업무|자격\s*요건|우대\s*사항)(?:\s|\n|:|$)/i;
            const jdMatch = formattedText.match(jdStartRegex);
            if (jdMatch && jdMatch.index > 0) {
                const splitIndex = jdMatch.index;
                const prospectiveCompanyText = formattedText.substring(0, splitIndex).trim();
                if (prospectiveCompanyText.length >= 20) {
                    aboutCompanyText = prospectiveCompanyText;
                    jdText = formattedText.substring(splitIndex).trim();
                    splitDone = true;
                }
            }
        }

        if (!splitDone) {
            jdText = formattedText;
            let metaDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
            if (metaDesc) {
                let cleanMeta = metaDesc
                    .replace(/^Posted\s+[^.]+\.\s*/i, '')
                    .replace(/^Posted\s+[^.일년주월시분초]+\.\s*/i, '')
                    .split(/See\s+this\s+and\s+similar/i)[0]
                    .trim();
                
                if (cleanMeta && cleanMeta.length >= 15 && !cleanMeta.startsWith('Apply for') && !cleanMeta.startsWith('지원')) {
                    aboutCompanyText = cleanMeta;
                    splitDone = true;
                }
            }
            if (!splitDone) {
                aboutCompanyText = '정보 없음';
            }
        }
    }

    const markdownOutput = `---
job_id: "${jobId}"
company_id: "${companyId}"
industry_id: "${industryId}"
title_id: "${titleId}"
job_title: "${jobTitle || '정보 없음'}"
company_name: "${company || '정보 없음'}"
location: "${location || '정보 없음'}"
posted_date: "${postedDate}"
---

# 📌 채용 공고 핵심 요약 (Job Summary)

## 🏢 기본 및 근무 정보 (Basic Info)
* **공고 제목 (Job Title):** ${jobTitle || '정보 없음'}
* **회사명 (Company):** ${company || '정보 없음'}
* **근무 위치 (Location):** ${location || '정보 없음'}
* **근무 형태 (Workplace Type):** ${workplaceType}
* **고용 형태 (Job Type):** ${jobType || '정보 없음'}
* **지원 방식 (Apply Type):** ${applyType}
* **포스팅 날짜 (Posted Date):** ${postedDate}
* **공고 링크 (Job Link):** [바로가기 (Link)](${jobLink})

---

## 📝 JD (직무 기술서 / Job Description)
${jdText}
`;

    return {
        jobId,
        company,
        jobTitle,
        rawLocation: location,
        locationDirName: standardizeLocation(location),
        postedDate,
        rawContent: markdownOutput
    };
}

// Prettify 및 저장
async function prettifyAndSaveMarkdown(rawText, outputPath) {
    let text = rawText.replace(/Show\s+more\s*\n*\s*Show\s+less/gi, '');
    const prettifiedText = await prettier.format(text, {
        parser: 'markdown',
        proseWrap: 'preserve',
        tabWidth: 2,
        printWidth: 100
    });
    const parentDir = path.dirname(outputPath);
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, prettifiedText, 'utf-8');
}

// 다국어용 안전한 파일명 생성 (html2md.js와 동일)
function generateSafeFileName(jobTitle, company) {
    let cleanTitle = (jobTitle || '정보 없음').trim();
    let cleanCompany = (company || '정보 없음').trim();
    cleanTitle = cleanTitle.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    cleanCompany = cleanCompany.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    let safeName = `${cleanCompany} - ${cleanTitle}`
        .replace(/[\/\\:\*\?"<>\|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!safeName || safeName === '-') safeName = '정보 없음 - 정보 없음';
    if (safeName.length > 80) safeName = safeName.substring(0, 80).trim();
    return safeName;
}

// ==========================================
// 🚀 메인 오케스트레이션 실행 로직
// ==========================================
(async () => {
    const urlsFile = process.argv[2];
    if (!urlsFile) {
        console.error('❌ 사용법: node get_posts.js <URL_목록_파일_경로>');
        process.exit(1);
    }
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

    function getAllHtmlFiles(dir) {
        let results = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                results = results.concat(getAllHtmlFiles(fullPath));
            } else if (file.endsWith('.html')) {
                results.push(fullPath);
            }
        });
        return results;
    }

    const cachedHtmlFiles = getAllHtmlFiles(htmlDir);
    const cacheSet = new Set();
    cachedHtmlFiles.forEach(file => {
        const id = path.basename(file, '.html');
        if (id && /^\d+$/.test(id)) {
            cacheSet.add(id);
        }
    });

    // cache.list 파일 영구 적재
    fs.mkdirSync(path.dirname(cacheListPath), { recursive: true });
    fs.writeFileSync(cacheListPath, Array.from(cacheSet).join('\n') + '\n', 'utf-8');
    console.log(`✅ 총 ${formatThousand(cacheSet.size)} 개의 기존 수집본을 cache.list에 등록했습니다.`);

    // 3. 📝 urls.txt 에서 중복 및 이미 완료된 캐시 대조 사전 필터링 (메모리 단에서 초고속 매칭)
    const rawUrls = fs.readFileSync(urlsFile, 'utf-8').split(/\r?\n/);
    const filteredUrls = [];
    rawUrls.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        
        const jobId = extractJobId(trimmed);
        if (!jobId || !cacheSet.has(jobId)) {
            filteredUrls.push(trimmed);
        }
    });

    const origCount = rawUrls.filter(l => l.trim() && !l.trim().startsWith('#')).length;
    const filteredCount = filteredUrls.length;
    console.log(`📊 전체 대상: ${formatThousand(origCount)}건 | 신규 처리 대상: ${formatThousand(filteredCount)}건`);

    if (filteredCount === 0) {
        console.log('🎉 [종료] 모든 채용 공고가 이미 정상 수집되었습니다.');
        process.exit(0);
    }

    // 4. 🔄 URL 순회 수집 파이프라인 구동
    const startTime = Date.now();
    let currentIndex = 0;

    for (const url of filteredUrls) {
        currentIndex++;
        const jobId = extractJobId(url);

        // 시간 계산 (런타임 & 예상 남은 시간 ETR)
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const runtimeStr = formatSeconds(elapsedSeconds);
        
        let etrStr = '계산 중...';
        if (currentIndex > 1) {
            const completedCount = currentIndex - 1;
            const remainingCount = filteredCount - completedCount;
            const avgSpeed = elapsedSeconds / completedCount;
            const remainingSeconds = Math.floor(avgSpeed * remainingCount);
            etrStr = formatSeconds(remainingSeconds);
        }

        const currentIndexFmt = formatThousand(currentIndex);
        const filteredCountFmt = formatThousand(filteredCount);

        console.log('\n==================================================');
        console.log(`🌐 [${currentIndexFmt}/${filteredCountFmt}][${runtimeStr}/${etrStr}]${loginStatus} 대상 ID: ${jobId} | URL: ${url}`);
        console.log('==================================================');

        // 🛡️ 기존 HTML 파일 재귀 검색 (모든 서브폴더 탐색)
        let savedHtml = '';
        const foundLocalFiles = getAllHtmlFiles(htmlDir).filter(f => path.basename(f) === `${jobId}.html`);
        if (foundLocalFiles.length > 0) {
            savedHtml = foundLocalFiles[0];
        }

        let htmlToProcess = '';
        let isNew = false;
        const tempHtmlPath = path.join(baseDir, `temp_${jobId}.html`);

        if (savedHtml && fs.existsSync(savedHtml) && fs.statSync(savedHtml).size > 0) {
            console.log('📥 [1/4] 이미 저장된 HTML 파일 감지 (다운로드 생략)');
            htmlToProcess = savedHtml;
        } else {
            console.log('📥 [1/4] 웹페이지 저장중 (get_html.js)...');
            try {
                execSync(`node src/get_html.js "${url}" "${tempHtmlPath}"`, { stdio: 'inherit' });
            } catch (err) {
                console.error('❌ 플레이라이트 실행 도중 오류가 발생했습니다.');
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
            console.log('🔍 [2/4] 핵심 정보 추출 및 마크다운 변환 중 (html2md.js)...');
            const htmlContent = fs.readFileSync(htmlToProcess, 'utf-8');
            const meta = convertHtmlToMarkdownCore(htmlContent, htmlToProcess);

            const targetMdDir = path.join(baseDir, 'markdown', meta.locationDirName, meta.postedDate);
            const correctHtmlDir = path.join(htmlDir, meta.locationDirName, meta.postedDate);
            const safeFileName = generateSafeFileName(meta.jobTitle, meta.company);
            const finalPath = path.join(targetMdDir, `${safeFileName}.md`);

            console.log(`📂 저장 경로 정의됨: ${finalPath}`);
            console.log('🧹 [3/4] 오픈소스 Prettier 기반 마크다운 정제 중 (prettify.js)...');
            console.log('⚙️ [오픈소스 Prettier] 기반 마크다운 구문 분석 및 가독성 정제 중...');
            
            // 프리티어 적용 후 최종 저장
            await prettifyAndSaveMarkdown(meta.rawContent, finalPath);
            console.log(`✨ 정제 완료! 저장 위치: ${finalPath}`);

            // HTML 재배치 및 캐시 세트 갱신
            const correctHtmlPath = path.join(correctHtmlDir, `${jobId}.html`);
            if (htmlToProcess !== correctHtmlPath) {
                if (htmlToProcess === tempHtmlPath) {
                    if (!fs.existsSync(correctHtmlDir)) fs.mkdirSync(correctHtmlDir, { recursive: true });
                    fs.renameSync(tempHtmlPath, correctHtmlPath);
                    console.log(`💾 [완료] 원본 HTML 저장 완료 -> ${correctHtmlPath}`);
                } else {
                    // 이미 html 하위에 있는 것은 재배치
                    if (!fs.existsSync(correctHtmlDir)) fs.mkdirSync(correctHtmlDir, { recursive: true });
                    fs.renameSync(htmlToProcess, correctHtmlPath);
                    console.log(`🚚 [HTML 재배치] -> ${correctHtmlPath}`);
                }
            }

            // 실시간 cache.list 갱신
            cacheSet.add(jobId);
            fs.appendFileSync(cacheListPath, `${jobId}\n`, 'utf-8');

            // 신규 추가 건에 한해 recent 복사본 저장
            if (isNew) {
                const recHtmlPath = path.join(recentHtmlDir, `${jobId}.html`);
                const recMdPath = path.join(recentMdDir, `${safeFileName}.md`);
                fs.copyFileSync(correctHtmlPath, recHtmlPath);
                fs.copyFileSync(finalPath, recMdPath);
                console.log('🆕 [신규 추가] 새 공고 복사본을 data/jobs/recent/ 하위에 저장 완료!');
            }

            console.log('✨ [4/4] 완료! 최종 마크다운 파일이 생성되었습니다.');

        } catch (err) {
            console.error(`❌ 변환 처리 도중 예외가 발생했습니다: ${err.message}`);
            if (htmlToProcess === tempHtmlPath && fs.existsSync(tempHtmlPath)) {
                fs.unlinkSync(tempHtmlPath);
            }
        }
    }

    // 6. 🧹 사후 정리 작업 (임시 md 파일 및 빈 폴더 삭제)
    function cleanEmptyDirs(dir) {
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
    }
    cleanEmptyDirs(htmlDir);
    cleanEmptyDirs(path.join(baseDir, 'markdown'));

    console.log('\n🎉 [종료] 일괄 처리 완료! 결과는 \'./data/jobs/html/[근무위치]/[포스팅날짜]/\' 및 \'./data/jobs/markdown/[근무위치]/[포스팅날짜]/\' 폴더를 확인하세요.');
})();
