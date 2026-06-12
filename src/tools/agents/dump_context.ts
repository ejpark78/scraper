/**
 * @module dump_context
 * @description Captures and saves active workspace variables, configs, and Git stats per session.
 * @constraints
 *   - Gracefully skips sessions with missing or corrupt transcript log files.
 *   - Dumps Markdown memory files alongside transcripts.
 * @dependencies Node fs/path, child_process, agent_adapter
 * @lastUpdated 2026-06-11
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { createAdapter, parseAgentsFromArg, assignSessionNumbers, AgentSession, AgentMessage } from './lib/agent_adapter';

export class ContextDumper {
  private readonly agentName: string;
  private readonly allMode: boolean;

  constructor(agentName: string, allMode = false) {
    this.agentName = agentName;
    this.allMode = allMode;
  }

  private getSystemStatus(): { mongoStatus: string; redisStatus: string; scale: string; gitBranch: string; gitDirty: string } {
    let mongoStatus = 'Disconnected';
    let redisStatus = 'Unknown';
    let scale = '1';
    let gitBranch = '-';
    let gitDirty = '';

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
      return String(ts);
    }
  }

  private buildContextMemory(session: AgentSession, messages: AgentMessage[]): string {
    const sys = this.getSystemStatus();
    const dumpDate = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST';

    const totalTurns = messages.filter(m => m.role === 'user').length;
    let totalToolCalls = 0;
    const toolCounts: Record<string, number> = {};
    const filesTouched = new Set<string>();

    for (const msg of messages) {
      if (msg.role === 'assistant') {
        for (const tc of msg.toolCalls) {
          totalToolCalls++;
          toolCounts[tc.name] = (toolCounts[tc.name] || 0) + 1;
          const argsStr = JSON.stringify(tc.arguments);
          const fileMatches = argsStr.match(/\/home\/ejpark\/workspace\/linkedin\/[^\s,"'`)]+/g);
          if (fileMatches) {
            fileMatches.forEach(f => {
              const rel = f.replace('/home/ejpark/workspace/linkedin/', '');
              if (rel.length < 120) filesTouched.add(rel);
            });
          }
        }
      }
    }

    const firstUserMsg = messages.find(m => m.role === 'user');
    const summaryLine = firstUserMsg
      ? `> "${firstUserMsg.content.replace(/<[^>]*>/g, '').trim().slice(0, 300)}"`
      : '> _세션 데이터가 없습니다._';

    const toolSummary = Object.entries(toolCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `- **${name}**: ${count}회`)
      .join('\n') || '  - 없음';

    const filesSection = [...filesTouched].sort().slice(0, 15).map(f => `  - \`${f}\``).join('\n') || '  - 없음';

    return `# 🧠 Workspace Context Memory Snapshot
- **Last Dumped Date**: ${dumpDate}
- **Active Session ID**: \`${session.id}\`
- **Agent**: ${session.agent || 'unknown'}
- **Model**: ${session.model || 'unknown'}
- **Session Period**: ${this.formatDate(session.timeCreated)} ~ ${this.formatDate(session.timeUpdated)}
- **Git Branch**: \`${sys.gitBranch}\` ${sys.gitDirty}

## ⚙️ Active Configurations & Environments
- **Redis URL**: \`redis://redis:6379\`
- **Redis Status**: ${sys.redisStatus.includes('Active') ? '✅' : '❌'} ${sys.redisStatus}
- **MongoDB Status**: ${sys.mongoStatus.includes('Active') ? '✅' : '❌'} ${sys.mongoStatus}
- **Scraper Instances (Scale)**: \`${sys.scale}\`

## 💬 Session 요약
- **Total Turns**: ${totalTurns}회
- **Total Tool Calls**: ${totalToolCalls}회
- **Tokens (I/O/Reason)**: ${session.tokensInput} / ${session.tokensOutput} / ${session.tokensReasoning}
- **첫 요청**: ${summaryLine}

### 🔧 Tool Usage
${toolSummary}

### 📄 Files Modified
${filesSection}

## 🚨 Critical Constraints
- 사용자 승인 없는 임의의 bash 명령어 실행 금지.
- 변경 작업 및 컨테이너 재시작 시 계획서(Plan) 수립 및 동의 절차 우선 진행.
- 파괴적인 MongoDB 명령어 실행 절대 금지.
- 마크다운 링크 및 코드 심볼 표기 시 상대 경로 규칙 강제 사용.
- 산출물(Artifact) 생성 시 \`.agents/brain/\` 내에 심볼릭 링크 자동 생성/업데이트.
`;
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

        // Check if brain_dump exists first (same logic as original)
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
      if (process.exitCode === undefined) process.exitCode = 1;
    }
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
      const dumper = new ContextDumper(agentName, allMode);
      dumper.dump();
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Error: ${errMsg}`);
      process.exitCode = 1;
    }
  }

  if (process.exitCode !== 1) {
    console.log('✅ Done.');
  }
}
