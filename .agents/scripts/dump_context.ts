import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

interface TranscriptEntry {
  step_index?: number;
  source?: string;
  type?: string;
  status?: string;
  created_at?: string;
  content?: string;
  tool_calls?: { name: string; arguments?: any }[];
  truncated_fields?: string[];
}

interface SessionStats {
  totalTurns: number;
  totalToolCalls: number;
  toolCounts: Record<string, number>;
  firstUserMessage: string;
  sessionStart: string;
  sessionEnd: string;
  filesTouched: Set<string>;
}

class ContextDumper {
  private readonly baseBrainDir: string;

  constructor() {
    this.baseBrainDir = path.join(os.homedir(), '.gemini/antigravity-cli/brain');
  }

  public run(allMode: boolean): void {
    try {
      const sessions = this.getSessions(allMode);
      console.log(allMode ? `🤖 Dumping context for ALL (${sessions.length}) sessions...` : `🤖 Dumping context for latest session...`);

      const transcriptsDir = path.join(__dirname, '../transcripts');

      sessions.forEach(s => {
        const brainDumpPath = path.join(transcriptsDir, s.id, 'brain_dump.md');
        if (!fs.existsSync(brainDumpPath)) {
          console.log(`  ⏭️  Skip (no brain_dump.md): ${s.id}`);
          return;
        }
        console.log(`-> Session ID: ${s.id}`);
        this.dumpContext(s.id, s.mtime);
      });
      console.log('✅ Done.');
    } catch (err: any) {
      console.error('❌ Error executing dump:', err.message);
      process.exit(1);
    }
  }

  private getSessions(all: boolean): { id: string; mtime: number }[] {
    if (!fs.existsSync(this.baseBrainDir)) {
      throw new Error(`Directory not found: ${this.baseBrainDir}`);
    }

    return fs.readdirSync(this.baseBrainDir)
      .map(name => {
        const fullPath = path.join(this.baseBrainDir, name);
        return { id: name, isDir: fs.statSync(fullPath).isDirectory(), mtime: fs.statSync(fullPath).mtimeMs };
      })
      .filter(item => item.isDir && item.id !== 'scratch' && item.id !== '.system_generated')
      .sort((a, b) => b.mtime - a.mtime)
      .map(item => ({ id: item.id, mtime: item.mtime }));
  }

  private readSessionStats(conversationId: string, sessionDirMtime: number): SessionStats {
    const transcriptPath = path.join(this.baseBrainDir, conversationId, '.system_generated/logs/transcript_full.jsonl');
    const stats: SessionStats = {
      totalTurns: 0,
      totalToolCalls: 0,
      toolCounts: {},
      firstUserMessage: '',
      sessionStart: new Date(sessionDirMtime).toISOString(),
      sessionEnd: '',
      filesTouched: new Set(),
    };

    if (!fs.existsSync(transcriptPath)) return stats;

    const lines = fs.readFileSync(transcriptPath, 'utf-8').split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const entry: TranscriptEntry = JSON.parse(line);
        if (!stats.sessionStart && entry.created_at) stats.sessionStart = entry.created_at;
        if (entry.created_at) stats.sessionEnd = entry.created_at;

        if (entry.type === 'USER_INPUT') {
          stats.totalTurns++;
          if (!stats.firstUserMessage && entry.content) {
            stats.firstUserMessage = entry.content.replace(/<[^>]*>/g, '').trim().slice(0, 300);
          }
        }

        if (entry.tool_calls) {
          for (const tc of entry.tool_calls) {
            if (tc.name) {
              stats.totalToolCalls++;
              stats.toolCounts[tc.name] = (stats.toolCounts[tc.name] || 0) + 1;
            }
            if (tc.arguments) {
              const argsStr = typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments);
              const fileMatches = argsStr.match(/\/home\/ejpark\/workspace\/linkedin\/[^\s,"'`)]+/g);
              if (fileMatches) {
                fileMatches.forEach(f => {
                  const rel = f.replace('/home/ejpark/workspace/linkedin/', '');
                  if (rel.length < 120) stats.filesTouched.add(rel);
                });
              }
            }
          }
        }
      } catch (e) { /* skip malformed */ }
    }

    return stats;
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
    } catch (e) {}

    try {
      const out = execSync('docker compose -p linkedin ps redis --format json 2>/dev/null', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      if (out.includes('"running"')) redisStatus = 'Connected (Active)';
    } catch (e) {}

    try {
      const mk = path.join(__dirname, '../../scripts/pipeline.mk');
      if (fs.existsSync(mk)) {
        const m = fs.readFileSync(mk, 'utf-8').match(/SCALE\s*\?=\s*(\d+)/);
        if (m) scale = m[1];
      }
    } catch (e) {}

    try {
      gitBranch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { cwd: path.join(__dirname, '../..'), stdio: ['pipe', 'pipe', 'ignore'] }).toString().trim();
      const statusOut = execSync('git status --porcelain 2>/dev/null', { cwd: path.join(__dirname, '../..'), stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      if (statusOut) gitDirty = `(+${statusOut.split('\n').filter(Boolean).length}개 변경)`;
    } catch (e) {}

    return { mongoStatus, redisStatus, scale, gitBranch, gitDirty };
  }

  private formatDate(iso: string): string {
    if (!iso) return '알 수 없음';
    try {
      return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST';
    } catch { return iso; }
  }

  private dumpContext(conversationId: string, sessionDirMtime: number): void {
    const stats = this.readSessionStats(conversationId, sessionDirMtime);
    const sys = this.getSystemStatus();
    const dumpDate = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST';

    const toolSummary = Object.entries(stats.toolCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `- **${name}**: ${count}회`)
      .join('\n') || '  - 없음';

    const filesSection = [...stats.filesTouched].sort().slice(0, 15).map(f => `  - \`${f}\``).join('\n') || '  - 없음';

    const summaryLine = stats.firstUserMessage
      ? `> "${stats.firstUserMessage}"`
      : '> _세션 데이터가 없습니다._';

    const content = `# 🧠 Workspace Context Memory Snapshot
- **Last Dumped Date**: ${dumpDate}
- **Active Session ID**: \`${conversationId}\`
- **Session Period**: ${this.formatDate(stats.sessionStart)} ~ ${this.formatDate(stats.sessionEnd)}
- **Git Branch**: \`${sys.gitBranch}\` ${sys.gitDirty}

## ⚙️ Active Configurations & Environments
- **Redis URL**: \`redis://redis:6379\`
- **Redis Status**: ${redisStatusIcon(sys.redisStatus)} ${sys.redisStatus}
- **MongoDB Status**: ${mongoStatusIcon(sys.mongoStatus)} ${sys.mongoStatus}
- **Scraper Instances (Scale)**: \`${sys.scale}\`

## 💬 Session 요약
- **Total Turns**: ${stats.totalTurns}회
- **Total Tool Calls**: ${stats.totalToolCalls}회
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

    const outputDir = path.join(__dirname, `../transcripts/${conversationId}`);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'context_memory.md'), content, 'utf-8');
    console.log(`✨ Saved context memory dump: ${outputDir}/context_memory.md`);
  }
}

function redisStatusIcon(s: string): string {
  return s.includes('Active') ? '✅' : '❌';
}

function mongoStatusIcon(s: string): string {
  return s.includes('Active') ? '✅' : '❌';
}

const args = process.argv.slice(2);
const allMode = args.includes('--all') || args.includes('-a');

new ContextDumper().run(allMode);
