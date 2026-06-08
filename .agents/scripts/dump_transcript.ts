import * as fs from 'fs';
import * as path from 'path';
import { createAdapter, parseAgentsFromArg, assignSessionNumbers, AgentToolCall } from './lib/agent_adapter';

function buildTranscript(sessionId: string, rawTitle: string, messages: { role: string; content: string; toolCalls: AgentToolCall[]; stepIndex: number }[]): string {
  const title = rawTitle !== sessionId ? rawTitle : `Session ${sessionId}`;
  let md = `# 📝 Transcript: ${title}\n- **Session ID**: ${sessionId}\n\n`;

  for (const msg of messages) {
    if (msg.role === 'user') {
      md += `---\n# 📌 Turn ${msg.stepIndex}\n## 🗣️ User Request\n> ${msg.content}\n`;
    }
    if (msg.role === 'assistant') {
      md += `\n## 🤖 Agent Answer\n> ${msg.content}\n`;
      if (msg.toolCalls.length > 0) {
        md += `\n### 💻 Tool Calls\n`;
        for (const tool of msg.toolCalls) {
          md += `- **${tool.name}**: \`${JSON.stringify(tool.arguments)}\`\n`;
        }
      }
    }
  }

  return md.trim();
}

function run() {
  const args = process.argv.slice(2);
  const allMode = args.includes('--all') || args.includes('-a');
  const agentFlag = args.find(a => a.startsWith('--agent='));
  const agents = agentFlag ? parseAgentsFromArg(agentFlag.split('=')[1]) : ['agy'];

  for (const agentName of agents) {
    console.log(`🤖 Processing ${agentName} sessions...`);

    try {
      const adapter = createAdapter(agentName);
      const sessions = adapter.getSessions(allMode);
      const pathMap = assignSessionNumbers(sessions);

      sessions.forEach(s => {
        const info = pathMap.get(s.id);
        if (!info) return;
        console.log(`  -> ${info.tag} (${s.title})`);

        const detail = adapter.getSessionDetail(s.id);
        const md = buildTranscript(s.id, s.title || s.id, detail.messages);

        const outDir = path.join(__dirname, '..', 'transcripts', agentName, info.dateDir);
        fs.mkdirSync(outDir, { recursive: true });
        const outPath = path.join(outDir, `${info.tag}.md`);
        fs.writeFileSync(outPath, md, 'utf-8');
        console.log(`  ✨ Saved: ${outPath}`);
      });

    } catch (err: any) {
      console.error(`  ❌ Error for ${agentName}: ${err.message}`);
      if (process.exitCode === undefined) process.exitCode = 1;
    }
  }

  if (process.exitCode !== 1) {
    console.log('✅ Done.');
  }
}

run();
