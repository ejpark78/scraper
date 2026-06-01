const fs = require('fs');
const cheerio = require('cheerio');

function parseRelativeDate(relativeStr, timeStr, baseDateInput) {
    let baseDate = baseDateInput ? new Date(baseDateInput) : new Date();
    if (isNaN(baseDate.getTime())) {
        baseDate = new Date();
    }
    
    let daysAgo = 0;
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
            formattedTime = ` ${timeStr}`;
        }
    }
    
    return `${year}년 ${month}월 ${day}일${formattedTime}`;
}

// 1. 인자 입력 확인
const inputFile = process.argv[2];
const outputFile = process.argv[3] || 'job_summary.md';

if (!inputFile) {
    console.error('❌ 사용법: node html2md.js <입력_html_파일명> [출력_md_파일명]');
    process.exit(1);
}

try {
    console.log(`\n🤖 [1/5] 파일 읽기 시작...`);
    
    if (!fs.existsSync(inputFile)) {
        throw new Error(`파일을 찾을 수 없습니다: ${inputFile}`);
    }
    const fileStats = fs.statSync(inputFile);
    const baseDateInput = fileStats.mtime;
    const htmlContent = fs.readFileSync(inputFile, 'utf-8');
    
    console.log(`🚀 [2/5] HTML 구문 분석 파싱 중...`);
    const $ = cheerio.load(htmlContent);

    console.log(`🔍 [3/5] 채용 공고 핵심 데이터 추출 중...`);

    // 🌟 [핵심 수정] Posted 문구가 들어간 og:description 대신 실제 상단 카드에서 회사명 직접 추출
    let company = $('.topcard__flavor a, .job-details-jobs-unified-top-card__company-name, [data-tracking-control-name="public_jobs_topcard-company-name"]').first().text().trim();
    if (!company) {
        let ogDesc = $('meta[property="og:description"]').attr('content') || '';
        if (ogDesc.includes(' hiring ')) {
            company = ogDesc.split(' hiring ')[0].replace(/Posted.*?\.\s*/i, '').trim();
        } else {
            company = ogDesc.replace(/Posted.*?\.\s*/i, '').substring(0, 20).trim();
        }
    }

    // 공고 제목 추출
    let jobTitle = $('.topcard__title, h1, .job-details-jobs-unified-top-card__job-title').first().text().trim();
    if (!jobTitle) {
        let ogTitle = $('meta[property="og:title"]').attr('content') || '';
        jobTitle = ogTitle.includes(' hiring ') ? ogTitle.split(' hiring ')[1]?.split(' in ')[0] : ogTitle;
    }

    // 근무 위치 추출 및 깔끔하게 줄바꿈 정리
    let location = $('.topcard__flavor--metadata, .job-details-jobs-unified-top-card__flavor--bullet, .topcard__flavor:nth-child(2)').first().text().trim();
    location = location.replace(/\s+/g, ' '); 

    // 근무 형태 및 고용 형태 추출
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

    // 메인 채용 본문 컨테이너 타겟팅 및 리스트 정렬
    const descriptionContainer = $('.description__text, .jobs-description__content, .jobs-box__html-content');
    let aboutCompanyText = '정보 없음';
    let jdText = '정보 없음';

    if (descriptionContainer.length > 0) {
        let formattedText = '';

        // 본문 태그 순회하며 완벽한 마크다운 기호 배치
        descriptionContainer.find('p, li, h1, h2, h3, h4, h5, h6').each((index, element) => {
            const node = $(element);
            let lineHtml = node.html() || '';

            lineHtml = lineHtml.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
                               .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');

            lineHtml = lineHtml.replace(/&amp;/g, '&')
                               .replace(/&nbsp;/g, ' ')
                               .replace(/&lt;/g, '<')
                               .replace(/&gt;/g, '>');

            let cleanLineText = cheerio.load(lineHtml).text().trim();

            if (cleanLineText) {
                if (element.name === 'li') {
                    formattedText += `- ${cleanLineText}\n`;
                } else if (element.name.match(/^h[1-6]$/)) {
                    const level = element.name.substring(1);
                    formattedText += `\n${ '#'.repeat(level) } ${cleanLineText}\n\n`;
                } else {
                    formattedText += `${cleanLineText}\n\n`;
                }
            }
        });

        formattedText = formattedText.trim();

        // 🌟 고도화된 회사 소개와 JD 분리 로직 (Split Heuristic)
        const companyEscaped = company ? company.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&') : '';
        let splitDone = false;

        // Heuristic 1: 회사 소개 전용 헤더 매칭 (예: "회사 소개", "About Us", "About [Company]")
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

        // Heuristic 2: 첫 부분부터 시작하여 명확한 JD 타이틀(담당업무, Responsibilities) 전까지를 회사 소개로 분리
        if (!splitDone) {
            const jdStartRegex = /(?:^|\n)(?:#+\\s+)?(Responsibilities|What\s+you'll\s+do|What\s+you\s+will\s+do|What\s+we\s+are\s+looking\s+for|Qualifications|Requirements|담당\s*업무|주요\s*업무|자격\s*요건|우대\s*사항)(?:\s|\n|:|$)/i;
            const jdMatch = formattedText.match(jdStartRegex);
            if (jdMatch && jdMatch.index > 0) {
                const splitIndex = jdMatch.index;
                const prospectiveCompanyText = formattedText.substring(0, splitIndex).trim();
                
                // 최소 20자 이상이고, 텍스트 상단에 실제 회사 설명이 있는 경우에만 분리 적용
                if (prospectiveCompanyText.length >= 20) {
                    aboutCompanyText = prospectiveCompanyText;
                    jdText = formattedText.substring(splitIndex).trim();
                    splitDone = true;
                }
            }
        }

        // Heuristic 3: 매칭되지 않은 경우 HTML 헤더의 og:description 메타데이터에서 요약본 추출 시도
        if (!splitDone) {
            jdText = formattedText;
            
            let metaDesc = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content') || '';
            if (metaDesc) {
                // Posted 날짜 문구 및 후반부 안내문(See this...)을 지능적으로 정제
                let cleanMeta = metaDesc
                    .replace(/^Posted\s+[^.]+\.\s*/i, '') // "Posted 3:14:38 PM. " 등 영어 제거
                    .replace(/^Posted\s+[^.일년주월시분초]+\.\s*/i, '') // 한글 Posted 대비
                    .split(/See\s+this\s+and\s+similar/i)[0] // 후반 안내 제거
                    .trim();
                
                // 유의미한 길이이고, 구인 공고 직접 지원 안내가 아닌 회사 소개 목적의 설명인 경우 분리
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

    console.log(`📝 [4/5] 마크다운 문서 템플릿 렌더링 중...`);

    // 🏢 회사 소개 정보가 존재할 때만 관련 마크다운 섹션과 구분선을 추가하고, 정보가 없을 경우 섹션 자체를 완전히 생략
    let aboutCompanySection = '';
    if (aboutCompanyText && aboutCompanyText !== '정보 없음') {
        aboutCompanySection = `
---

## 🏢 About the Company (회사 소개)
${aboutCompanyText}
`;
    }

    const markdownOutput = `
# 📌 채용 공고 핵심 요약

## 🏢 기본 및 근무 정보
* **공고 제목:** ${jobTitle || '정보 없음'}
* **회사명:** ${company || '정보 없음'}
* **근무 위치:** ${location || '정보 없음'}
* **근무 형태 (Workplace):** ${workplaceType}
* **고용 형태 (Job Type):** ${jobType || '정보 없음'}
* **지원 방식 (Apply Type):** ${applyType}
* **포스팅 날짜 (Posted Date):** ${postedDate}
* **공고 링크:** [바로가기](${jobLink})
${aboutCompanySection}

---

## 📝 JD (직무 기술서 / Job Description)
${jdText}
`;

    console.log(`💾 [5/5] 임시 마크다운 파일 저장 중 -> ${outputFile}`);
    fs.writeFileSync(outputFile, markdownOutput.trim() + '\n', 'utf-8');
    console.log(`✨ 변환 작업이 성공적으로 끝났습니다!\n`);

} catch (error) {
    console.error(`❌ 변환 처리 중 오류 발생: ${error.message}`);
    process.exit(1);
}