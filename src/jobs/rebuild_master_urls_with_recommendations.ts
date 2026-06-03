import * as fs from 'fs';
import * as path from 'path';
import { IOUtils, UrlUtils } from '../utils';

// 📂 수집된 상세 HTML 내의 추천 영역까지 전수 조사하여 마스터 urls.json을 생성하는 빌더 (DIRECT / RECOMMENDED 구분 필드 추가)
async function main() {
    console.log('🔄 [추천 포함 마스터 urls.json 빌드] 기동 중...');

    const cheerio = require('cheerio');
    const baseDir = path.join(__dirname, '..', '..', 'data', 'jobs');
    const htmlDir = path.join(baseDir, 'html');
    const outputUrlsJsonPath = path.join(baseDir, 'lists', 'urls.json');
    const urlsBakPath = path.join(baseDir, 'lists', 'urls.txt.bak');

    const masterJobsMetaMap = new Map<string, any>();
    const directJobIds = new Set<string>();

    // 0. urls.txt.bak 에서 원본 DIRECT job ID 수집
    if (fs.existsSync(urlsBakPath)) {
        console.log('📥 0단계: urls.txt.bak 에서 DIRECT job ID 로드 중...');
        try {
            const content = fs.readFileSync(urlsBakPath, 'utf-8');
            content.split(/\r?\n/).forEach(line => {
                const cleanLine = line.trim();
                if (cleanLine) {
                    const jobId = UrlUtils.extractJobId(cleanLine);
                    if (jobId && /^\d+$/.test(jobId)) {
                        directJobIds.add(jobId);
                    }
                }
            });
            console.log(`✅ urls.txt.bak 에서 DIRECT job ID ${directJobIds.size} 개 추출 완료.`);
        } catch (e: any) {
            console.error(`⚠️ urls.txt.bak 로드 오류: ${e.message}`);
        }
    }

    // 1. 이미 다운로드된 마크다운 파일들의 메타데이터 선탑재 (정확도 100%, 전 국가 대상)
    const mdDir = path.join(baseDir, 'markdown');
    console.log('📥 1단계: 기존 다운로드 완료된 마크다운 파일 분석 중...');
    
    if (fs.existsSync(mdDir)) {
        const mdFiles = IOUtils.getAllFiles(mdDir, '.md');
        console.log(`📊 분석 대상 마크다운 파일 수: ${mdFiles.length} 개`);
        
        mdFiles.forEach(file => {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                if (!fmMatch) return;

                const fmContent = fmMatch[1];
                const meta: Record<string, string> = {};
                fmContent.split(/\r?\n/).forEach(line => {
                    const parts = line.split(':');
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        let value = parts.slice(1).join(':').trim();
                        if (value.startsWith('"') && value.endsWith('"')) {
                            value = value.substring(1, value.length - 1);
                        }
                        meta[key] = value;
                    }
                });

                const jobId = meta['job_id'];
                if (jobId && /^\d+$/.test(jobId)) {
                    const isDirect = directJobIds.has(jobId);
                    masterJobsMetaMap.set(jobId, {
                        jobId,
                        title: meta['job_title'] || '정보 없음',
                        company: meta['company_name'] || '정보 없음',
                        location: meta['location'] || '정보 없음',
                        workStyle: '정보 없음',
                        url: `https://www.linkedin.com/jobs/view/${jobId}`,
                        source: isDirect ? 'DIRECT' : 'related'
                    });
                }
            } catch (e) {}
        });
    }
    console.log(`✅ 다운로드 완료 공고 탑재 완료: ${masterJobsMetaMap.size} 개`);

    // 2. 수집 완료된 HTML 상세 페이지 내부를 파싱하여 추천 공고 메타데이터 추출 (전 국가 대상)
    console.log('📥 2단계: 수집 완료된 HTML 파일들의 추천 공고 영역 분석 중 (시간이 다소 소요될 수 있습니다)...');
    if (fs.existsSync(htmlDir)) {
        const htmlFiles = IOUtils.getAllFiles(htmlDir, '.html');
        console.log(`📊 분석 대상 HTML 파일 수: ${htmlFiles.length} 개`);

        let processedCount = 0;

        for (const htmlPath of htmlFiles) {
            processedCount++;
            if (processedCount % 5000 === 0 || processedCount === htmlFiles.length) {
                console.log(`- HTML 추천 분석 진행률: [${processedCount}/${htmlFiles.length}]...`);
            }

            try {
                const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
                const $ = cheerio.load(htmlContent);

                $('a[href*="/jobs/view/"]').each((_: any, el: any) => {
                    const href = $(el).attr('href') || '';
                    const jobId = UrlUtils.extractJobId(href);
                    
                    if (!jobId || !/^\d+$/.test(jobId)) return;
                    
                    // 이미 마크다운 분석을 통해 정확하게 소장 완료된 내역이 있다면 스킵
                    if (masterJobsMetaMap.has(jobId)) return;

                    const title = $(el).text().replace(/\s+/g, ' ').trim();
                    if (!title || title.length < 2) return;

                    let company = '';
                    let location = '';

                    // 추천 카드 부모 컨테이너 탐색을 통한 메타 추출
                    const parent = $(el).closest('li, div, section');
                    if (parent.length > 0) {
                        company = parent.find('[class*="company"], [class*="subtitle"]').first().text().replace(/\s+/g, ' ').trim();
                        const locText = parent.find('[class*="location"], [class*="metadata"]').first().text().replace(/\s+/g, ' ').trim();
                        if (locText) {
                            location = locText.split(/\d+\s+days?\s+ago|\d+\s+weeks?\s+ago/i)[0].trim();
                        }
                    }

                    const isDirect = directJobIds.has(jobId);
                    masterJobsMetaMap.set(jobId, {
                        jobId,
                        title,
                        company: company || '정보 없음',
                        location: location || '정보 없음',
                        workStyle: '정보 없음',
                        url: `https://www.linkedin.com/jobs/view/${jobId}`,
                        source: isDirect ? 'DIRECT' : 'related'
                    });
                });
            } catch (err: any) {
                // 오류 무시
            }
        }
    }
    console.log(`✅ html 추천 추출 완료. 현재 총 공고 개수: ${masterJobsMetaMap.size} 개`);

    // 3. urls.txt.bak 에 있는 direct id 중 메타데이터가 아직 없는 건들을 "정보 없음" 상태로 복원 추가
    console.log('📥 3단계: urls.txt.bak 에서 누락된 DIRECT 공고 복원 중...');
    let restoredCount = 0;
    directJobIds.forEach(jobId => {
        if (!masterJobsMetaMap.has(jobId)) {
            masterJobsMetaMap.set(jobId, {
                jobId,
                title: '정보 없음',
                company: '정보 없음',
                location: '정보 없음',
                workStyle: '정보 없음',
                url: `https://www.linkedin.com/jobs/view/${jobId}`,
                source: 'DIRECT'
            });
            restoredCount++;
        }
    });
    console.log(`✅ 누락된 DIRECT 공고 복원 완료: ${restoredCount} 개`);

    const masterList = Array.from(masterJobsMetaMap.values());
    console.log(`\n🎯 최종 빌드 완료된 마스터 공고 개수: ${masterList.length} 개`);

    // urls.json 저장
    fs.writeFileSync(outputUrlsJsonPath, JSON.stringify(masterList, null, 2), 'utf-8');
    console.log(`✅ 마스터 urls.json 파일 저장 완료 ➡️ ${outputUrlsJsonPath}`);

    // 아카이브 백업 저장
    const historyDir = path.join(baseDir, 'lists', 'urls');
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
    }
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const snapshotPath = path.join(historyDir, `master_rec_urls_${timestamp}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(masterList, null, 2), 'utf-8');
    console.log(`💾 master_rec_urls.json 스냅샷 백업 완료 ➡️ ${snapshotPath}`);
}

main().catch(err => {
    console.error('❌ 추천 포함 마스터 빌드 실패:', err);
});
