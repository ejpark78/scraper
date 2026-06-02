import * as fs from 'fs';
import * as path from 'path';

// ⚙️ LinkedIn Clipper OOP 정적 유틸리티 클래스군 (TypeScript)

export class IOUtils {
    /**
     * 📂 특정 디렉토리 하위의 특정 확장자 파일 목록을 재귀적으로 수집하는 고성능 정적 헬퍼
     */
    public static getAllFiles(dir: string, extension: string): string[] {
        let results: string[] = [];
        if (!fs.existsSync(dir)) return results;
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            const stat = fs.statSync(fullPath);
            if (stat && stat.isDirectory()) {
                results = results.concat(this.getAllFiles(fullPath, extension));
            } else if (file.endsWith(extension)) {
                results.push(fullPath);
            }
        });
        return results;
    }
}

export class UrlUtils {
    /**
     * 🔗 다양한 링크드인 공고 URL에서 호환성 100%로 순수 숫자 JOB_ID를 추출하는 정밀 파서
     */
    public static extractJobId(url: string): string {
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

    /**
     * 🛡️ 근무지 지리 매핑 및 표준화 규칙 적용
     */
    public static standardizeLocation(rawLocation: string): string {
        if (!rawLocation || rawLocation === '정보 없음' || rawLocation === 'No info') {
            return 'unknown-location';
        }
        const cleanLoc = rawLocation.trim();
        if (/[가-힣]/.test(cleanLoc) || /South Korea|Seoul|Korea|서울|대한민국|Pangyo|Bundang|Gyeonggi/i.test(cleanLoc)) {
            return 'Korea';
        } else if (/Abu Dhabi|Dubai|United Arab Emirates|아부다비|두바이|아랍에미리트|أبو ظبي|دبي|الإمارات|الشارقة|الخيمة/i.test(cleanLoc)) {
            return 'Abu Dhabi';
        } else if (/Singapore|싱가포르/i.test(cleanLoc)) {
            return 'Singapore';
        } else if (/United Kingdom|London|영국/i.test(cleanLoc)) {
            return 'United Kingdom';
        } else if (/Canada|Toronto|캐나다/i.test(cleanLoc)) {
            return 'Canada';
        } else if (/Ireland|Dublin|아일랜드/i.test(cleanLoc)) {
            return 'Ireland';
        } else if (/Germany|Marburg|독일/i.test(cleanLoc)) {
            return 'Germany';
        } else if (/Saudi Arabia|Riyadh|사우디/i.test(cleanLoc)) {
            return 'Saudi Arabia';
        } else if (/Japan|Tokyo|Shibuya|일본/i.test(cleanLoc)) {
            return 'Japan';
        }
        return cleanLoc.replace(/[\/\\:\*\?"<>\|]/g, ' ').trim();
    }
}

export class DateUtils {
    /**
     * 🕒 상대 시간을 날짜 포맷(YYYY-MM-DD)으로 변환하는 정밀 헬퍼
     */
    public static parseRelativeDate(relativeStr: string, timeStr: string, baseDateInput?: Date): string {
        let baseDate = baseDateInput ? new Date(baseDateInput) : new Date();
        if (isNaN(baseDate.getTime())) {
            baseDate = new Date();
        }
        
        let daysAgo = 0;
        let foundRelative = false;
        
        const matchRegex = /(\d+)\s*(day|week|month|year|hour|minute|second|일|주|달|개월|년|시간|분|초)s?\s*ago/i;
        const matchRegexKo = /(\d+)\s*(일|주|달|개월|년|시간|분|초)\s*전/i;
        const matchRegexRaw = /(\d+)\s*(day|week|month|year|hour|minute|second)s?/i;

        let match = (relativeStr || '').match(matchRegex) || (relativeStr || '').match(matchRegexKo) || (relativeStr || '').match(matchRegexRaw);
        if (match) {
            let val = parseInt(match[1]);
            let unit = match[2].toLowerCase();
            if (unit.startsWith('day') || unit === '일') daysAgo = val;
            else if (unit.startsWith('week') || unit === '주') daysAgo = val * 7;
            else if (unit.startsWith('month') || unit === '달' || unit === '개월') daysAgo = val * 30;
            else if (unit.startsWith('year') || unit === '년') daysAgo = val * 365;
            foundRelative = true;
        }
        
        if (!foundRelative && timeStr) {
            let match = timeStr.match(matchRegex) || timeStr.match(matchRegexKo) || timeStr.match(matchRegexRaw);
            if (match) {
                let val = parseInt(match[1]);
                let unit = match[2].toLowerCase();
                if (unit.startsWith('day') || unit === '일') daysAgo = val;
                else if (unit.startsWith('week') || unit === '주') daysAgo = val * 7;
                else if (unit.startsWith('month') || unit === '달' || unit === '개월') daysAgo = val * 30;
                else if (unit.startsWith('year') || unit === '년') daysAgo = val * 365;
            }
        }
        
        baseDate.setDate(baseDate.getDate() - daysAgo);
        let year = baseDate.getFullYear();
        let month = String(baseDate.getMonth() + 1).padStart(2, '0');
        let day = String(baseDate.getDate()).padStart(2, '0');
        
        return `${year}-${month}-${day}`;
    }

    /**
     * 🕒 초 단위를 시/분/초 문자열로 포맷팅
     */
    public static formatSeconds(totalSec: number): string {
        const H = Math.floor(totalSec / 3600);
        const M = Math.floor((totalSec % 3600) / 60);
        const S = totalSec % 60;
        if (H > 0) {
            return `${H}h ${M}m ${S}s`;
        } else if (M > 0) {
            return `${M}m ${S}s`;
        }
        return `${S}s`;
    }
}

export class FormatUtils {
    /**
     * 🔢 천단위 콤마 포맷터 (예: 3000 -> 3,000)
     */
    public static formatThousand(num: number): string {
        return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
}

export class NamingUtils {
    /**
     * 🔤 HTML 특수문자 엔티티 원복 (&amp; -> & 등)
     */
    public static decodeHtmlEntities(str: string): string {
        return str
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');
    }

    /**
     * 다국어용 안전한 파일명 생성
     */
    public static generateSafeFileName(jobTitle: string, company: string): string {
        let cleanTitle = (jobTitle || '정보 없음').trim();
        let cleanCompany = (company || '정보 없음').trim();
        cleanTitle = this.decodeHtmlEntities(cleanTitle);
        cleanCompany = this.decodeHtmlEntities(cleanCompany);
        
        let safeName = `${cleanCompany} - ${cleanTitle}`
            .replace(/[\/\\:\*\?"<>\|]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        if (!safeName || safeName === '-') safeName = '정보 없음 - 정보 없음';
        if (safeName.length > 80) safeName = safeName.substring(0, 80).trim();
        return safeName;
    }
}
