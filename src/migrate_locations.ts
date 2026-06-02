import * as fs from 'fs';
import * as path from 'path';
import { LinkedInMarkdownConverter } from './markdown_converter';
import { NamingUtils, UrlUtils } from './utils';

// 📂 HTML 캐시 및 MD 포스트 국가명 표준화 마이그레이션 엔진

async function migrate() {
    console.log('🚀 [국가명 표준화 마이그레이션] 기동 중...');
    
    const baseDir = path.join(__dirname, '..', 'data', 'jobs');
    const htmlDir = path.join(baseDir, 'html');
    const mdDir = path.join(baseDir, 'markdown');
    
    if (!fs.existsSync(htmlDir)) {
        console.log('💡 HTML 폴더가 존재하지 않아 마이그레이션을 건너뜁니다.');
        return;
    }
    
    const converter = new LinkedInMarkdownConverter();
    
    // 1. 모든 HTML 파일 검색
    function getFiles(dir: string, extension: string): string[] {
        let results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                results = results.concat(getFiles(fullPath, extension));
            } else if (file.endsWith(extension)) {
                results.push(fullPath);
            }
        });
        return results;
    }
    
    const htmlFiles = getFiles(htmlDir, '.html');
    console.log(`📊 총 ${htmlFiles.length} 개의 HTML 백업본을 찾았습니다.`);
    
    // jobId -> new HTML path, new MD folder path, new MD filename
    const jobMigrationMap = new Map<string, {
        newHtmlPath: string;
        locationDirName: string;
        postedDate: string;
        company: string;
        jobTitle: string;
    }>();
    
    let htmlMigrateCount = 0;
    
    // HTML 파일들을 먼저 새 국가명 표준에 맞게 재배치
    for (const oldHtmlPath of htmlFiles) {
        const jobId = path.basename(oldHtmlPath, '.html');
        if (!/^\d+$/.test(jobId)) continue;
        
        try {
            const htmlContent = fs.readFileSync(oldHtmlPath, 'utf-8');
            const meta = converter.convertHtmlToMarkdown(htmlContent, oldHtmlPath);
            
            const newHtmlFolder = path.join(htmlDir, meta.locationDirName, meta.postedDate);
            const newHtmlPath = path.join(newHtmlFolder, `${jobId}.html`);
            
            jobMigrationMap.set(jobId, {
                newHtmlPath,
                locationDirName: meta.locationDirName,
                postedDate: meta.postedDate,
                company: meta.company,
                jobTitle: meta.jobTitle
            });
            
            if (oldHtmlPath !== newHtmlPath) {
                if (!fs.existsSync(newHtmlFolder)) {
                    fs.mkdirSync(newHtmlFolder, { recursive: true });
                }
                // 파일 이동
                fs.renameSync(oldHtmlPath, newHtmlPath);
                htmlMigrateCount++;
            }
        } catch (e: any) {
            console.error(`⚠️ HTML [${jobId}] 파싱/이동 실패: ${e.message}`);
        }
    }
    
    console.log(`💾 HTML 캐시 재배치 완료: 총 ${htmlMigrateCount} 개 파일 이동`);
    
    // 2. 모든 MD 파일 검색 및 이동
    const mdFiles = getFiles(mdDir, '.md');
    console.log(`📊 총 ${mdFiles.length} 개의 마크다운 포스트를 찾았습니다.`);
    
    let mdMigrateCount = 0;
    
    for (const oldMdPath of mdFiles) {
        try {
            const content = fs.readFileSync(oldMdPath, 'utf-8');
            const match = content.match(/job_id:\s*"(\d+)"/) || content.match(/job_id:\s*(\d+)/);
            if (!match) continue;
            
            const jobId = match[1];
            const migInfo = jobMigrationMap.get(jobId);
            
            if (migInfo) {
                const newMdFolder = path.join(mdDir, migInfo.locationDirName, migInfo.postedDate);
                const safeMdFileName = NamingUtils.generateSafeFileName(migInfo.jobTitle, migInfo.company);
                const newMdPath = path.join(newMdFolder, `${safeMdFileName}.md`);
                
                if (oldMdPath !== newMdPath) {
                    if (!fs.existsSync(newMdFolder)) {
                        fs.mkdirSync(newMdFolder, { recursive: true });
                    }
                    
                    // 기존에 동일 경로에 파일이 있는 경우 덮어쓰기 or 안전 제거 후 이동
                    if (fs.existsSync(newMdPath) && oldMdPath !== newMdPath) {
                        fs.unlinkSync(oldMdPath); // 중복 유실본 등 기존 비표준 경로의 잉여 파일 제거
                    } else {
                        fs.renameSync(oldMdPath, newMdPath);
                    }
                    mdMigrateCount++;
                }
            } else {
                console.log(`💡 HTML 백업이 유실되었거나 없는 MD 포스트 감지 [ID: ${jobId}], 직접 파싱 시도...`);
                // HTML이 없거나 매칭 실패한 경우 직접 MD Front-matter의 location으로 마이그레이션 시도
                const locMatch = content.match(/location:\s*"([^"]+)"/) || content.match(/location:\s*([^\r\n]+)/);
                const dateMatch = content.match(/posted_date:\s*"([^"]+)"/) || content.match(/posted_date:\s*([^\r\n]+)/);
                const titleMatch = content.match(/job_title:\s*"([^"]+)"/) || content.match(/job_title:\s*([^\r\n]+)/);
                const companyMatch = content.match(/company_name:\s*"([^"]+)"/) || content.match(/company_name:\s*([^\r\n]+)/);
                
                if (locMatch && dateMatch && titleMatch && companyMatch) {
                    const rawLoc = locMatch[1].trim();
                    const stdLoc = NamingUtils.decodeHtmlEntities(rawLoc);
                    const locationDirName = UrlUtils.standardizeLocation(stdLoc);
                    
                    const postedDate = dateMatch[1].trim();
                    const jobTitle = titleMatch[1].trim();
                    const company = companyMatch[1].trim();
                    
                    const newMdFolder = path.join(mdDir, locationDirName, postedDate);
                    const safeMdFileName = NamingUtils.generateSafeFileName(jobTitle, company);
                    const newMdPath = path.join(newMdFolder, `${safeMdFileName}.md`);
                    
                    if (oldMdPath !== newMdPath) {
                        if (!fs.existsSync(newMdFolder)) {
                            fs.mkdirSync(newMdFolder, { recursive: true });
                        }
                        if (fs.existsSync(newMdPath)) {
                            fs.unlinkSync(oldMdPath);
                        } else {
                            fs.renameSync(oldMdPath, newMdPath);
                        }
                        mdMigrateCount++;
                    }
                }
            }
        } catch (e: any) {
            console.error(`⚠️ MD [${oldMdPath}] 이동 실패: ${e.message}`);
        }
    }
    
    console.log(`💾 마크다운 포스트 재배치 완료: 총 ${mdMigrateCount} 개 파일 이동`);
    
    // 3. 빈 디렉토리 일괄 정제 삭제
    function cleanEmptyDirs(dir: string): void {
        if (!fs.existsSync(dir)) return;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                cleanEmptyDirs(fullPath);
            }
        });
        if (dir !== htmlDir && dir !== mdDir && dir !== baseDir) {
            const updatedList = fs.readdirSync(dir);
            if (updatedList.length === 0) {
                fs.rmdirSync(dir);
            }
        }
    }
    
    cleanEmptyDirs(htmlDir);
    cleanEmptyDirs(mdDir);
    console.log('🧹 사용되지 않는 빈 폴더 청소 및 정리가 모두 완료되었습니다.');
    console.log('🎉 [국가명 표준화 마이그레이션] 성공적으로 종료!');
}

migrate().catch(err => {
    console.error('❌ 마이그레이션 실패:', err.message);
    process.exit(1);
});
