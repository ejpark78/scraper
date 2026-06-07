import * as fs from 'fs';
import * as path from 'path';

class RuleCompressor {
  private readonly rulesDir = path.join(__dirname, '../rules');
  private readonly outputCompactFile = path.join(__dirname, '../rules_compact.txt');

  public run(): void {
    try {
      console.log('🤖 Compressing rules to save LLM tokens...');
      if (!fs.existsSync(this.rulesDir)) {
        throw new Error(`Directory not found: ${this.rulesDir}`);
      }

      const files = fs.readdirSync(this.rulesDir).filter(f => f.endsWith('.md'));
      let compressedText = '=== COMPACT RULES ===\n';

      files.forEach(file => {
        const filePath = path.join(this.rulesDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const compressed = this.compress(content);
        compressedText += `\n[File: ${file}]\n${compressed}\n`;
      });

      fs.writeFileSync(this.outputCompactFile, compressedText.trim(), 'utf-8');
      console.log(`✅ Compressed rules written to: ${this.outputCompactFile}`);
    } catch (err: any) {
      console.error('❌ Error compressing rules:', err.message);
      process.exit(1);
    }
  }

  private compress(text: string): string {
    return text
      .split('\n')
      .map(line => line.trim())
      // Eliminate empty lines, comments, introductory paragraphs
      .filter(line => line.length > 0 && !line.startsWith('<!--') && !line.startsWith('This document defines') && !line.startsWith('To maximize reliability'))
      .map(line => {
        // Drop excessively verbose wording for LLM prompt economy
        return line
          .replace(/Immediately after the user agrees to\/approves/g, 'Upon user approval of')
          .replace(/The agent can proceed with actual physical tasks/g, 'Proceed only after')
          .replace(/The agent must record the user's raw request/g, 'Record raw request')
          .replace(/Do not delete, truncate, or summarize previous turns/g, 'No truncation of history');
      })
      .join('\n');
  }
}

const compressor = new RuleCompressor();
compressor.run();
