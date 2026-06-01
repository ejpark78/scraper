const fs = require('fs');

// 셸 스크립트로부터 타겟 마크다운 파일 경로를 인자로 받음
const targetMdFile = process.argv[2];

if (!targetMdFile) {
    console.log('unknown_job');
    process.exit(1);
}

try {
    if (!fs.existsSync(targetMdFile)) {
        throw new Error('파일 없음');
    }

    const md = fs.readFileSync(targetMdFile, 'utf-8');
    
    // 🌟 [수정] 마크다운 변환 시 포함될 수 있는 별표(*) 개수 차이 및 한글/영어/바이링구얼 라벨을 모두 수용하도록 정규식 개선
    const titleMatch = md.match(/\* \*\*(?:공고 제목|Job Title)(?: \([^)]+\))?:\*\* (.+)/) || md.match(/\* \*(?:공고 제목|Job Title)(?: \([^)]+\))?:\* (.+)/);
    const companyMatch = md.match(/\* \*\*(?:회사명|Company)(?: \([^)]+\))?:\*\* (.+)/) || md.match(/\* \*(?:회사명|Company)(?: \([^)]+\))?:\* (.+)/);
    const locationMatch = md.match(/\* \*\*(?:근무 위치|Location)(?: \([^)]+\))?:\*\* (.+)/) || md.match(/\* \*(?:근무 위치|Location)(?: \([^)]+\))?:\* (.+)/);
    
    let title = titleMatch ? titleMatch[1].trim() : '알 수 없는 공고';
    let company = companyMatch ? companyMatch[1].trim() : '알 수 없는 회사';
    let location = locationMatch ? locationMatch[1].trim() : '알 수 없는 위치';
    
    // 🔤 HTML 특수문자 엔티티 원복 (&amp; -> & 등)
    const decodeHtmlEntities = (str) => {
        return str
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
    };

    // 파일 시스템 금지 특수문자 박멸 (\ / : * ? " < > |)
    const clean = (str) => {
        let decoded = decodeHtmlEntities(str);
        // 혹시 파일명에 마크다운용 볼드 기호가 남아있다면 제거
        decoded = decoded.replace(/\*\*/g, '').replace(/\*/g, '');
        return decoded.replace(/[\/\\:\*\?"<>\|]/g, '').trim();
    };
    
    // 최종 파일명 형식 조립 출력 (셸 스크립트 캡처용)
    console.log(`${clean(company)} - ${clean(title)}`);
} catch (e) {
    console.log('unknown_job');
}