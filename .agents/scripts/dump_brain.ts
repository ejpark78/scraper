import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

class BrainDumper {
  private readonly baseBrainDir: string;

  constructor() {
    this.baseBrainDir = path.join(os.homedir(), '.gemini/antigravity-cli/brain');
  }

  public run(allMode: boolean): void {
    try {
      const sessionIds = this.getSessions(allMode);
      console.log(allMode ? `🧠 Dumping brain data for ALL (${sessionIds.length}) sessions...` : `🧠 Dumping brain data for latest session...`);

      sessionIds.forEach(id => {
        console.log(`-> Session ID: ${id}`);
        this.dumpBrain(id);
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

  private dumpBrain(conversationId: string): void {
    const logFilePath = path.join(this.baseBrainDir, conversationId, '.system_generated/logs/transcript_full.jsonl');
    const outputFilePath = path.join(__dirname, `../transcripts/${conversationId}/brain_dump.md`);

    if (!fs.existsSync(logFilePath)) {
      console.warn(`[Skip] Log file not found for session ${conversationId}: ${logFilePath}`);
      return;
    }

    const lines = fs.readFileSync(logFilePath, 'utf-8').split('\n').filter(Boolean);
    let totalToolCalls = 0;
    let toolSummary: { [key: string]: number } = {};
    const messages: { role: string; content: string; stepIndex: number }[] = [];

    lines.forEach((line) => {
      try {
        const step = JSON.parse(line);
        const stepIndex = step.step_index ?? 0;
        const rawContent = step.content ?? '';
        if (step.type === 'USER_INPUT') {
          messages.push({ role: 'user', content: rawContent, stepIndex });
        }
        if (step.type === 'PLANNER_RESPONSE') {
          messages.push({ role: 'agent', content: rawContent, stepIndex });
          if (step.tool_calls && step.tool_calls.length > 0) {
            step.tool_calls.forEach((tool: any) => {
              totalToolCalls++;
              toolSummary[tool.name] = (toolSummary[tool.name] || 0) + 1;
            });
          }
        }
      } catch (e) {}
    });

    const dateStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST';
    
    let brainDumpContent = `# 🧠 Brain Dump (Session: ${conversationId})
- **Dumped Date**: ${dateStr}
- **Total Turns**: ${messages.filter(m => m.role === 'user').length}
- **Total Tool/Command Calls**: ${totalToolCalls}

## 📊 Tool Usage Summary
${Object.keys(toolSummary).length > 0 
  ? Object.entries(toolSummary).map(([tool, count]) => `- **${tool}**: ${count} times`).join('\n')
  : '- No tools executed in this session.'
}

## 💬 Conversation Summary Timeline
`;

    messages.forEach((msg) => {
      const roleIcon = msg.role === 'user' ? '🗣️ User' : '🤖 Agent';
      const truncatedContent = msg.content.length > 300 
        ? msg.content.substring(0, 300).replace(/\n/g, ' ') + '...'
        : msg.content.replace(/\n/g, ' ');
      brainDumpContent += `* **[Step ${msg.stepIndex}] ${roleIcon}**: ${truncatedContent}\n`;
    });

    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
    fs.writeFileSync(outputFilePath, brainDumpContent.trim(), 'utf-8');
    console.log(`✨ Saved brain dump: ${outputFilePath}`);
  }
}

const args = process.argv.slice(2);
const allMode = args.includes('--all') || args.includes('-a');

const dumper = new BrainDumper();
dumper.run(allMode);
