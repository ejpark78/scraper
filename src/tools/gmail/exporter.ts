/**
 * @module exporter
 * @description Core functionality or script runner for exporter.ts.
 * @constraints
 *   - Follows strict OOP patterns and clean error handling.
 * @dependencies fs, path, mailparser, turndown, parser
 * @lastUpdated 2026-06-11
 */

import * as fs from 'fs';
import * as path from 'path';
import { ParsedMail } from 'mailparser';
import TurndownService from 'turndown';
import { EmailParser } from './parser';

export class WikiExporter {
    private turndownService: TurndownService;

    constructor(private baseDir: string = "data") {
        if (!fs.existsSync(this.baseDir)) {
            fs.mkdirSync(this.baseDir, { recursive: true });
        }
        this.turndownService = new TurndownService({ 
            headingStyle: 'atx', 
            hr: '---', 
            bulletListMarker: '-' 
        });

        this.turndownService.remove(['style', 'script', 'head', 'meta']);
    }

    private cleanMarkdownNoise(text: string): string {
        let cleaned = text;
        
        cleaned = cleaned.replace(/@media[^{]*\{[^}]*\}/gi, '');
        cleaned = cleaned.replace(/\.[a-zA-Z0-9_-]+\s*\{[^}]*\}/g, '');
        cleaned = cleaned.replace(/!\[\]\(.*?\)/g, '');
        cleaned = cleaned.replace(/\[\]\(.*?\)/g, '');
        cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
        cleaned = cleaned.replace(/&nbsp;/g, ' ');
        
        return cleaned.trim();
    }

    getTargetPath(folderAlias: string, mailId: string, subject: string, dateObj: Date | undefined): string {
        return path.join(
            this.baseDir, 
            EmailParser.cleanFilename(folderAlias), 
            EmailParser.convertToKstIso(dateObj)[1], 
            `${EmailParser.cleanFilename(subject)}_${mailId}`
        );
    }

    exists(folderAlias: string, mailId: string, subject: string, dateObj: Date | undefined): boolean {
        return fs.existsSync(path.join(this.getTargetPath(folderAlias, mailId, subject, dateObj), "message.md"));
    }

    existsByUid(folderAlias: string, mailId: string, dateObj: Date | undefined): boolean {
        const [, yearMonth] = EmailParser.convertToKstIso(dateObj);
        const targetParentDir = path.join(this.baseDir, EmailParser.cleanFilename(folderAlias), yearMonth);
        
        if (!fs.existsSync(targetParentDir)) return false;
        
        const folders = fs.readdirSync(targetParentDir);
        return folders.some(folder => folder.endsWith(`_${mailId}`));
    }

    async save(folderAlias: string, mailId: string, parsedMail: ParsedMail, rawBuffer: Buffer): Promise<void> {
        const subject = parsedMail.subject || "No Subject";
        const sender = parsedMail.from?.text || "Unknown";
        const [isoDateKst, yearMonth] = EmailParser.convertToKstIso(parsedMail.date);
        
        const bodyHtml = parsedMail.html || (parsedMail.text ? parsedMail.text.replace(/\n/g, '<br>') : "");
        
        const rawMarkdown = this.turndownService.turndown(bodyHtml);
        const cleanBody = this.cleanMarkdownNoise(rawMarkdown);
        
        const mailFolder = path.join(this.baseDir, EmailParser.cleanFilename(folderAlias), yearMonth, `${EmailParser.cleanFilename(subject)}_${mailId}`);

        if (!fs.existsSync(mailFolder)) fs.mkdirSync(mailFolder, { recursive: true });
        
        // 1. raw_message.eml에서 message.eml로 파일명 변경 저장
        fs.writeFileSync(path.join(mailFolder, "message.eml"), rawBuffer);

        const attachmentLinks = (parsedMail.attachments || []).map(att => {
            const safeName = EmailParser.cleanFilename(att.filename);
            fs.writeFileSync(path.join(mailFolder, safeName), att.content);
            return `- [[${safeName}]]`;
        });

        // 2. 메타데이터 링크 구조도 message.eml로 수정
        const wikiTemplate = `---
id: "${mailId}"
title: "${subject.replace(/"/g, '\\"')}"
author: "${sender.replace(/"/g, '\\"')}"
date: "${isoDateKst}"
folder: "${folderAlias}"
tags: [email_backup, ${EmailParser.extractDomainTag(sender)}]
---
# ${subject}
## Metadata
- **From:** ${sender}
- **Date:** ${isoDateKst}
- **Mailing ID:** ${mailId}
- **Folder:** ${folderAlias}
- **Raw EML:** [[message.eml]]

## 📎 Attachments
${attachmentLinks.length ? attachmentLinks.join('\n') : "None"}

---
## Content
${cleanBody}`;

        fs.writeFileSync(path.join(mailFolder, "message.md"), wikiTemplate, 'utf-8');
    }
}