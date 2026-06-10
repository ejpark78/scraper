import * as cheerio from 'cheerio';
import * as prettier from 'prettier';
import { IConverter } from '../../core/IConverter';

export interface UppityMeta {
    id: string;
    title: string;
    url: string;
    publishedAt: string | null;
    content: string;
    rawContent: string;
}

export class UppityConverter implements IConverter<UppityMeta> {

    public convertHtmlToMarkdown(htmlContent: string, id: string, url: string): UppityMeta {
        const $ = cheerio.load(htmlContent);

        const canonical = $('link[rel="canonical"]').attr('href');
        const finalUrl = canonical || url;

        const ogTitle = $('meta[property="og:title"]').attr('content');
        const titleTag = $('title').text().trim().replace(/ - UPPITY.*$/, '').replace(/ \| UPPITY.*$/, '');
        const title = ogTitle || titleTag || 'Unknown Title';

        let publishedAt: string | null = null;
        const metaTime = $('meta[property="article:published_time"]').attr('content');
        if (metaTime) {
            publishedAt = metaTime;
        } else {
            const timeTag = $('time[datetime]').first();
            if (timeTag.length) {
                publishedAt = timeTag.attr('datetime') || null;
            }
        }

        const contentHtml = this.extractContentHtml($);
        const contentText = this.htmlToMarkdown(contentHtml);
        const cleanedContent = this.cleanContent(contentText);

        let markdown = `# ${title}\n\n`;
        markdown += `* **작성일:** ${publishedAt || '정보 없음'}\n`;
        markdown += `* **원본 링크:** [바로가기](${finalUrl})\n\n`;
        markdown += `## 내용\n\n${cleanedContent}\n`;

        return {
            id,
            title,
            url: finalUrl,
            publishedAt,
            content: cleanedContent,
            rawContent: markdown,
        };
    }

    private extractContentHtml($: cheerio.CheerioAPI): string {
        const selectors = [
            '.elementor-widget-theme-post-content .elementor-widget-container',
            '.elementor-widget-theme-post-content',
            'article .entry-content',
            '.entry-content',
            'article .elementor-widget-container',
            'article.post-content',
            '.post-content',
            'article',
        ];
        for (const sel of selectors) {
            const el = $(sel).first();
            if (el.length > 0) {
                const html = el.html();
                if (html && html.trim().length > 50) {
                    return html;
                }
            }
        }
        const bodyHtml = $('body').html() || '';
        return bodyHtml;
    }

    private htmlToMarkdown(html: string): string {
        try {
            const TurndownService = require('turndown');
            const turndownService = new TurndownService({
                headingStyle: 'atx',
                hr: '---',
                bulletListMarker: '-',
                codeBlockStyle: 'fenced',
                emDelimiter: '*',
            });
            turndownService.remove('script');
            turndownService.remove('style');
            turndownService.remove('nav');
            turndownService.remove('header:not(.entry-header)');
            turndownService.remove('footer');
            turndownService.remove('iframe');
            turndownService.remove('noscript');
            return turndownService.turndown(html).trim();
        } catch {
            const $ = cheerio.load(html);
            return $.text().replace(/\s+/g, ' ').trim();
        }
    }

    private cleanContent(text: string): string {
        let c = text;
        c = c.replace(/<[^>]*>/g, '');
        c = c.replace(/^[ \t]*\*[ \t]/gm, '- ');
        c = c.replace(/^\\- /gm, '- ');
        c = c.replace(/^(#{2,})\s/gm, (_, hashes: string) => '#'.repeat(hashes.length + 1) + ' ');
        return c.trim();
    }

    public async prettify(rawText: string): Promise<string> {
        const formatted = await prettier.format(rawText, {
            parser: 'markdown',
            proseWrap: 'preserve',
            tabWidth: 2,
            printWidth: 100
        });
        return formatted.trim() + '\n';
    }

    public async prettifyAndSave(rawText: string, outputPath: string): Promise<void> {
        const result = await this.prettify(rawText);
        const fs = require('fs');
        const path = require('path');
        const parentDir = path.dirname(outputPath);
        if (!fs.existsSync(parentDir)) {
            fs.mkdirSync(parentDir, { recursive: true });
        }
        fs.writeFileSync(outputPath, result, 'utf-8');
    }
}
