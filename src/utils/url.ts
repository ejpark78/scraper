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
     * 🛡️ 근무지 지리 매핑 및 표준화 규칙 적용 (국가명 기준 정렬)
     */
    public static standardizeLocation(rawLocation: string): string {
        if (!rawLocation || rawLocation === '정보 없음' || rawLocation === 'No info') {
            return 'unknown-location';
        }
        const cleanLoc = rawLocation.trim();
        
        // 1. 대한민국 (Korea)
        if (/[가-힣]/.test(cleanLoc) || /South Korea|Seoul|Korea|Busan|Incheon|Daegu|Daejeon|Gwangju|Ulsan|Suwon|Changwon|Pangyo|Bundang|Gyeonggi|서울|인천|대구|대전|광주|부산|울산|수원|창원|판교|분당|경기|대한민국|Seongsan-gu/i.test(cleanLoc)) {
            return 'Korea';
        }
        
        // 2. 아랍에미리트 (United Arab Emirates)
        if (/Abu Dhabi|Dubai|Ajman|Al Ain|Sharjah|Fujairah|Umm Al Quwain|Ras Al Khaimah|United Arab Emirates|UAE|아부다비|두바이|아랍에미리트|샤르자|아지만|알아인|أبو ظبي|دبي|الإمارات|الشارقة|الخيمة|العين|عجمان|الطَّوِيلَة|مدينة محمد بن زايد/i.test(cleanLoc)) {
            return 'United Arab Emirates';
        }
        
        // 3. 독일 (Germany)
        if (/Germany|Berlin|Munich|München|Frankfurt|Hamburg|Stuttgart|Düsseldorf|Dusseldorf|Cologne|Köln|Marburg|독일|Erfurt|Bremen|Karlsruhe|Kassel|Nuremberg|Rostock|Hannover|Wolfsburg|Göttingen|Braunschweig|Osnabrück/i.test(cleanLoc)) {
            return 'Germany';
        }
        
        // 4. 카타르 (Qatar)
        if (/Qatar|Doha|카타르|도하/i.test(cleanLoc)) {
            return 'Qatar';
        }

        // 5. 오스트리아 (Austria)
        if (/Austria|Vienna|Wien|오스트리아|비엔나|Amstetten|Niederösterreich|Österreich|Gumpoldskirchen|Hagenberg|Mühlkreis|Oberösterreich|Linz|Marchtrenk|Sankt Valentin|Schwertberg|Wels|Graz/i.test(cleanLoc)) {
            return 'Austria';
        }
        
        // 6. 싱가포르 (Singapore)
        if (/Singapore|싱가포르/i.test(cleanLoc)) {
            return 'Singapore';
        }
        
        // 7. 영국 (United Kingdom)
        if (/United Kingdom|UK|London|Great Britain|England|Scotland|Wales|영국|런던|Colchester/i.test(cleanLoc)) {
            return 'United Kingdom';
        }
        
        // 8. 캐나다 (Canada)
        if (/Canada|Toronto|Vancouver|Montreal|캐나다|토론토/i.test(cleanLoc)) {
            return 'Canada';
        }
        
        // 9. 아일랜드 (Ireland)
        if (/Ireland|Dublin|아일랜드|더블린/i.test(cleanLoc)) {
            return 'Ireland';
        }
        
        // 10. 사우디아라비아 (Saudi Arabia)
        if (/Saudi Arabia|Riyadh|사우디|리야드/i.test(cleanLoc)) {
            return 'Saudi Arabia';
        }
        
        // 11. 일본 (Japan)
        if (/Japan|Tokyo|Shibuya|Osaka|Kyoto|일본|도쿄|오사카|六本木|千代田区|府中|東京|東京都|日本|渋谷区|港区|荒川区|西東京/i.test(cleanLoc)) {
            return 'Japan';
        }

        // 12. 스위스 (Switzerland)
        if (/Switzerland|Schaffhausen|Beringen|Thurgau|Bottighofen|Frauenfeld|Mittelland|Appenzell|스위스/i.test(cleanLoc)) {
            return 'Switzerland';
        }

        // 13. 룩셈부르크 (Luxembourg)
        if (/Luxembourg|Luxemburg|Betzdorf|Grevenmacher|Findel|Kirchberg|Ville Haute|Wasserbillig|룩셈부르크/i.test(cleanLoc)) {
            return 'Luxembourg';
        }

        // 14. 말레이시아 (Malaysia)
        if (/Malaysia|Johor|말레이시아/i.test(cleanLoc)) {
            return 'Malaysia';
        }

        // 15. 스페인 (Spain)
        if (/Spain|Madrid|스페인|마드리드/i.test(cleanLoc)) {
            return 'Spain';
        }

        // 16. 폴란드 (Poland)
        if (/Poland|Warsaw|Warszawa|Mazowieckie|폴란드|바르샤바/i.test(cleanLoc)) {
            return 'Poland';
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
