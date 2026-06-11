/**
 * @module parser
 * @description Core functionality or script runner for parser.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies None
 * @lastUpdated 2026-06-11
 */

export class EmailParser {
    static cleanFilename(title: string | undefined): string {
        if (!title) return "Untitled_Mail";
        return title.replace(/[\\/*?:"<>|]/g, "").trim().replace(/\//g, "_").substring(0, 100);
    }

    static convertToKstIso(dateObj: Date | undefined): [string, string] {
        if (!dateObj) return ["Unknown-Date", "Unknown-Date"];
        try {
            const KST_OFFSET = 9 * 60 * 60 * 1000;
            const kstDate = new Date(dateObj.getTime() + KST_OFFSET);
            const isoStr = dateObj.toISOString().replace('Z', '+09:00');
            return [isoStr, `${kstDate.getUTCFullYear()}-${String(kstDate.getUTCMonth() + 1).padStart(2, '0')}`];
        } catch {
            return ["Unknown-Date", "Unknown-Date"];
        }
    }

    static extractDomainTag(sender: string | undefined): string {
        if (!sender) return "from/unknown";
        const match = sender.match(/@([\w.-]+)/);
        if (match) {
            const parts = match[1].split('.');
            return `from/${parts[parts.length - 2] || parts[0]}`;
        }
        return "from/unknown";
    }
}