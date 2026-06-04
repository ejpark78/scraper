export class UrlUtils {
    /**
     * 🔗 다양한 링크드인 공고 URL에서 호환성 100%로 순수 숫자 JOB_ID를 추출하는 정밀 파서
     */
    public static extractJobId(url: string): string {
        const cleanUrl = url.trim().split('?')[0].replace(/\/$/, '');
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

    // 💡 country.json 캐싱용 변수
    private static countryMapping: Record<string, string[]> | null = null;

    /**
     * 🛡️ 근무지 지리 매핑 및 표준화 규칙 적용 (국가명 기준 정렬)
     */
    public static standardizeLocation(rawLocation: string): string {
        if (!rawLocation || rawLocation === '정보 없음' || rawLocation === 'No info') {
            return 'unknown-location';
        }
        const cleanLoc = rawLocation.trim();

        // 1. 동적으로 country.json 불러오기 및 캐싱
        if (!UrlUtils.countryMapping) {
            try {
                const fs = require('fs');
                const path = require('path');
                const configPath = path.join(__dirname, '..', '..', 'config', 'country.json');
                if (fs.existsSync(configPath)) {
                    UrlUtils.countryMapping = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                }
            } catch (err) {
                console.warn('⚠️ country.json 설정 파일을 로드하지 못했습니다. 기본 한국어 검사 폴백을 진행합니다.', err);
            }
        }

        // 2. 외부 설정 값이 있을 경우 매핑 매칭 수행
        if (UrlUtils.countryMapping) {
            for (const [country, aliases] of Object.entries(UrlUtils.countryMapping)) {
                // 한글 캐릭터셋이 있거나, 별칭 중 하나가 포함되는 경우 검사
                // (일부 특수 로직 보존: 한국의 경우 /[가-힣]/ 매칭 지원)
                if (country === 'Korea' && /[가-힣]/.test(cleanLoc)) {
                    return 'Korea';
                }

                // regex escape를 통해 안전하게 정규식 패턴 생성
                const escapedAliases = aliases.map(alias => alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
                const pattern = new RegExp(escapedAliases.join('|'), 'i');
                if (pattern.test(cleanLoc)) {
                    return country;
                }
            }
        } else {
            // Fallback (최소한의 예외 처리)
            if (/[가-힣]/.test(cleanLoc) || /Korea|Seoul|서울|대한민국/i.test(cleanLoc)) {
                return 'Korea';
            }
        }

        return cleanLoc.replace(/[\/\\:\*\?"<>\|]/g, ' ').trim();
    }

    /**
     * 🏢 회사 URL에서 고유 식별자인 companyId를 추출하는 정밀 헬퍼
     */
    public static extractCompanyId(url: string): string {
        const cleanUrl = url.trim().replace(/\/$/, '').split('?')[0];
        const segments = cleanUrl.split('/');
        const compIndex = segments.findIndex(s => s === 'company' || s === 'compay');
        let companyId = '';
        if (compIndex !== -1 && segments[compIndex + 1]) {
            companyId = segments[compIndex + 1];
        } else {
            companyId = segments.pop() || '';
        }
        try {
            return decodeURIComponent(companyId);
        } catch (e) {
            return companyId;
        }
    }
}
