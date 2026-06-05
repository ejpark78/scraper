import * as cheerio from 'cheerio';
import * as prettier from 'prettier';
import { IConverter } from '../core/IConverter';

export interface PyTorchKRMeta {
    id: string;
    title: string;
    url: string;
    publishedAt: string | null;
    content: string;
    rawContent: string; // The markdown representation
}

export class PyTorchKRConverter implements IConverter<PyTorchKRMeta> {
    
    public convertHtmlToMarkdown(htmlContent: string, id: string, url: string): PyTorchKRMeta {
        const $ = cheerio.load(htmlContent);
        
        // Extract canonical URL if available
        const canonical = $('link[rel="canonical"]').attr('href');
        const finalUrl = canonical || url;
        
        // Extract title
        let title = $('title').text() || 'Unknown Title';
        if (title.includes(' - ')) {
            title = title.split(' - ')[0];
        }
        
        // Extract publication date
        const timeTag = $('time[datetime]').first();
        const publishedAt = timeTag.attr('datetime') || null;
        
        // Extract main text from Discourse post layout
        const postDiv = $('div.post[itemprop="text"]').first();
        let contentText = '';
        
        if (postDiv.length > 0) {
            // Process lightbox wrappers
            postDiv.find('div.lightbox-wrapper').each((_, el) => {
                const lb = $(el);
                const img = lb.find('img');
                const alt = img.attr('alt') || '';
                const info = lb.find('span.informations');
                const infoText = info.text() || '';
                
                const parts: string[] = [];
                if (alt && alt !== title) {
                    parts.push(alt);
                }
                if (infoText) {
                    parts.push(infoText);
                }
                lb.replaceWith(parts.join('\n'));
            });
            
            // Handle other images (like emojis or external images)
            postDiv.find('img').each((_, el) => {
                const img = $(el);
                const alt = img.attr('alt') || '';
                if (alt.startsWith(':')) {
                    // Emoji
                    img.remove();
                } else if (alt && alt !== title) {
                    img.replaceWith(alt);
                } else {
                    img.remove();
                }
            });
            
            // Clean up and construct text
            const lines = postDiv.text().split('\n').map(line => line.trim()).filter(line => line.length > 0);
            contentText = lines.join('\n');
        } else {
            contentText = 'Full content extraction not implemented or post structure changed.';
        }
        
        const fullContent = `${title}\n${contentText}`;
        
        // Generate Markdown format
        let markdown = `# 📂 [PyTorch KR] ${title}\n\n`;
        markdown += `* **작성일:** ${publishedAt || '정보 없음'}\n`;
        markdown += `* **원본 링크:** [바로가기](${finalUrl})\n\n`;
        markdown += `## 📝 본문 내용\n\n${contentText}\n`;
        
        return {
            id,
            title,
            url: finalUrl,
            publishedAt,
            content: fullContent,
            rawContent: markdown
        };
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
