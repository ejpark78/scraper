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

    /**
     * ISO 국가코드(2자리)를 표준 영문 국가명으로 변환
     */
    public static convertCountryCodeToName(code: string): string {
        if (!code) return 'Unknown';
        const cleanCode = code.trim().toUpperCase();
        const map: { [key: string]: string } = {
            'KR': 'South Korea',
            'US': 'United States',
            'GB': 'United Kingdom',
            'JP': 'Japan',
            'CN': 'China',
            'DE': 'Germany',
            'FR': 'France',
            'SG': 'Singapore',
            'AE': 'United Arab Emirates',
            'CA': 'Canada',
            'IN': 'India',
            'AU': 'Australia',
            'NL': 'Netherlands',
            'CH': 'Switzerland',
            'SE': 'Sweden',
            'DK': 'Denmark',
            'IE': 'Ireland',
            'NZ': 'New Zealand',
            'TR': 'Turkey',
            'ES': 'Spain',
            'PL': 'Poland',
            'AT': 'Austria',
            'MY': 'Malaysia',
            'SA': 'Saudi Arabia',
            'QA': 'Qatar',
            'IT': 'Italy',
            'HK': 'Hong Kong',
            'VN': 'Vietnam',
            'ID': 'Indonesia',
            'PH': 'Philippines',
            'TH': 'Thailand',
            'BR': 'Brazil',
            'RU': 'Russia',
            'IL': 'Israel',
            'BE': 'Belgium',
            'FI': 'Finland',
            'NO': 'Norway',
            'ZA': 'South Africa',
            'MX': 'Mexico',
            'TW': 'Taiwan',
            'PT': 'Portugal',
            'UA': 'Ukraine',
            'CZ': 'Czech Republic',
            'GR': 'Greece',
            'HU': 'Hungary',
            'RO': 'Romania'
        };
        return map[cleanCode] || cleanCode;
    }
}
