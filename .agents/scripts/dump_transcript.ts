import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

class TranscriptDumper {
  private readonly baseBrainDir: string;

  constructor() {
    this.baseBrainDir = path.join(os.homedir(), '.gemini/antigravity-cli/brain');
  }

  public run(allMode: boolean): void {
    try {
      const sessionIds = this.getSessions(allMode);
      console.log(allMode ? `🤖 Processing ALL (${sessionIds.length}) sessions...` : `🤖 Processing latest session...`);
      
      sessionIds.forEach(id => {
        console.log(`-> Session ID: ${id}`);
        this.processSession(id);
      });
      console.log('✅ Done.');
    } catch (err: any) {
      console.error('❌ Error:', err.message);
      process.exit(1);
    }
  }

  private getSessions(all: boolean): string[] {
    if (!fs.existsSync(this.baseBrainDir)) {
      throw new Error(`Directory not found: ${this.baseBrainDir}`);
    }

    const dirs = fs.readdirSync(this.baseBrainDir)
      .map(name => {
        const fullPath = path.join(this.baseBrainDir, name);
        return {
          name,
          isDir: fs.statSync(fullPath).isDirectory(),
          mtime: fs.statSync(fullPath).mtimeMs
        };
      })
      .filter(item => item.isDir && item.name !== 'scratch' && item.name !== '.system_generated')
      .sort((a, b) => b.mtime - a.mtime);

    if (dirs.length === 0) {
      throw new Error('No conversation sessions found.');
    }

    return all ? dirs.map(d => d.name) : [dirs[0].name];
  }

  private processSession(conversationId: string): void {
    const logFilePath = path.join(this.baseBrainDir, conversationId, '.system_generated/logs/transcript_full.jsonl');
    const outputFilePath = path.join(__dirname, `../transcripts/${conversationId}.md`);

    if (!fs.existsSync(logFilePath)) {
      console.warn(`[Skip] Log file not found for session ${conversationId}: ${logFilePath}`);
      return;
    }

    const lines = fs.readFileSync(logFilePath, 'utf-8').split('\n').filter(Boolean);
    let transcriptContent = '';

    lines.forEach((line) => {
      try {
        const step = JSON.parse(line);
        if (step.type === 'USER_INPUT') {
          transcriptContent += `\n---\n# 📌 Turn\n## 🗣️ User Request\n> ${step.content}\n`;
        }
        if (step.type === 'PLANNER_RESPONSE') {
          transcriptContent += `\n## 🗣️ Agent Answer\n> ${step.content}\n`;
          if (step.tool_calls && step.tool_calls.length > 0) {
            transcriptContent += `\n### 💻 Executed CLI Commands / Tool Calls\n`;
            step.tool_calls.forEach((tool: any) => {
              transcriptContent += `- **${tool.name}**: \`${JSON.stringify(tool.arguments)}\`\n`;
            });
          }
        }
      } catch (e) {
        // Ignore parsing errors for malformed lines
      }
    });

    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
    fs.writeFileSync(outputFilePath, transcriptContent.trim(), 'utf-8');
    console.log(`✨ Saved transcript: ${outputFilePath}`);
  }
}

const args = process.argv.slice(2);
const allMode = args.includes('--all') || args.includes('-a');

const dumper = new TranscriptDumper();
dumper.run(allMode);
