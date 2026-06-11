/**
 * @module GrepError
 * @description Reads raw container logs from stdin, parses JSON logs, and formats ERROR entries with summaries.
 * @constraints
 *   - Follows Strict OOP patterns and clean error handling.
 *   - Reads streaming input from process.stdin.
 * @dependencies readline
 * @lastUpdated 2026-06-11
 */

import * as readline from 'readline';

export interface IErrorGrepper {
    grep(): Promise<void>;
}

export class ErrorGrepper implements IErrorGrepper {
    public async grep(): Promise<void> {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            terminal: false
        });

        let errorCount = 0;
        const errorSummary: Record<string, number> = {};
        const serviceSummary: Record<string, number> = {};

        console.log('\n=== 🛑 SCRAPER & TRANSFORMER ERROR LOGS ===\n');

        rl.on('line', (line: string) => {
            if (!line.includes('"level":"ERROR"')) {
                return;
            }

            const separatorIndex = line.indexOf('|');
            if (separatorIndex === -1) return;

            const service = line.substring(0, separatorIndex).trim();
            const jsonPart = line.substring(separatorIndex + 1).trim();

            try {
                const parsed = JSON.parse(jsonPart);
                errorCount++;

                const timestamp = parsed.timestamp || parsed.time || 'N/A';
                const message = parsed.message || parsed.msg || 'No message';
                const errName = parsed.error_name || '';
                const errMsg = parsed.error_message || '';
                const stack = parsed.error_stack || '';

                // Increment counts for summaries
                serviceSummary[service] = (serviceSummary[service] || 0) + 1;
                const summaryKey = errName ? `${errName}: ${message.split('on attempt')[0].trim()}` : message;
                errorSummary[summaryKey] = (errorSummary[summaryKey] || 0) + 1;

                console.log(`[${timestamp}] \x1b[35m${service}\x1b[0m \x1b[31m[ERROR]\x1b[0m: ${message}`);
                if (errName || errMsg) {
                    console.log(`  └─ \x1b[33m${errName}: ${errMsg}\x1b[0m`);
                }
                if (stack) {
                    // Show first 2 lines of stack for context
                    const stackLines = stack.split('\n').slice(0, 3).map((l: string) => `     ${l.trim()}`).join('\n');
                    console.log(`  └─ Stack:\n${stackLines}`);
                }
                console.log();
            } catch {
                console.log(`[RAW] \x1b[35m${service}\x1b[0m: ${jsonPart}\n`);
            }
        });

        rl.on('close', () => {
            console.log('==================================================');
            console.log(`📊 Total Error Logs Found: ${errorCount}`);
            
            if (errorCount > 0) {
                console.log('\n🏢 [Errors by Service]');
                for (const [srv, count] of Object.entries(serviceSummary)) {
                    console.log(`  - \x1b[35m${srv}\x1b[0m: ${count} time(s)`);
                }

                console.log('\n📝 [Common Error Patterns]');
                const sortedErrors = Object.entries(errorSummary).sort((a, b) => b[1] - a[1]);
                for (const [pattern, count] of sortedErrors) {
                    console.log(`  - [${count}x] \x1b[33m${pattern}\x1b[0m`);
                }
            }
            console.log('==================================================\n');
        });
    }
}

if (require.main === module) {
    new ErrorGrepper().grep().catch(err => {
        console.error('Fatal Error:', err);
    });
}
