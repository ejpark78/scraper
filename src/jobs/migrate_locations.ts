import * as fs from 'fs';
import * as path from 'path';
import { LinkedInMarkdownConverter } from './jobs_converter';
import { NamingUtils, UrlUtils, IOUtils } from '../utils';

// 📂 HTML 캐시 및 MD 포스트 국가명 표준화 마이그레이션 엔진

export interface MigrationConfig {
    baseDir?: string;
    htmlDir?: string;
    mdDir?: string;
}

export class LocationMigrator {
    private readonly htmlDir: string;
    private readonly mdDir: string;
    private readonly baseDir: string;
    private readonly converter: LinkedInMarkdownConverter;

    constructor(config: MigrationConfig = {}) {
        this.baseDir = config.baseDir || path.join(__dirname, '..', '..', 'data', 'jobs');
        this.htmlDir = config.htmlDir || path.join(this.baseDir, 'html');
        this.mdDir = config.mdDir || path.join(this.baseDir, 'markdown');
        this.converter = new LinkedInMarkdownConverter();
    }

    /**
     * 실행 진입점: 마이그레이션 전체 프로세스 구동
     */
    public async run(): Promise<void> {
        console.log('🚀 [국가명 표준화 마이그레이션] 기동 중...');

        if (!fs.existsSync(this.htmlDir)) {
            console.log('💡 HTML 폴더가 존재하지 않아 마이그레이션을 건너뜁니다.');
            return;
        }

        // 1. HTML 파일 마이그레이션 및 매핑 데이터 수집
        const jobMigrationMap = this.migrateHtmlFiles();

        // 2. MD 파일 마이그레이션
        this.migrateMarkdownFiles(jobMigrationMap);

        // 3. 빈 디렉토리 일괄 정제 삭제
        this.cleanEmptyDirectories();

        console.log('🧹 사용되지 않는 빈 폴더 청소 및 정리가 모두 완료되었습니다.');
        console.log('🎉 [국가명 표준화 마이그레이션] 성공적으로 종료!');
    }

    private getStandardCountries(): Set<string> {
        try {
            const configPath = path.join(__dirname, '..', '..', 'config', 'country.json');
            if (fs.existsSync(configPath)) {
                const countryMapping = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                const standard = new Set(Object.keys(countryMapping));
                standard.add('unknown-location');
                return standard;
            }
        } catch (err) {
            console.error('⚠️ country.json 로드 실패:', err);
        }
        const standard = new Set<string>();
        standard.add('unknown-location');
        return standard;
    }

    /**
     * HTML 파일들을 새 국가명 표준에 맞게 재배치하고, MD 마이그레이션을 위한 매핑 테이블을 반환
     */
    private migrateHtmlFiles(): Map<string, any> {
        const allHtmlFiles = IOUtils.getAllFiles(this.htmlDir, '.html');
        const standardCountries = this.getStandardCountries();

        // 미표준 폴더에 있는 파일들만 필터링
        const mismatchFiles = allHtmlFiles.filter(filePath => {
            const relativePath = path.relative(this.htmlDir, filePath);
            const currentDir = relativePath.split(path.sep)[0];
            return !standardCountries.has(currentDir);
        });

        console.log(`📊 총 ${allHtmlFiles.length} 개의 HTML 백업본 중 미스매칭된 ${mismatchFiles.length} 개의 HTML 파일 이동을 시작합니다.`);

        const jobMigrationMap = new Map<string, {
            newHtmlPath: string;
            locationDirName: string;
            postedDate: string;
            company: string;
            jobTitle: string;
        }>();

        const htmlMigrateSummary = new Map<string, number>();
        let htmlMigrateCount = 0;
        let processedCount = 0;

        for (const oldHtmlPath of mismatchFiles) {
            const jobId = path.basename(oldHtmlPath, '.html');
            if (!/^\d+$/.test(jobId)) continue;

            processedCount++;
            if (processedCount % 100 === 0 || processedCount === mismatchFiles.length) {
                console.log(`- HTML 마이그레이션 진행률: [${processedCount}/${mismatchFiles.length}]...`);
            }

            try {
                if (!fs.existsSync(oldHtmlPath)) continue;
                const htmlContent = fs.readFileSync(oldHtmlPath, 'utf-8');
                const fileStats = fs.statSync(oldHtmlPath);
                const meta = this.converter.convertHtmlToMarkdown(
                    htmlContent, 
                    jobId, 
                    `https://www.linkedin.com/jobs/view/${jobId}`, 
                    fileStats.mtime
                );

                const newHtmlFolder = path.join(this.htmlDir, meta.locationDirName, meta.postedDate);
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
                    fs.renameSync(oldHtmlPath, newHtmlPath);
                    htmlMigrateCount++;

                    const key = `"${meta.rawLocation}" ➡️ "${meta.locationDirName}"`;
                    htmlMigrateSummary.set(key, (htmlMigrateSummary.get(key) || 0) + 1);
                }
            } catch (e: any) {
                console.error(`⚠️ HTML [${jobId}] 파싱/이동 실패: ${e.message}`);
            }
        }

        if (htmlMigrateSummary.size > 0) {
            console.log('\n📦 [HTML 이동 상세 요약]');
            for (const [mapping, count] of htmlMigrateSummary.entries()) {
                console.log(`  [HTML 이동] ${mapping} (${count})`);
            }
            console.log('');
        }

        console.log(`💾 HTML 캐시 재배치 완료: 총 ${htmlMigrateCount} 개 파일 이동`);
        return jobMigrationMap;
    }

    /**
     * 모든 MD 파일을 검색하여 표준 구조로 마이그레이션
     */
    private migrateMarkdownFiles(jobMigrationMap: Map<string, any>): void {
        const allMdFiles = IOUtils.getAllFiles(this.mdDir, '.md');
        const standardCountries = this.getStandardCountries();

        // 미표준 폴더에 있는 파일들만 필터링
        const mismatchFiles = allMdFiles.filter(filePath => {
            const relativePath = path.relative(this.mdDir, filePath);
            const currentDir = relativePath.split(path.sep)[0];
            return !standardCountries.has(currentDir);
        });

        console.log(`📊 총 ${allMdFiles.length} 개의 마크다운 포스트 중 미스매칭된 ${mismatchFiles.length} 개의 파일 이동을 시작합니다.`);

        const mdMigrateSummary = new Map<string, number>();
        let mdMigrateCount = 0;
        let processedCount = 0;

        for (const oldMdPath of mismatchFiles) {
            processedCount++;
            if (processedCount % 100 === 0 || processedCount === mismatchFiles.length) {
                console.log(`- MD 마이그레이션 진행률: [${processedCount}/${mismatchFiles.length}]...`);
            }

            try {
                if (!fs.existsSync(oldMdPath)) continue;
                const content = fs.readFileSync(oldMdPath, 'utf-8');
                const match = content.match(/job_id:\s*"(\d+)"/) || content.match(/job_id:\s*(\d+)/);
                if (!match) continue;

                const jobId = match[1];
                const migInfo = jobMigrationMap.get(jobId);

                if (migInfo) {
                    const newMdFolder = path.join(this.mdDir, migInfo.locationDirName, migInfo.postedDate);
                    const safeMdFileName = NamingUtils.generateSafeFileName(migInfo.jobTitle, migInfo.company);
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

                        const relativePath = path.relative(this.mdDir, oldMdPath);
                        const oldLoc = relativePath.split(path.sep)[0] || 'Unknown';
                        const key = `"${oldLoc}" ➡️ "${migInfo.locationDirName}"`;
                        mdMigrateSummary.set(key, (mdMigrateSummary.get(key) || 0) + 1);
                    }
                } else {
                    // HTML이 없거나 매칭 실패한 경우 직접 MD Front-matter 파싱 후 마이그레이션 시도
                    this.migrateMarkdownDirectly(oldMdPath, content, mdMigrateSummary) && mdMigrateCount++;
                }
            } catch (e: any) {
                console.error(`⚠️ MD [${oldMdPath}] 이동 실패: ${e.message}`);
            }
        }

        if (mdMigrateSummary.size > 0) {
            console.log('\n📦 [MD 이동 상세 요약]');
            for (const [mapping, count] of mdMigrateSummary.entries()) {
                console.log(`  [MD 이동] ${mapping} (${count})`);
            }
            console.log('');
        }

        console.log(`💾 마크다운 포스트 재배치 완료: 총 ${mdMigrateCount} 개 파일 이동`);
    }

    /**
     * HTML 백업이 없을 때 MD 내용 자체에서 직접 메타데이터를 파싱하여 개별 마이그레이션 처리
     */
    private migrateMarkdownDirectly(oldMdPath: string, content: string, mdMigrateSummary: Map<string, number>): boolean {
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

            const newMdFolder = path.join(this.mdDir, locationDirName, postedDate);
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

                const relativePath = path.relative(this.mdDir, oldMdPath);
                const oldLoc = relativePath.split(path.sep)[0] || 'Unknown';
                const key = `"${oldLoc}" ➡️ "${locationDirName}"`;
                mdMigrateSummary.set(key, (mdMigrateSummary.get(key) || 0) + 1);
                return true;
            }
        }
        return false;
    }

    /**
     * 빈 디렉토리 재귀적 정제
     */
    private cleanEmptyDirectories(): void {
        const clean = (dir: string) => {
            if (!fs.existsSync(dir)) return;
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                const fullPath = path.join(dir, file);
                if (fs.statSync(fullPath).isDirectory()) {
                    clean(fullPath);
                }
            });
            if (dir !== this.htmlDir && dir !== this.mdDir && dir !== this.baseDir) {
                const updatedList = fs.readdirSync(dir);
                if (updatedList.length === 0) {
                    fs.rmdirSync(dir);
                }
            }
        };

        clean(this.htmlDir);
        clean(this.mdDir);
    }
}

// 직접 스크립트 실행 시 구동 처리
if (require.main === module) {
    const migrator = new LocationMigrator();
    migrator.run().catch(err => {
        console.error('❌ 마이그레이션 실패:', err.message);
        process.exit(1);
    });
}
