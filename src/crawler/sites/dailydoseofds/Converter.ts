import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { IConverter } from '../../core/IConverter';

export interface DailyDoseDSMeta {
    id: string;
    title: string;
    url: string;
    publishedAt: string | null;
    content: string;
    rawContent: string;
}

export class DailyDoseDSConverter implements IConverter<DailyDoseDSMeta> {
    public convertHtmlToMarkdown(htmlContent: string, id: string, url: string): DailyDoseDSMeta {
        const $ = cheerio.load(htmlContent);
        
        // 1. Cleanup: Remove noise and navigation elements
        $('.gh-nav-list, .gh-pagination, #sx-lazy-script, .membership-notice, [data-sx-pagination-btn]').remove();
        
        $('div').each((_, el) => {
            const $el = $(el);
            if ($el.text().includes('Reinforcement Learning Course') && $el.find('a[href*="/rl-course-part-"]').length > 0) {
                $el.remove();
            }
        });

        // Remove "On this page" TOC section
        $('h2:contains("On this page"), a[href*="#___TOCBOT___"]').parentsUntil('div').remove();

        const title = $('h1').first().text().trim() || $('title').text().split('|')[0].trim() || 'Unknown Title';
        const publishedAt = $('time').first().attr('datetime') || null;
        
        // 2. Content Extraction
        let contentEl = $('.gh-content').first();
        if (!contentEl.length) contentEl = $('main').first();
        if (!contentEl.length) contentEl = $('article').first();

        const turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced',
            emDelimiter: '*',
            bulletListMarker: '-',
        });
        
        const contentText = turndownService.turndown(contentEl.html() || '').trim();
        
        const rawContent = `# 📂 [Daily Dose of DS] ${title}\n\n` +
                           `* **작성일:** ${publishedAt || '정보 없음'}\n` +
                           `* **원본 링크:** [바로가기](${url})\n\n` +
                           `## 📝 본문 내용\n\n${contentText}\n`;
        
        return {
            id,
            title,
            url,
            publishedAt,
            content: contentText,
            rawContent
        };
    }

    public async prettifyAndSave(id: string, html: string): Promise<void> {
        // Not implemented for this site
    }
}
