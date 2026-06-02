const fs = require('fs');
const readline = require('readline');

// ⚙️ LinkedIn URL 초고속 중복 차단 및 필터링 모듈
// cache.list에 이미 존재하는 JOB_ID의 URL을 urls.txt 대조군에서 O(1) 성능으로 완벽하게 제거하여 정제합니다.

const cachePath = process.argv[2];
const urlsPath = process.argv[3];
const outputPath = process.argv[4];

if (!urlsPath || !outputPath) {
    console.error('❌ 사용법: node filter_urls.js <캐시_경로> <URL_원본_경로> <결과_저장_경로>');
    process.exit(1);
}

// 1. ⚡ 검색 성능 O(1) 극대화를 위해 캐시 목록을 Set 객체로 초고속 적재
const cacheSet = new Set();
if (fs.existsSync(cachePath)) {
    try {
        const content = fs.readFileSync(cachePath, 'utf-8');
        content.split(/\r?\n/).forEach(id => {
            const cleanId = id.trim();
            if (cleanId) {
                cacheSet.add(cleanId);
            }
        });
    } catch (err) {
        console.error(`⚠️ 캐시 파일 로드 중 예외 발생: ${err.message}`);
    }
}

// 2. 🔗 다양한 링크드인 공고 URL에서 호환성 100%로 순수 숫자 JOB_ID를 발라내는 정밀 파서
function extractJobId(url) {
    // 끝 슬래시 및 쿼리 파라미터(?...) 제거하여 표준화
    const cleanUrl = url.trim().replace(/\/$/, '').split('?')[0];
    const segment = cleanUrl.split('/').pop() || '';
    
    // 패턴 A: 다국어/SEO 주소 대응 (예: ...-at-company-4421619932)
    const dashMatch = segment.match(/-([0-9]+)$/);
    if (dashMatch) {
        return dashMatch[1];
    }
    
    // 패턴 B: 클래식 숫자 주소 대응 (예: .../view/123456789)
    if (/^[0-9]+$/.test(segment)) {
        return segment;
    }
    
    // 패턴 C: 최후의 보루 (문자열 내 7자리 이상 숫자 블록 검출)
    const numberMatch = segment.match(/[0-9]{7,}/);
    if (numberMatch) {
        return numberMatch[0];
    }
    
    // 패턴 D: 최종 예외 대비 (안전한 글자 수 제한)
    return segment.substring(0, 50);
}

// 3. 🚀 대용량 파일 대응 스트리밍 정밀 필터링 구동 (OOM 예방 및 속도 보장)
async function filterUrls() {
    try {
        if (!fs.existsSync(urlsPath)) {
            console.error(`❌ 원본 URL 파일을 찾을 수 없습니다: ${urlsPath}`);
            process.exit(1);
        }

        const fileStream = fs.createReadStream(urlsPath, 'utf-8');
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });

        const outputWriter = fs.createWriteStream(outputPath, 'utf-8');

        for await (const line of rl) {
            const trimmedLine = line.trim();
            // 빈 줄이거나 주석(#)인 경우는 그대로 보존하여 출력
            if (!trimmedLine || trimmedLine.startsWith('#')) {
                outputWriter.write(line + '\n');
                continue;
            }

            const jobId = extractJobId(trimmedLine);
            
            // 캐시 셋에 존재하는 이미 완료된 ID가 아닌 경우에만 신규 목록 파일에 적재
            if (!jobId || !cacheSet.has(jobId)) {
                outputWriter.write(line + '\n');
            }
        }

        outputWriter.end();
    } catch (err) {
        console.error(`❌ 필터링 처리 도중 치명적 오류 발생: ${err.message}`);
        process.exit(1);
    }
}

filterUrls();
