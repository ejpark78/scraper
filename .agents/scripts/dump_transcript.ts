/**
 * @module dump_transcript
 * @description Extracts and formats agent execution transcripts from raw JSONL log files to Markdown reports.
 * @constraints
 *   - Gracefully skips sessions with missing or corrupt transcript log files.
 *   - Places formatted Markdown documents into the designated reports directory.
 *   - Copies all session logs, scratch scripts, and artifacts to the destination session folder.
 *   - Includes relative markdown links to session folders and raw command output log files.
 *   - Sanitizes absolute workspace paths to relative paths in tool arguments and outputs.
 *   - Follows strict OOP patterns and JSDoc guidelines.
 * @dependencies Node fs/path, agent_adapter
 * @lastUpdated 2026-06-11
 */

import * as fs from 'fs';
import * as path from 'path';
import { createAdapter, parseAgentsFromArg, assignSessionNumbers, AgentToolCall, AgentAdapter } from './lib/agent_adapter';

export class TranscriptDumper {
  private readonly workspaceRoot: string = path.resolve(__dirname, '../..');
  private readonly adapter: AgentAdapter;
  private readonly allMode: boolean;
  private readonly agentName: string;

  constructor(agentName: string, allMode = false) {
    this.agentName = agentName;
    this.adapter = createAdapter(agentName);
    this.allMode = allMode;
  }

  private sanitizeAbsolutePaths(text: string): string {
    const escapedRoot = this.workspaceRoot.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(escapedRoot + '/?', 'g');
    return text.replace(regex, './');
  }

  private truncateOutput(text: string, maxLines = 150, keepHead = 50, keepTail = 100): string {
    const lines = text.split('\n');
    if (lines.length <= maxLines) {
      return text;
    }
    const head = lines.slice(0, keepHead);
    const tail = lines.slice(lines.length - keepTail);
    const truncatedCount = lines.length - keepHead - keepTail;
    return [
      ...head,
      `\n... [Truncated ${truncatedCount} lines of output. Full log copied to tasks/ directory] ...\n`,
      ...tail
    ].join('\n');
  }

  private buildTranscript(
    sessionId: string,
    rawTitle: string,
    messages: { role: string; content: string; toolCalls: AgentToolCall[]; stepIndex: number }[],
    taskLogs?: { id: string; localPath: string }[]
  ): string {
    const title = rawTitle !== sessionId ? rawTitle : `Session ${sessionId}`;
    let md = `# 📝 Transcript: ${title}\n- **Session ID**: ${sessionId}\n`;
    md += `- **Related Reports**: [Brain Dump](./brain_dump.md) | [Context Snapshot](./context_memory.md) | [Raw Logs](./logs/)\n`;
    if (taskLogs && taskLogs.length > 0) {
      md += `- **Command Logs**:\n`;
      for (const log of taskLogs) {
        md += `  - [${log.id}.log](./tasks/${log.id}.log)\n`;
      }
    }
    md += `\n`;

    for (const msg of messages) {
      if (msg.role === 'user') {
        md += `---\n# 📌 Turn ${msg.stepIndex}\n## 🗣️ User Request\n> ${msg.content}\n`;
      }
      if (msg.role === 'assistant') {
        md += `\n## 🤖 Agent Answer\n\n${msg.content}\n`;
        if (msg.toolCalls.length > 0) {
          md += `\n### 💻 Tool Calls\n`;
          for (const tool of msg.toolCalls) {
            let args = tool.arguments;
            if (typeof args === 'string') {
              try { args = JSON.parse(args); } catch {}
            }

            if (tool.name === 'run_command') {
              const cmd = args.CommandLine || args.command || JSON.stringify(args);
              const sanitizedCmd = this.sanitizeAbsolutePaths(cmd);
              md += `* **💻 Run Command**: \`${sanitizedCmd}\`\n`;
              if (tool.result) {
                const truncatedResult = this.truncateOutput(tool.result);
                const sanitizedResult = this.sanitizeAbsolutePaths(truncatedResult);
                md += `  * **Output**:\n    \`\`\`bash\n    ${sanitizedResult.trim().replace(/\n/g, '\n    ')}\n    \`\`\`\n`;
                const taskMatch = tool.result.match(/task-\d+/);
                if (taskMatch) {
                  const taskId = taskMatch[0];
                  md += `  * **Raw Log File**: [${taskId}.log](./tasks/${taskId}.log)\n`;
                }
              }
            } else {
              md += `* **🛠️ Tool**: \`${tool.name}\`\n`;
              const argsStr = this.sanitizeAbsolutePaths(JSON.stringify(args));
              md += `  * **Arguments**: \`${argsStr}\`\n`;
              if (tool.result) {
                const truncatedResult = this.truncateOutput(tool.result);
                const sanitizedResult = this.sanitizeAbsolutePaths(truncatedResult);
                md += `  * **Result**:\n    \`\`\`json\n    ${sanitizedResult.trim().replace(/\n/g, '\n    ')}\n    \`\`\`\n`;
              }
            }
          }
        }
      }
    }

    return md.trim();
  }

  public dumpAll(): void {
    console.log(`🤖 Processing ${this.agentName} sessions...`);

    const sessions = this.adapter.getSessions(this.allMode);
    const pathMap = assignSessionNumbers(sessions);

    sessions.forEach(s => {
      const info = pathMap.get(s.id);
      if (!info) return;
      console.log(`  -> ${info.tag} (${s.title})`);

      try {
        const detail = this.adapter.getSessionDetail(s.id);

        // Find task logs selectively from baseBrainDir to provide as parameter to buildTranscript
        const taskLogs: { id: string; localPath: string }[] = [];
        if (this.adapter.baseBrainDir) {
          const srcTasksDir = path.join(this.adapter.baseBrainDir, s.id, '.system_generated', 'tasks');
          if (fs.existsSync(srcTasksDir)) {
            const files = fs.readdirSync(srcTasksDir);
            for (const file of files) {
              if (file.endsWith('.log')) {
                const taskId = file.replace('.log', '');
                taskLogs.push({ id: taskId, localPath: path.join(srcTasksDir, file) });
              }
            }
          }
        }

        const md = this.buildTranscript(s.id, s.title || s.id, detail.messages, taskLogs);

        const outDir = path.join(__dirname, '..', 'transcripts', this.agentName, info.dateDir);
        const destSessionDir = path.join(outDir, info.tag);
        fs.mkdirSync(destSessionDir, { recursive: true });

        // Write main transcript file inside the session folder as transcript.md
        const outPath = path.join(destSessionDir, `transcript.md`);
        fs.writeFileSync(outPath, md, 'utf-8');
        console.log(`  ✨ Saved transcript: ${outPath}`);

        // Copy raw session assets & logs if baseBrainDir is exposed
        if (this.adapter.baseBrainDir) {
          const srcSessionDir = path.join(this.adapter.baseBrainDir, s.id);
          if (fs.existsSync(srcSessionDir)) {
            // Copy all session files recursively (artifacts, scratch scripts) excluding .system_generated
            fs.cpSync(srcSessionDir, destSessionDir, {
              recursive: true,
              filter: (src) => {
                const relative = path.relative(srcSessionDir, src);
                return !relative.startsWith('.system_generated');
              }
            });

            // Copy task log files selectively
            const srcTasksDir = path.join(srcSessionDir, '.system_generated', 'tasks');
            const destTasksDir = path.join(destSessionDir, 'tasks');
            if (fs.existsSync(srcTasksDir)) {
              fs.mkdirSync(destTasksDir, { recursive: true });
              fs.cpSync(srcTasksDir, destTasksDir, { recursive: true });
            }

            // Copy raw conversation JSONL logs selectively
            const srcLogsDir = path.join(srcSessionDir, '.system_generated', 'logs');
            const destLogsDir = path.join(destSessionDir, 'logs');
            if (fs.existsSync(srcLogsDir)) {
              fs.mkdirSync(destLogsDir, { recursive: true });
              fs.cpSync(srcLogsDir, destLogsDir, { recursive: true });
            }

            console.log(`  ✨ Copied all raw session assets and logs to: ${destSessionDir}`);
          }
        }
      } catch (detailErr: any) {
        console.warn(`  ⚠️ Skipping session ${s.id} due to error: ${detailErr.message}`);
      }
    });
  }
}

// ─── CLI Entrypoint ────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const allMode = args.includes('--all') || args.includes('-a');
  const agentFlag = args.find(a => a.startsWith('--agent='));
  const agents = agentFlag ? parseAgentsFromArg(agentFlag.split('=')[1]) : ['agy'];

  for (const agentName of agents) {
    try {
      const dumper = new TranscriptDumper(agentName, allMode);
      dumper.dumpAll();
    } catch (err: any) {
      console.error(`  ❌ Error for ${agentName}: ${err.message}`);
      if (process.exitCode === undefined) process.exitCode = 1;
    }
  }

  if (process.exitCode !== 1) {
    console.log('✅ Done.');
  }
}
