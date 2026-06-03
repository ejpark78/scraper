import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import { CompanyMarkdownConverter } from './company_converter';
import { NamingUtils, IOUtils } from './utils';

async function main() {
    const baseDir = path.join(__dirname, '..', 'data', 'compay');
    const htmlDir = path.join(baseDir, 'html');
    const mdDir = path.join(baseDir, 'markdown');
    
    if (!fs.existsSync(htmlDir)) {
        console.error('HTML directory does not exist');
        process.exit(1);
    }
    
    // 하위 디렉토리에 있는 모든 HTML 파일을 재귀적으로 검색
    const files = IOUtils.getAllFiles(htmlDir, '.html').filter(f => !path.basename(f).startsWith('temp_'));
    console.log(`♻️  Migrating ${files.length} HTML files to full country-name subdirectories...`);
    
    const converter = new CompanyMarkdownConverter();
    
    for (const htmlPath of files) {
        const companyName = path.basename(htmlPath, '.html');
        const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
        
        const $ = cheerio.load(htmlContent);
        const titleText = $('title').text() || '';
        const mainTitleName = titleText.replace(': About | LinkedIn', '').replace('| LinkedIn', '').trim();
        
        let cleanFileName = companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
        let companyId = cleanFileName;
        
        const codeRegex = /<code[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/code>/g;
        let match;
        
        while ((match = codeRegex.exec(htmlContent)) !== null) {
            let content = match[2].trim();
            if (content.startsWith('<!--') && content.endsWith('-->')) {
                content = content.substring(4, content.length - 3).trim();
            }
            if (!content) continue;
            
            try {
                const obj = JSON.parse(content.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'));
                if (obj.included && Array.isArray(obj.included)) {
                    const companies = obj.included.filter((item: any) => item.$type?.includes('organization.Company'));
                    if (companies.length > 0) {
                        let matched = companies.find((c: any) => 
                            c.name?.trim().replace(/\s+/g, ' ').toLowerCase() === mainTitleName.toLowerCase()
                        );
                        if (!matched) {
                            matched = companies.find((c: any) => 
                                c.universalName?.toLowerCase() === cleanFileName
                            );
                        }
                        if (matched && matched.universalName) {
                            companyId = matched.universalName;
                            break;
                        }
                    }
                }
            } catch (e) {}
        }
        
        const companyUrl = `https://www.linkedin.com/company/${companyId}`;
        const meta = converter.convertHtmlToMarkdown(htmlContent, companyId, companyUrl);
        
        // 국가 코드 ➡️ 실제 영문 국가명 변환
        let countryDir = 'Unknown';
        if (meta.hqCountry && meta.hqCountry !== '정보 없음') {
            countryDir = NamingUtils.convertCountryCodeToName(meta.hqCountry);
        }
            
        const safeFileName = meta.companyName
            .replace(/[\/\\:\*\?"<>\|]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim() || companyId;
            
        const finalHtmlDir = path.join(htmlDir, countryDir);
        const finalMdDir = path.join(mdDir, countryDir);
        
        if (!fs.existsSync(finalHtmlDir)) {
            fs.mkdirSync(finalHtmlDir, { recursive: true });
        }
        if (!fs.existsSync(finalMdDir)) {
            fs.mkdirSync(finalMdDir, { recursive: true });
        }
        
        const finalMdPath = path.join(finalMdDir, `${safeFileName}.md`);
        const finalHtmlPath = path.join(finalHtmlDir, `${safeFileName}.html`);
        
        // 1. 마크다운 저장
        await converter.prettifyAndSave(meta.rawContent, finalMdPath);
        
        // 2. HTML 파일 이동 및 구버전 파일 삭제
        if (htmlPath !== finalHtmlPath) {
            if (fs.existsSync(finalHtmlPath)) {
                fs.unlinkSync(finalHtmlPath);
            }
            fs.renameSync(htmlPath, finalHtmlPath);
        }
        
        // 3. 기존의 이전 경로에 존재하던 md 파일 삭제 (flat md 및 예전 md)
        const oldMdFolderOfCurrentHtml = path.dirname(htmlPath).replace(htmlDir, mdDir);
        const oldMdPath = path.join(oldMdFolderOfCurrentHtml, `${companyName}.md`);
        if (oldMdPath !== finalMdPath && fs.existsSync(oldMdPath)) {
            fs.unlinkSync(oldMdPath);
        }
        
        const oldMdPathAlt = path.join(oldMdFolderOfCurrentHtml, `${safeFileName}.md`);
        if (oldMdPathAlt !== finalMdPath && fs.existsSync(oldMdPathAlt)) {
            fs.unlinkSync(oldMdPathAlt);
        }
        
        console.log(`   📂 Migrated: [${countryDir}] ${companyName} -> ${safeFileName}.html / .md`);
    }
    
    // 4. 빈 서브 디렉토리 정리 (KR, US, GB 등 예전 2자리 국가코드 빈 폴더 청소)
    cleanEmptySubdirs(htmlDir);
    cleanEmptySubdirs(mdDir);
    
    console.log('🎉 Country name migration finished successfully!');
}

function cleanEmptySubdirs(dirPath: string) {
    if (!fs.existsSync(dirPath)) return;
    const subdirs = fs.readdirSync(dirPath).map(n => path.join(dirPath, n)).filter(p => fs.statSync(p).isDirectory());
    for (const subdir of subdirs) {
        // 하위 폴더 내부에 또 폴더가 있거나 파일이 있는지 재귀적/단층 확인 후 삭제
        const files = fs.readdirSync(subdir);
        if (files.length === 0) {
            fs.rmdirSync(subdir);
            console.log(`   🧹 Deleted empty directory: ${subdir}`);
        }
    }
}

main().catch(err => {
    console.error('Error during country name migration:', err);
});
