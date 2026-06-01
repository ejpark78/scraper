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

        const positionRegex = /Position\s*:/i;
        const splitIndex = formattedText.search(positionRegex);

        if (splitIndex !== -1) {
            aboutCompanyText = formattedText.substring(0, splitIndex).trim();
            jdText = formattedText.substring(splitIndex).trim();
        } else {
            jdText = formattedText;
            aboutCompanyText = '본문 내에서 명확한 회사 소개 섹션을 분리하지 못했습니다. (전체 내용은 하단 JD 본문을 참고하세요)';
        }
    }

    console.log(`📝 [4/5] 마크다운 문서 템플릿 렌더링 중...`);
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

---

## 🏢 About the Company (회사 소개)
${aboutCompanyText}

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