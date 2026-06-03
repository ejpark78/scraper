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
