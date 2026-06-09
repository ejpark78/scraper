import { chromium, Browser } from 'playwright';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
    if (!browser?.isConnected()) {
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
    }
    return browser;
}

export async function closeBrowser(): Promise<void> {
    if (browser) {
        await browser.close();
        browser = null;
    }
}

async function cleanup(): Promise<void> {
    await closeBrowser();
}

process.on('beforeExit', cleanup);

for (const sig of ['SIGINT', 'SIGTERM', 'SIGQUIT'] as const) {
    process.on(sig, async () => {
        await cleanup();
        process.exit(0);
    });
}
