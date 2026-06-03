import * as fs from 'fs';
import * as path from 'path';
import { IOUtils } from '../utils';

// 📂 수집 완료된 마크다운 파일을 바탕으로 urls.json 마스터 인덱스를 재구축하는 스크립트
async function main() {
    console.log('🔄 [마스터 urls.json 재구축] 기동 중...');

    const baseDir = path.join(__dirname, '..', '..', 'data', 'jobs');
    const mdDir = path.join(baseDir, 'markdown');
    const outputUrlsJsonPath = path.join(baseDir, 'lists', 'urls.json');

    const targetCountries = ['South Korea', 'United Arab Emirates', 'Japan'];
    const masterJobsMetaList: any[] = [];
    const processedJobIds = new Set<string>();

    let totalMdFiles = 0;

    targetCountries.forEach(country => {
        const countryMdDir = path.join(mdDir, country);
        if (!fs.existsSync(countryMdDir)) {
            console.log(`💡 ${country} 마크다운 디렉토리가 존재하지 않아 건너뜁니다.`);
            return;
        }

        const mdFiles = IOUtils.getAllFiles(countryMdDir, '.md');
        totalMdFiles += mdFiles.length;
        console.log(`📂 [${country}]에서 ${mdFiles.length} 개의 마크다운 파일을 발견했습니다.`);

        mdFiles.forEach(file => {
            try {
                const content = fs.readFileSync(file, 'utf-8');
                
                // Front-matter 파싱
                const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
                if (!fmMatch) return;

                const fmContent = fmMatch[1];
                const meta: Record<string, string> = {};
                
                fmContent.split(/\r?\n/).forEach(line => {
                    const parts = line.split(':');
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        let value = parts.slice(1).join(':').trim();
                        // 따옴표 제거
                        if (value.startsWith('"') && value.endsWith('"')) {
                            value = value.substring(1, value.length - 1);
                        }
                        meta[key] = value;
                    }
                });

                const jobId = meta['job_id'];
                if (jobId && /^\d+$/.test(jobId) && !processedJobIds.has(jobId)) {
                    processedJobIds.add(jobId);
                    
                    // 상세 정보 조립
                    const title = meta['job_title'] || '정보 없음';
                    const company = meta['company_name'] || '정보 없음';
                    const location = meta['location'] || '정보 없음';
                    
                    // 본문에서 근무 형태 (Workplace Type) 추가 추출 시도
                    let workStyle = '정보 없음';
                    const wsMatch = content.match(/-\s*\*?\*?근무 형태 \(Workplace Type\):\*?\*?\s*(.+)/i);
                    if (wsMatch) {
                        workStyle = wsMatch[1].trim();
                    }

                    masterJobsMetaList.push({
                        jobId,
                        title,
                        company,
                        location,
                        workStyle,
                        url: `https://www.linkedin.com/jobs/view/${jobId}`
                    });
                }
            } catch (err: any) {
                console.error(`⚠️ 파일 분석 오류 [${file}]: ${err.message}`);
            }
        });
    });

    console.log(`\n📊 총 ${totalMdFiles} 개의 파일 분석 완료.`);
    console.log(`🎯 수집된 유니크 타겟 공고 개수: ${masterJobsMetaList.length} 개.`);

    // urls.json 저장
    const parentDir = path.dirname(outputUrlsJsonPath);
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }

    fs.writeFileSync(outputUrlsJsonPath, JSON.stringify(masterJobsMetaList, null, 2), 'utf-8');
    console.log(`✅ 마스터 urls.json 파일 저장 완료 ➡️ ${outputUrlsJsonPath}`);

    // 아카이브 스냅샷 백업 저장
    const historyDir = path.join(parentDir, 'urls');
    if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
    }
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    const snapshotPath = path.join(historyDir, `master_urls_${timestamp}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(masterJobsMetaList, null, 2), 'utf-8');
    console.log(`💾 master_urls.json 스냅샷 백업 완료 ➡️ ${snapshotPath}`);
}

main().catch(err => {
    console.error('❌ 마스터 인덱스 재구축 실패:', err);
});
