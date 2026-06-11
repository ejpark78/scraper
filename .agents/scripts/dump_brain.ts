/**
 * @module dump_brain
 * @description Generates a high-level visual summary and stats report of agent performance per session.
 * @constraints
 *   - Gracefully skips sessions with missing or corrupt transcript log files.
 *   - Places summary files under the designated agent transcripts subdirectory.
 * @dependencies Node fs/path, agent_adapter
 * @lastUpdated 2026-06-11
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdapter, parseAgentsFromArg, assignSessionNumbers, AgentSession, AgentMessage } from './lib/agent_adapter';

function buildBrainDump(session: AgentSession, messages: AgentMessage[]): string {
  const dateStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST';
  const totalUserTurns = messages.filter(m => m.role === 'user').length;
  let totalToolCalls = 0;
  const toolSummary: Record<string, number> = {};

  for (const msg of messages) {
    if (msg.role === 'assistant') {
      for (const tool of msg.toolCalls) {
        totalToolCalls++;
        toolSummary[tool.name] = (toolSummary[tool.name] || 0) + 1;
      }
    }
  }

  let md = `# 🧠 Brain Dump (Session: ${session.id})\n`;
  md += `- **Agent**: ${session.agent || 'unknown'}\n`;
  md += `- **Model**: ${session.model || 'unknown'}\n`;
  md += `- **Dumped Date**: ${dateStr}\n`;
  md += `- **Total Turns**: ${totalUserTurns}\n`;
  md += `- **Total Tool Calls**: ${totalToolCalls}\n`;
  if (session.tokensInput > 0) {
    md += `- **Tokens (I/O/Reason)**: ${session.tokensInput} / ${session.tokensOutput} / ${session.tokensReasoning}\n`;
  }
  md += '\n';

  md += `## 📊 Tool Usage Summary\n`;
  if (Object.keys(toolSummary).length > 0) {
    for (const [tool, count] of Object.entries(toolSummary).sort((a, b) => b[1] - a[1])) {
      md += `- **${tool}**: ${count} times\n`;
    }
  } else {
    md += '- No tools executed in this session.\n';
  }
  md += '\n';

  md += `## 💬 Conversation Summary Timeline\n`;
  for (const msg of messages) {
    const roleIcon = msg.role === 'user' ? '🗣️ User' : '🤖 Agent';
    const truncated = msg.content.length > 300
      ? msg.content.substring(0, 300).replace(/\n/g, ' ') + '...'
      : msg.content.replace(/\n/g, ' ');
    md += `* **[Step ${msg.stepIndex}] ${roleIcon}**: ${truncated}\n`;
  }

  return md.trim();
}

function run() {
  const args = process.argv.slice(2);
  const allMode = args.includes('--all') || args.includes('-a');
  const agentFlag = args.find(a => a.startsWith('--agent='));
  const agents = agentFlag ? parseAgentsFromArg(agentFlag.split('=')[1]) : ['agy'];

  for (const agentName of agents) {
    console.log(`🧠 Dumping brain for ${agentName}...`);

    try {
      const adapter = createAdapter(agentName);
      const sessions = adapter.getSessions(allMode);
      const pathMap = assignSessionNumbers(sessions);

      sessions.forEach(s => {
        const info = pathMap.get(s.id);
        if (!info) return;
        console.log(`  -> ${info.tag} (${s.title})`);

        try {
          const detail = adapter.getSessionDetail(s.id);
          const md = buildBrainDump(detail.session, detail.messages);

          const outDir = path.join(__dirname, '..', 'transcripts', agentName, info.dateDir, info.tag);
          fs.mkdirSync(outDir, { recursive: true });
          const outPath = path.join(outDir, 'brain_dump.md');
          fs.writeFileSync(outPath, md, 'utf-8');
          console.log(`  ✨ Saved: ${outPath}`);
        } catch (detailErr: any) {
          console.warn(`  ⚠️ Skipping brain dump for session ${s.id} due to error: ${detailErr.message}`);
        }
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
