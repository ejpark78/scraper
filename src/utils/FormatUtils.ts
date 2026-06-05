export class FormatUtils {
    /**
     * 🔢 천단위 콤마 포맷터 (예: 3000 -> 3,000)
     */
    public static formatThousand(num: number): string {
        return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
}
