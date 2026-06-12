/**
# 🤖 dump.ts
# Description: Unified utility script to dump agent session transcripts, context, brain details, and system info.
# Constraints:
#   - Relies on arguments to choose which items to dump: --sysinfo, --transcript, --context, --brain, --all.
#   - Decouples file writing from business logic by using clean wrapper classes.
# Dependencies: fs, path, os, child_process, ./lib/agent_adapter
# ==============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import {
  createAdapter,
  parseAgentsFromArg,
  assignSessionNumbers,
  AgentToolCall,
  AgentAdapter,
  AgentMessage,
  AgentSession
} from './lib/agent_adapter';

// ==============================================================================
// 1. SysInfo Dumper
// ==============================================================================
interface DockerServiceInfo {
  Service: string;
  State: string;
}

export class SysInfoDumper {
  public run(): void {
    try {
      const info = {
        timestamp: new Date().toISOString(),
        git: this.getGitStatus(),
        docker: this.getDockerStatus(),
        mongo: this.getMongoConnectivity(),
        redis: this.getRedisConnectivity()
      };

      const transcriptsAgyDir = path.join(__dirname, '../../../data/agents/agy');
      fs.mkdirSync(transcriptsAgyDir, { recursive: true });
      const destPath = path.join(transcriptsAgyDir, 'sysinfo_cache.json');
      fs.writeFileSync(destPath, JSON.stringify(info, null, 2), 'utf-8');
      console.log(`✨ System status cached at data/agents/agy: ${destPath}`);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('❌ Error dumping sysinfo:', errMsg);
    }
  }

  private getGitStatus(): string {
    try {
      const branch = execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
      const status = execSync('git status -s', { stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
      return `Branch: ${branch}${status ? ' | Changes: ' + status.replace(/\n/g, ', ') : ' | Clean'}`;
    } catch {
      return 'Not a git repo or command failed';
    }
  }

  private getDockerStatus(): string {
    try {
      const output = execSync('docker compose -p linkedin ps --format json', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      const services = JSON.parse(`[${output.trim().split('\n').join(',')}]`) as DockerServiceInfo[];
      return services.map((s: DockerServiceInfo) => `${s.Service}:${s.State}`).join(', ');
    } catch {
      return 'Docker down or command failed';
    }
  }

  private getMongoConnectivity(): string {
    try {
      const output = execSync('docker exec linkedin-mongodb-1 mongosh --eval "db.adminCommand({ping: 1})" --quiet', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      return output.includes('ok: 1') ? 'Connected (Active)' : 'Disconnected';
    } catch {
      return 'Disconnected/Unavailable';
    }
  }

  private getRedisConnectivity(): string {
    try {
      const output = execSync('docker exec linkedin-redis-1 redis-cli ping', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      return output.trim() === 'PONG' ? 'Connected (Active)' : 'Disconnected';
    } catch {
      return 'Disconnected/Unavailable';
    }
  }
}

// ==============================================================================
// 2. Transcript Dumper
// ==============================================================================
export class TranscriptDumper {
  private readonly workspaceRoot: string = path.resolve(__dirname, '../../..');
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
      md += `- **Tasks Execution Logs**:\n`;
      taskLogs.forEach(t => {
        md += `  - [Task: ${t.id}](./tasks/${t.id}.log)\n`;
      });
    }
    md += `\n---\n`;

    messages.forEach(msg => {
      const roleIcon = msg.role === 'user' ? '🗣️ User' : '🤖 Agent';
      md += `\n### [Step ${msg.stepIndex}] ${roleIcon}\n`;
      
      if (msg.content) {
        md += `\n${this.sanitizeAbsolutePaths(msg.content.trim())}\n`;
      }

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        msg.toolCalls.forEach(call => {
          md += `\n> **🛠️ Tool Call**: \`${call.name}\`\n`;
          md += `> \`\`\`json\n> ${JSON.stringify(call.arguments, null, 2).replace(/\n/g, '\n> ')}\n> \`\`\`\n`;
          if (call.result) {
            md += `>\n> **Result**:\n`;
            const lines = call.result.split('\n');
            const hasLongOutput = lines.length > 150;
            const outputText = hasLongOutput ? this.truncateOutput(call.result) : call.result;
            
            md += `> \`\`\`\n> ${this.sanitizeAbsolutePaths(outputText.trim()).replace(/\n/g, '\n> ')}\n> \`\`\`\n`;
          }
        });
      }
    });

    return md;
  }

  public dumpAll(): void {
    const sessions = this.adapter.getSessions(this.allMode);
    const pathMap = assignSessionNumbers(sessions);

    sessions.forEach(s => {
      const info = pathMap.get(s.id);
      if (!info) return;
      console.log(`  -> ${info.tag} (${s.title})`);

      try {
        const detail = this.adapter.getSessionDetail(s.id);
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

        const outDir = path.join(__dirname, '..', '..', '..', 'data', 'agents', this.agentName, info.dateDir);
        const destSessionDir = path.join(outDir, info.tag);
        fs.mkdirSync(destSessionDir, { recursive: true });

        const outPath = path.join(destSessionDir, `transcript.md`);
        fs.writeFileSync(outPath, md, 'utf-8');
        console.log(`  ✨ Saved transcript: ${outPath}`);

        if (this.adapter.baseBrainDir) {
          const srcSessionDir = path.join(this.adapter.baseBrainDir, s.id);
          if (fs.existsSync(srcSessionDir)) {
            fs.cpSync(srcSessionDir, destSessionDir, {
              recursive: true,
              filter: (src) => {
                const relative = path.relative(srcSessionDir, src);
                return !relative.startsWith('.system_generated');
              }
            });

            const srcTasksDir = path.join(srcSessionDir, '.system_generated', 'tasks');
            const destTasksDir = path.join(destSessionDir, 'tasks');
            if (fs.existsSync(srcTasksDir)) {
              fs.mkdirSync(destTasksDir, { recursive: true });
              fs.cpSync(srcTasksDir, destTasksDir, { recursive: true });
            }

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

// ==============================================================================
// 3. Context Dumper
// ==============================================================================
export class ContextDumper {
  private readonly agentName: string;
  private readonly allMode: boolean;

  constructor(agentName: string, allMode = false) {
    this.agentName = agentName;
    this.allMode = allMode;
  }

  private getSystemMetadata(): { mongoStatus: string; redisStatus: string; scale: string; gitBranch: string; gitDirty: string } {
    let mongoStatus = 'Disconnected/Unavailable';
    let redisStatus = 'Disconnected/Unavailable';
    let scale = '1';
    let gitBranch = 'N/A';
    let gitDirty = 'Clean';

    try {
      const out = execSync('docker compose -p linkedin ps mongodb --format json 2>/dev/null', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      if (out.includes('"running"')) mongoStatus = 'Connected (Active)';
    } catch {
      // Ignore
    }

    try {
      const out = execSync('docker compose -p linkedin ps redis --format json 2>/dev/null', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      if (out.includes('"running"')) redisStatus = 'Connected (Active)';
    } catch {
      // Ignore
    }

    try {
      const mk = path.join(__dirname, '../../../scripts/utils/pipeline.mk');
      if (fs.existsSync(mk)) {
        const m = fs.readFileSync(mk, 'utf-8').match(/SCALE\s*\?=\s*(\d+)/);
        if (m) scale = m[1];
      }
    } catch {
      // Ignore
    }

    try {
      gitBranch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { cwd: path.join(__dirname, '../../..'), stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
      const statusOut = execSync('git status --porcelain 2>/dev/null', { cwd: path.join(__dirname, '../../..'), stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      if (statusOut) gitDirty = `(+${statusOut.split('\n').filter(Boolean).length}개 변경)`;
    } catch {
      // Ignore
    }

    return { mongoStatus, redisStatus, scale, gitBranch, gitDirty };
  }

  private formatDate(ts: number): string {
    if (!ts) return '알 수 없음';
    try {
      return new Date(ts).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST';
    } catch {
      return new Date(ts).toISOString();
    }
  }

  private buildContextMemory(session: AgentSession, messages: AgentMessage[]): string {
    const meta = this.getSystemMetadata();

    let md = `# 🧠 Context Memory Snapshot\n`;
    md += `- **Session ID**: ${session.id}\n`;
    md += `- **Created**:    ${this.formatDate(session.timeCreated)}\n`;
    md += `- **Updated**:    ${this.formatDate(session.timeUpdated)}\n`;
    md += `- **LLM Model**:  ${session.model || 'Unknown'}\n`;
    md += `\n## 🛠️ Environment Status\n`;
    md += `- **Docker services**:\n`;
    md += `  - MongoDB: ${meta.mongoStatus}\n`;
    md += `  - Redis:   ${meta.redisStatus}\n`;
    md += `- **Crawler Scale**: ${meta.scale} concurrency\n`;
    md += `- **Git Workspace**:\n`;
    md += `  - Branch:  \`${meta.gitBranch}\` (${meta.gitDirty})\n`;
    
    md += `\n## 📋 Active Tasks Stack\n`;
    
    // Parse logs to extract background tasks
    const tasksMap = new Map<string, { cmd: string; started: string; status: string; log: string }>();
    messages.forEach(msg => {
      msg.toolCalls.forEach(call => {
        if (call.name === 'run_command' && call.result) {
          const m = call.result.match(/Task id "([^"]+)" finished with result/);
          if (m) {
            const taskId = m[1];
            const t = tasksMap.get(taskId);
            if (t) t.status = 'Completed';
          }

          const launchMatch = call.result.match(/task id: ([^\n]+)/);
          const descMatch = call.result.match(/Task Description: ([^\n]+)/);
          const logMatch = call.result.match(/Task logs are available at: ([^\n]+)/);

          if (launchMatch) {
            const taskId = launchMatch[1].trim();
            const cmd = descMatch ? descMatch[1].trim() : 'Unknown';
            const log = logMatch ? logMatch[1].trim() : 'N/A';
            tasksMap.set(taskId, {
              cmd,
              started: this.formatDate(msg.stepIndex * 1000 + session.timeCreated), // estimate
              status: 'Running',
              log
            });
          }
        }
      });
    });

    if (tasksMap.size === 0) {
      md += `* 비동기 백그라운드 태스크 기록 없음.\n`;
    } else {
      md += `| Task ID | Command | Started At | Status | Log File |\n`;
      md += `| :--- | :--- | :--- | :--- | :--- |\n`;
      tasksMap.forEach((t, id) => {
        md += `| \`${id}\` | \`${t.cmd}\` | ${t.started} | **${t.status}** | [Link](${t.log}) |\n`;
      });
    }

    md += `\n## 👤 User Requests Log\n`;
    let reqCount = 0;
    messages.forEach(msg => {
      if (msg.role === 'user') {
        reqCount++;
        md += `### Request #${reqCount} (${this.formatDate(session.timeCreated + msg.stepIndex * 1000)})\n`;
        md += `${msg.content.trim()}\n\n`;
      }
    });

    return md;
  }

  public dump(): void {
    console.log(`🧠 Dumping context for ${this.agentName}...`);

    try {
      const adapter = createAdapter(this.agentName);
      const sessions = adapter.getSessions(this.allMode);
      const pathMap = assignSessionNumbers(sessions);

      sessions.forEach(s => {
        const info = pathMap.get(s.id);
        if (!info) return;
        console.log(`  -> ${info.tag} (${s.title})`);

        const brainDumpPath = path.join(__dirname, '..', '..', '..', 'data', 'agents', this.agentName, info.dateDir, info.tag, 'brain_dump.md');
        if (!fs.existsSync(brainDumpPath)) {
          console.log(`  ⏭️  Skip (no brain_dump.md): ${info.tag}`);
          return;
        }

        try {
          const detail = adapter.getSessionDetail(s.id);
          const md = this.buildContextMemory(detail.session, detail.messages);
          const outDir = path.join(__dirname, '..', '..', '..', 'data', 'agents', this.agentName, info.dateDir, info.tag);
          fs.mkdirSync(outDir, { recursive: true });
          fs.writeFileSync(path.join(outDir, 'context_memory.md'), md, 'utf-8');
          console.log(`  ✨ Saved: ${outDir}/context_memory.md`);
        } catch (detailErr: unknown) {
          const errMsg = detailErr instanceof Error ? detailErr.message : String(detailErr);
          console.warn(`  ⚠️ Skipping context dump for session ${s.id} due to error: ${errMsg}`);
        }
      });

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Error for ${this.agentName}: ${errMsg}`);
    }
  }
}

// ==============================================================================
// 4. Brain Dumper
// ==============================================================================
export class BrainDumper {
  private readonly agentName: string;
  private readonly allMode: boolean;

  constructor(agentName: string, allMode = false) {
    this.agentName = agentName;
    this.allMode = allMode;
  }

  private buildBrainDump(session: AgentSession, messages: AgentMessage[]): string {
    let md = `# 🧠 Agent Brain Dump: ${session.title}\n`;
    md += `- **Session ID**: \`${session.id}\`\n`;
    md += `- **Model**:      ${session.model || 'Unknown'}\n`;
    md += `- **Tokens**:     Input: ${session.tokensInput} \| Output: ${session.tokensOutput} (${session.tokensReasoning} reasoning)\n`;
    md += `- **Est Cost**:   $${session.cost.toFixed(4)}\n\n`;
    
    md += `## 🚀 Execution Steps\n`;

    messages.forEach(msg => {
      const roleTitle = msg.role === 'user' ? '🗣️ User' : '🤖 Agent';
      md += `### Step ${msg.stepIndex}: ${roleTitle}\n`;
      md += `${msg.content.trim()}\n\n`;

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        md += `#### 🛠️ Tool Executions\n`;
        msg.toolCalls.forEach(call => {
          md += `- **Tool**: \`${call.name}\`\n`;
          md += `  - **Args**: \`${JSON.stringify(call.arguments)}\`\n`;
          if (call.result) {
            const lines = call.result.split('\n');
            const summary = lines.slice(0, 3).join('\n') + (lines.length > 3 ? `\n... (Total ${lines.length} lines)` : '');
            md += `  - **Result**: \n\`\`\`\n${summary.trim()}\n\`\`\`\n`;
          }
        });
        md += `\n`;
      }
    });

    return md;
  }

  public dump(): void {
    console.log(`🧠 Dumping brain for ${this.agentName}...`);

    try {
      const adapter = createAdapter(this.agentName);
      const sessions = adapter.getSessions(this.allMode);
      const pathMap = assignSessionNumbers(sessions);

      sessions.forEach(s => {
        const info = pathMap.get(s.id);
        if (!info) return;
        console.log(`  -> ${info.tag} (${s.title})`);

        try {
          const detail = adapter.getSessionDetail(s.id);
          const md = this.buildBrainDump(detail.session, detail.messages);

          const outDir = path.join(__dirname, '..', '..', '..', 'data', 'agents', this.agentName, info.dateDir, info.tag);
          fs.mkdirSync(outDir, { recursive: true });
          const outPath = path.join(outDir, 'brain_dump.md');
          fs.writeFileSync(outPath, md, 'utf-8');
          console.log(`  ✨ Saved: ${outPath}`);
        } catch (detailErr: unknown) {
          const errMsg = detailErr instanceof Error ? detailErr.message : String(detailErr);
          console.warn(`  ⚠️ Skipping brain dump for session ${s.id} due to error: ${errMsg}`);
        }
      });

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Error for ${this.agentName}: ${errMsg}`);
    }
  }
}

// ==============================================================================
// CLI Main Entrypoint
// ==============================================================================
if (require.main === module) {
  const args = process.argv.slice(2);
  const allMode = args.includes('--all') || args.includes('-a');
  
  const hasTranscript = args.includes('--transcript') || args.includes('-t');
  const hasContext = args.includes('--context') || args.includes('-c');
  const hasBrain = args.includes('--brain') || args.includes('-b');
  const hasSysinfo = args.includes('--sysinfo') || args.includes('-s');
  
  // Default to running everything if no specific target option is provided
  const runAll = args.includes('--all-targets') || (!hasTranscript && !hasContext && !hasBrain && !hasSysinfo);

  const agentFlag = args.find(a => a.startsWith('--agent='));
  const agents = agentFlag ? parseAgentsFromArg(agentFlag.split('=')[1]) : ['agy'];

  if (runAll || hasSysinfo) {
    console.log('🤖 Running Sysinfo Dumper...');
    new SysInfoDumper().run();
  }

  for (const agentName of agents) {
    try {
      if (runAll || hasTranscript) {
        console.log(`📝 Running Transcript Dumper for ${agentName}...`);
        new TranscriptDumper(agentName, allMode).dumpAll();
      }
      
      if (runAll || hasBrain) {
        console.log(`🧠 Running Brain Dumper for ${agentName}...`);
        new BrainDumper(agentName, allMode).dump();
      }

      if (runAll || hasContext) {
        console.log(`🧠 Running Context Dumper for ${agentName}...`);
        new ContextDumper(agentName, allMode).dump();
      }
    } catch (err: any) {
      console.error(`❌ Error during dump execution for ${agentName}:`, err.message);
      if (process.exitCode === undefined) process.exitCode = 1;
    }
  }

  if (process.exitCode !== 1) {
    console.log('✅ Done.');
  }
}
