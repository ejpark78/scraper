import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';

function inspect() {
    const htmlPath = path.join(__dirname, '..', 'data', 'compay', 'html', '42dot.html');
    if (!fs.existsSync(htmlPath)) {
        console.error('❌ 42dot.html 파일이 존재하지 않습니다. 먼저 크롤링해 주세요.');
        return;
    }

    const html = fs.readFileSync(htmlPath, 'utf-8');
    const $ = cheerio.load(html);

    console.log(`📊 42dot.html 내 총 ${$('code').length}개의 <code> 태그 발견.`);

    $('code').each((i, el) => {
        const id = $(el).attr('id') || '';
        let text = $(el).html() || '';
        
        // HTML 주석 제거/추출
        text = text.trim();
        if (text.startsWith('<!--') && text.endsWith('-->')) {
            text = text.substring(4, text.length - 3).trim();
        }

        if (!text) return;

        try {
            const obj = JSON.parse(text);
            console.log(`\n[CODE ${i + 1}] ID: ${id}`);
            
            // 객체의 최상위 키 출력 및 데이터 형태 요약
            const keys = Object.keys(obj);
            console.log(`  - Top-level Keys:`, keys);

            if (obj.data) {
                console.log(`  - data Keys:`, Object.keys(obj.data));
                if (obj.data.$type) {
                    console.log(`  - data $type:`, obj.data.$type);
                }
                
                // 회사 정보 관련 데이터 스캔 (예: name, description, universalName, companyPageUrl)
                // 만약 특정 타입(예: com.linkedin.voyager.dash.organization.Company)이라면 상세 출력
                if (JSON.stringify(obj.data).includes('42dot') || obj.data.$type?.includes('Company') || obj.data.$type?.includes('Organization')) {
                    console.log(`  - ⭐ 회사 관련 데이터 유망군 감지!`);
                    console.log(`    $type: ${obj.data.$type}`);
                    // 깊이 2단계 정도까지 간략 출력
                    const snippet: any = {};
                    for (const k of Object.keys(obj.data)) {
                        const val = obj.data[k];
                        if (typeof val !== 'object') {
                            snippet[k] = val;
                        } else if (val === null) {
                            snippet[k] = null;
                        } else {
                            snippet[k] = Array.isArray(val) ? `[Array(${val.length})]` : `{Object keys: ${Object.keys(val).join(', ')}}`;
                        }
                    }
                    console.log(`    Details:`, snippet);
                }
            } else if (Array.isArray(obj)) {
                console.log(`  - Is Array: Length ${obj.length}`);
                if (obj.length > 0) {
                    console.log(`    First item sample:`, Object.keys(obj[0]));
                }
            } else {
                console.log(`  - Sample:`, text.substring(0, 150));
            }
        } catch (e: any) {
            // JSON이 아닌 경우 스킵
            console.log(`\n[CODE ${i + 1}] ID: ${id} - JSON 파싱 실패: ${e.message}`);
        }
    });
}

inspect();
