import * as cheerio from 'cheerio';
import * as turndown from 'turndown';
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
        // Remove course navigation lists, pagination, and member-only banners
        $('.gh-nav-list, .gh-pagination, #sx-lazy-script, .membership-notice, [data-sx-pagination-btn]').remove();
        
        // Remove the internal course linking lists that often appear at the top/bottom
        $('div').each((_, el) => {
            const $el = $(el);
            if ($el.text().includes('Reinforcement Learning Course') && $el.find('a[href*="/rl-course-part-"]').length > 0) {
                $el.remove();
            }
        });

        // Remove "On this page" TOC section
        $('h2:contains("On this page"), a[href*="#___TOCBOT___"]').parentsUntil('div', 1).remove();

        const title = $('h1').first().text().trim() || $('title').text().split('|')[0].trim() || 'Unknown Title';
        const publishedAt = $('time').first().attr('datetime') || null;
        
        // 2. Content Extraction
        // Target the main content area, prioritizing Ghost's common content classes
        let contentEl = $('.gh-content').first();
        if (!contentEl.length) contentEl = $('main').first();
        if (!contentEl.length) contentEl = $('article').first();

        const turndownService = new turndown.TurndownService({
            headingStyle: 'atx',
            codeBlock laStyle: 'fenced',
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
}
