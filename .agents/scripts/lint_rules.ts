/**
 * @module lint_rules
 * @description Audits relative path compliance in generated markdown transcripts according to AGENTS.md rules.
 * @constraints
 *   - Verifies that markdown links do not use absolute schemas (e.g., file://, http://).
 *   - Follows strict OOP patterns and JSDoc guidelines.
 * @dependencies Node fs/path
 * @lastUpdated 2026-06-11
 */

import * as fs from 'fs';
import * as path from 'path';

interface BadLinkItem {
  file: string;
  line: number;
  text: string;
}

class RulesLinter {
  private readonly transcriptsDir = path.join(__dirname, '../transcripts');

  public run(): void {
    try {
      console.log('🔍 Auditing relative paths in generated markdown transcripts...');
      if (!fs.existsSync(this.transcriptsDir)) {
        console.log('No transcripts directory found. Skipping check.');
        return;
      }

      const badLinks: BadLinkItem[] = [];
      this.checkDirectory(this.transcriptsDir, badLinks);

      if (badLinks.length > 0) {
        console.warn('⚠️ Absolute paths or invalid schemas found in transcripts:');
        badLinks.forEach(item => {
          console.warn(`  - [${item.file}:${item.line}]: "${item.text}"`);
        });
      } else {
        console.log('✅ Paths validation: ALL OK (All links use clean relative paths).');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ Error during relative link validation:', errMsg);
      process.exit(1);
    }
  }

  private checkDirectory(dir: string, badLinks: BadLinkItem[]): void {
    const items = fs.readdirSync(dir);
    items.forEach(name => {
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        this.checkDirectory(fullPath, badLinks);
      } else if (stat.isFile() && name.endsWith('.md')) {
        this.checkFile(fullPath, badLinks);
      }
    });
  }

  private checkFile(filePath: string, badLinks: BadLinkItem[]): void {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Pattern to look for markdown links like [Text](file:///...) or [Text](C:\...) or [Text](http://...)
    // AGENTS.md Rule 5 constraint: must use relative paths e.g. [Worker](src/Worker.ts). No absolute file://.
    const absoluteLinkPattern = /\[.*?\]\((file:\/\/|http:\/\/|https:\/\/|www\.)/gi;

    lines.forEach((line, index) => {
      let match;
      while ((match = absoluteLinkPattern.exec(line)) !== null) {
        badLinks.push({
          file: path.relative(path.join(__dirname, '../..'), filePath),
          line: index + 1,
          text: match[0]
        });
      }
    });
  }
}

const linter = new RulesLinter();
linter.run();
