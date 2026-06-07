import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

class ContextDumper {
  private readonly baseBrainDir: string;

  constructor() {
    this.baseBrainDir = path.join(os.homedir(), '.gemini/antigravity-cli/brain');
  }

  public run(allMode: boolean): void {
    try {
      const sessionIds = this.getSessions(allMode);
      console.log(allMode ? `🤖 Dumping context for ALL (${sessionIds.length}) sessions...` : `🤖 Dumping context for latest session...`);

      const scale = this.getScraperScale();
      const mongoStatus = this.getMongoStatus();

      sessionIds.forEach(id => {
        console.log(`-> Session ID: ${id}`);
        this.dumpContext(id, scale, mongoStatus);
      });
      console.log('✅ Done.');
    } catch (err: any) {
      console.error('❌ Error executing dump:', err.message);
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

  private getScraperScale(): string {
    try {
      const pipelineMkPath = path.join(__dirname, '../../scripts/pipeline.mk');
      if (fs.existsSync(pipelineMkPath)) {
        const content = fs.readFileSync(pipelineMkPath, 'utf-8');
        const match = content.match(/SCALE\s*\?=\s*(\d+)/);
        if (match) return match[1];
      }
    } catch (e) {}
    return '1';
  }

  private getMongoStatus(): string {
    try {
      const output = execSync('docker compose -p linkedin ps mongodb --format json', { stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      if (output.includes('"State":"running"') || output.includes('"running"')) {
        return 'Connected (Active)';
      }
    } catch (e) {}
    return 'Disconnected or Not Running';
  }

  private dumpContext(conversationId: string, scale: string, mongoStatus: string): void {
    const dateStr = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST';
    const contextMemoryTemplate = `# 🧠 Workspace Context Memory Snapshot
- **Last Dumped Date**: ${dateStr}
- **Active Session ID**: ${conversationId}

## ⚙️ Active Configurations & Environments
- **Redis URL**: \`redis://redis:6379\` (기본값 설정 적용)
- **MongoDB Connection Status**: ${mongoStatus}
- **Scraper Instances (Scale)**: \`${scale}\`

## 📊 Site Specific States
- **LinkedIn Config**: 컬렉션: \`bronze/linkedin.jobs\`, 타겟: \`linkedin.jobs\`, 필터 키: \`jobId\`, 속도 제한: \`0초\`
- **GeekNews Config**: 컬렉션: \`bronze/geeknews.html\`, 타겟: \`geeknews.html\`, 필터 키: \`topicId\`, 속도 제한: \`3초\`
- **GPTERS Config**: 컬렉션: \`bronze/gpters.html\`, 타겟: \`gpters.html\`, 필터 키: \`postId\`, 속도 제한: \`3초\`
- **PyTorch KR Config**: 컬렉션: \`bronze/pytorch_kr.html\`, 타겟: \`pytorch_kr.html\`, 필터 키: \`topicId\`, 속도 제한: \`3초\`

## 🚨 Critical Constraints & Rate Limits
- 사용자 승인 없는 임의의 bash 명령어 실행 금지.
- 변경 작업 및 컨테이너 재시작 시 계획서(Plan) 수립 및 동의 절차 우선 진행.
- 파괴적인 MongoDB 명령어 실행 절대 금지.
- 마크다운 링크 및 코드 심볼 표기 시 상대 경로 규칙 강제 사용 (\`AGENTS.md\` Rule 5).
- 산출물(Artifact) 생성 시 \`.agents/brain/\` 내에 심볼릭 링크 자동 생성/업데이트 (\`AGENTS.md\` Rule 6).

## 🗺️ Execution Roadmap & Next Steps
- [x] 모듈화된 설정 구성 및 OOP 클래스를 적용하여 [ScraperWorker.ts](src/ScraperWorker.ts) 리팩토링 완료.
- [x] [AGENTS.md](AGENTS.md)에 클릭 가능한 상대 경로 마크다운 링크 제약 추가 완료.
- [x] Scraper 서비스 확장 실행이 가능하도록 [pipeline.mk](scripts/pipeline.mk) 구조 개선 완료.
- [x] [PlanningRule.md](.agents/PlanningRule.md) 및 [TranscriptRule.md](.agents/TranscriptRule.md) 영어 번역 완료.
- [x] [ContextMemoryDump.md](.agents/ContextMemoryDump.md) 규칙 정의 파일 구성 완료.
- [x] 스크립트 및 Make 툴링을 결합한 [generate_transcript.js](scripts/generate_transcript.js) 및 [generate_context.js](scripts/generate_context.js) 설계 완료.
`;

    const outputFilePath = path.join(__dirname, `../transcripts/${conversationId}/context_memory.md`);
    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });
    fs.writeFileSync(outputFilePath, contextMemoryTemplate, 'utf-8');
    console.log(`✨ Saved context memory dump: ${outputFilePath}`);
  }
}

const args = process.argv.slice(2);
const allMode = args.includes('--all') || args.includes('-a');

const dumper = new ContextDumper();
dumper.run(allMode);
