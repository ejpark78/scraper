const fs = require('fs');
const prettier = require('prettier');

const inputFile = process.argv[2];
const outputFile = process.argv[3] || 'prettified_output.md';

if (!inputFile) {
    console.error('❌ 사용법: node prettify.js <대상_md_파일> [출력_md_파일]');
    process.exit(1);
}

async function run() {
    try {
        if (!fs.existsSync(inputFile)) {
            throw new Error(`파일을 찾을 수 없습니다: ${inputFile}`);
        }
        
        let text = fs.readFileSync(inputFile, 'utf-8');
        
        console.log(`⚙️  [오픈소스 Prettier] 기반 마크다운 구문 분석 및 가독성 정제 중...`);

        // 링크드인에서 딸려오는 잔재 텍스트 1차 정제
        text = text.replace(/Show\s+more\s*\n*\s*Show\s+less/gi, '');

        // 🌟 Prettier 오픈소스를 호출하여 마크다운 정렬 수행
        // proseWrap: "preserve" 옵션을 통해 원본 문단의 줄바꿈 구조를 억지로 뭉개지 않고 이쁘게 포맷팅합니다.
        const prettifiedText = await prettier.format(text, {
            parser: 'markdown',
            proseWrap: 'preserve', 
            tabWidth: 2,
            printWidth: 100
        });

        fs.writeFileSync(outputFile, prettifiedText, 'utf-8');
        console.log(`✨ 정제 완료! 저장 위치: ${outputFile}\n`);

    } catch (error) {
        console.error(`\n❌ 오류 발생: ${error.message}`);
        process.exit(1);
    }
}

run();