const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const prettier = require('prettier');

// 🕒 상대 시간을 날짜 포맷(YYYY-MM-DD)으로 변환하는 정밀 헬퍼
function parseRelativeDate(relativeStr, timeStr, baseDateInput) {
    let baseDate = baseDateInput ? new Date(baseDateInput) : new Date();
    if (isNaN(baseDate.getTime())) {
        baseDate = new Date();
    }
    
    let daysAgo = 0;
    let foundRelative = false;
    
    if (relativeStr) {
        let match = relativeStr.match(/(\d+)\s*(day|week|month|year|hour|minute|second|일|주|달|개월|년|시간|분|초)s?\s*ago/i) ||
                    relativeStr.match(/(\d+)\s*(일|주|달|개월|년|시간|분|초)\s*전/i) ||
                    relativeStr.match(/(\d+)\s*(day|week|month|year|hour|minute|second)s?/i);
        if (match) {
            let val = parseInt(match[1]);
            let unit = match[2].toLowerCase();
            if (unit.startsWith('day') || unit === '일') {
                daysAgo = val;
            } else if (unit.startsWith('week') || unit === '주') {
                daysAgo = val * 7;
            } else if (unit.startsWith('month') || unit === '달' || unit === '개월') {
                daysAgo = val * 30;
            } else if (unit.startsWith('year') || unit === '년') {
                daysAgo = val * 365;
            }
            foundRelative = true;
        }
    }
    
    if (!foundRelative && timeStr) {
        let match = timeStr.match(/(\d+)\s*(day|week|month|year|hour|minute|second|일|주|달|개월|년|시간|분|초)s?\s*ago/i) ||
                    timeStr.match(/(\d+)\s*(일|주|달|개월|년|시간|분|초)\s*전/i) ||
                    timeStr.match(/(\d+)\s*(day|week|month|year|hour|minute|second)s?/i);
        if (match) {
            let val = parseInt(match[1]);
            let unit = match[2].toLowerCase();
            if (unit.startsWith('day') || unit === '일') {
                daysAgo = val;
            } else if (unit.startsWith('week') || unit === '주') {
                daysAgo = val * 7;
            } else if (unit.startsWith('month') || unit === '달' || unit === '개월') {
                daysAgo = val * 30;
            } else if (unit.startsWith('year') || unit === '년') {
                daysAgo = val * 365;
            }
            foundRelative = true;
        }
    }
    
    baseDate.setDate(baseDate.getDate() - daysAgo);
    
    let year = baseDate.getFullYear();
    let month = String(baseDate.getMonth() + 1).padStart(2, '0');
    let day = String(baseDate.getDate()).padStart(2, '0');
    
    let formattedTime = "";
    if (timeStr) {
        let timeMatch = timeStr.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
        if (timeMatch) {
            let hour = parseInt(timeMatch[1]);
            let min = String(timeMatch[2]).padStart(2, '0');
            let sec = String(timeMatch[3]).padStart(2, '0');
            let ampm = timeMatch[4].toUpperCase();
            if (ampm === 'PM' && hour < 12) hour += 12;
            if (ampm === 'AM' && hour === 12) hour = 0;
            formattedTime = ` ${String(hour).padStart(2, '0')}:${min}:${sec}`;
        } else {
            let parsedTimeDate = new Date(timeStr);
            if (!isNaN(parsedTimeDate.getTime()) && !foundRelative) {
                year = parsedTimeDate.getFullYear();
                month = String(parsedTimeDate.getMonth() + 1).padStart(2, '0');
                day = String(parsedTimeDate.getDate()).padStart(2, '0');
            } else if (isNaN(parsedTimeDate.getTime())) {
                formattedTime = ` ${timeStr}`;
            }
        }
    }
    
    return `${year}-${month}-${day}${formattedTime}`;
}

// DOM 엘리먼트를 마크다운으로 깔끔하게 정비하는 함수 (HTML Tag 대응)
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

// 🛡️ 근무지 지리 매핑 및 표준화 규칙 적용
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

// 🌟 단일 HTML 파일을 마크다운 변환 및 메타 데이터 객체 반환 함수
function convertHtmlToMarkdownRaw(htmlPath) {
    if (!fs.existsSync(htmlPath)) {
        throw new Error(`파일을 찾을 수 없습니다: ${htmlPath}`);
    }
    const fileStats = fs.statSync(htmlPath);
    const baseDateInput = fileStats.mtime;
    const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
    const $ = cheerio.load(htmlContent);

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
    if (!postedDate || postedDate.startsWith('NaN년')) {
        postedDate = '정보 없음';
    }

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

        // 고도화된 회사 소개와 JD 분리 로직 (Split Heuristic)
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

    // 날짜 표준화 포맷 구하기 (YYYY-MM-DD)
    let standardDate = postedDate.split(' ')[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(standardDate)) {
        standardDate = new Date().toISOString().split('T')[0];
    }

    return {
        jobId,
        company,
        jobTitle,
        rawLocation: location,
        locationDirName: standardizeLocation(location),
        postedDate: standardDate,
        rawContent: markdownOutput
    };
}

// 🌟 Prettier 포맷터를 내장하여 즉시 정제 저장하는 헬퍼 함수
async function prettifyAndSaveMarkdown(rawText, outputPath) {
    try {
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
    } catch (err) {
        // 프리티어 실패 시 안전하게 원본 텍스트 백업 저장
        fs.writeFileSync(outputPath, rawText, 'utf-8');
    }
}

// 📦 다국어 파일명 인코딩 & HTML 특수 기호(&amp; -> &) 안전 디코딩 대응 규칙 적용하여 파일명 구하기
function generateSafeFileName(jobTitle, company) {
    let cleanTitle = (jobTitle || '정보 없음').trim();
    let cleanCompany = (company || '정보 없음').trim();
    
    // HTML 특수 기호 해소
    cleanTitle = cleanTitle.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
    cleanCompany = cleanCompany.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    // 윈도우/리눅스 파일 시스템 금지문자 제거
    let safeName = `${cleanCompany} - ${cleanTitle}`
        .replace(/[\/\\:\*\?"<>\|]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
        
    if (!safeName || safeName === '-') {
        safeName = '정보 없음 - 정보 없음';
    }
    
    // 파일명 인코딩 글자 수 안전 제한 (200바이트 한계 방지)
    if (safeName.length > 80) {
        safeName = safeName.substring(0, 80).trim();
    }
    return safeName;
}

// ⚡ [모드 2] data/jobs/html 과 data/jobs/markdown 간 유실 파일 실시간 일괄 오프라인 동기화 함수
async function syncHtmlToMarkdown() {
    console.log('🔄 [동기화 검사 시작] data/jobs/html 내의 HTML 캐시와 data/jobs/markdown 내 마크다운 일치성을 검사합니다.');
    
    const htmlDir = path.join(__dirname, '..', 'data', 'jobs', 'html');
    const mdDir = path.join(__dirname, '..', 'data', 'jobs', 'markdown');
    
    if (!fs.existsSync(htmlDir)) {
        fs.mkdirSync(htmlDir, { recursive: true });
    }
    if (!fs.existsSync(mdDir)) {
        fs.mkdirSync(mdDir, { recursive: true });
    }

    // data/jobs/html 경로 아래의 모든 html 파일 탐색 (재귀)
    function getAllHtmlFiles(dir) {
        let results = [];
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

    const htmlFiles = getAllHtmlFiles(htmlDir);
    console.log(`📂 총 ${htmlFiles.length} 개의 HTML 백업본이 발견되었습니다.`);

    for (const htmlFile of htmlFiles) {
        try {
            const meta = convertHtmlToMarkdownRaw(htmlFile);
            const safeFileName = generateSafeFileName(meta.jobTitle, meta.company);
            
            const targetMdDir = path.join(mdDir, meta.locationDirName, meta.postedDate);
            const targetMdPath = path.join(targetMdDir, `${safeFileName}.md`);

            // 1. 마크다운 파일이 존재하지 않거나 크기가 0이면 일괄 복원 및 Prettify
            if (!fs.existsSync(targetMdPath) || fs.statSync(targetMdPath).size === 0) {
                console.log(`🆕 [누락 발견] 마크다운 복원 및 변환 중 -> ${safeFileName}.md`);
                await prettifyAndSaveMarkdown(meta.rawContent, targetMdPath);
                console.log(`💾 [복원 완료] -> ${targetMdPath}`);
            }

            // 2. HTML 원본 파일 경로 재배치 동기화 (posts 분류 규칙과 html 분류 구조 일치시킴)
            const correctHtmlDir = path.join(htmlDir, meta.locationDirName, meta.postedDate);
            const correctHtmlPath = path.join(correctHtmlDir, `${meta.jobId}.html`);

            if (htmlFile !== correctHtmlPath) {
                console.log(`🚚 [HTML 재배치] ${path.basename(htmlFile)} -> ${meta.locationDirName}/${meta.postedDate}/${meta.jobId}.html`);
                if (!fs.existsSync(correctHtmlDir)) {
                    fs.mkdirSync(correctHtmlDir, { recursive: true });
                }
                fs.renameSync(htmlFile, correctHtmlPath);
            }

        } catch (err) {
            console.error(`⚠️ [실패] HTML 구조 분석 또는 마크다운 생성 실패 (스킵): ${htmlFile} - ${err.message}`);
        }
    }

    // 3. 작업 중 남겨진 빈 폴더 정리 함수
    function cleanEmptyDirs(dir) {
        if (!fs.existsSync(dir)) return;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                cleanEmptyDirs(fullPath);
            }
        });
        if (dir !== htmlDir && dir !== mdDir) {
            const updatedList = fs.readdirSync(dir);
            if (updatedList.length === 0) {
                fs.rmdirSync(dir);
            }
        }
    }
    cleanEmptyDirs(htmlDir);
    cleanEmptyDirs(mdDir);

    console.log('✨ [동기화 완료] data/jobs/html/ 과 data/jobs/markdown/ 디렉토리 구조가 완벽하게 일치합니다.');
}

// ==========================================
// 🚀 진입점 실행 옵션 분기 처리 (모드 1 vs 모드 2)
// ==========================================
(async () => {
    const inputFile = process.argv[2];
    const outputFile = process.argv[3];

    if (inputFile && outputFile) {
        // [모드 1] 단일 독립 변환 및 즉시 저장
        try {
            console.log(`\n🤖 [1/5] 파일 읽기 시작...`);
            const meta = convertHtmlToMarkdownRaw(inputFile);
            console.log(`🚀 [2/5] HTML 구문 분석 파싱 완료. 메타 정보 추출됨.`);
            console.log(`🔍 [3/5] 마크다운 변환 완료.`);
            console.log(`📝 [4/5] Prettier 기반 마크다운 가독성 정제 중...`);
            await prettifyAndSaveMarkdown(meta.rawContent, outputFile);
            console.log(`💾 [5/5] 파일 저장 완료 -> ${outputFile}\n`);
            process.exit(0);
        } catch (error) {
            console.error(`❌ 변환 처리 중 오류 발생: ${error.message}`);
            process.exit(1);
        }
    } else {
        // [모드 2] 일괄 오프라인 동기화 검사 실행
        await syncHtmlToMarkdown();
        process.exit(0);
    }
})();