import * as fs from 'fs';
import * as path from 'path';

function scanRawHtml() {
    const htmlPath = path.join(__dirname, '..', 'data', 'compay', 'html', '42dot.html');
    if (!fs.existsSync(htmlPath)) {
        return;
    }

    const html = fs.readFileSync(htmlPath, 'utf-8');
    const codeRegex = /<code[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/code>/g;
    let match;

    while ((match = codeRegex.exec(html)) !== null) {
        const id = match[1];
        let content = match[2].trim();

        if (content.startsWith('<!--') && content.endsWith('-->')) {
            content = content.substring(4, content.length - 3).trim();
        }

        if (!content) continue;

        const sanitizedContent = content
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');

        try {
            const obj = JSON.parse(sanitizedContent);
            
            if (obj.included && Array.isArray(obj.included)) {
                // 42dot에 매칭되는 회사 정보를 찾습니다.
                const targetCompany = obj.included.find((item: any) => 
                    item.$type?.includes('organization.Company') && item.universalName === '42dot'
                );

                if (targetCompany) {
                    console.log(`\n🎉 [발견] 42dot 메인 Company 데이터! ID: ${id}`);
                    console.log(targetCompany);

                    // 연관된 다른 상세 객체들(예: 회사 상세 메타, 본사 주소 등)도 출력해봅니다.
                    // entityUrn 형태로 연계 관계가 맺어집니다.
                    const entityUrn = targetCompany.entityUrn;
                    console.log(`\n🔗 entityUrn (${entityUrn}) 에 대한 연계 객체들 탐색:`);
                    
                    obj.included.forEach((item: any) => {
                        // entityUrn을 가리키는 다른 객체들을 검사
                        const str = JSON.stringify(item);
                        if (str.includes(entityUrn) && item !== targetCompany) {
                            console.log(`- $type: ${item.$type}`);
                            console.log(item);
                        }
                    });
                    break;
                }
            }
        } catch (e: any) {
            // 무시
        }
    }
}

scanRawHtml();
