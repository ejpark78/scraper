/**
 * ==============================================================================
 * 🤖 Agent Knowledge Base Compounding & Wiki Synchronizer (sync-wiki.ts)
 * ==============================================================================
 * @description  에이전트 세션 로그 데이터를 획득하고 OpenKB 컨테이너를 통해
 *               의미론적 마크다운 지식으로 정제한 뒤, Gitea Wiki Git 저장소 및
 *               Obsidian 보관소에 Push/동기화합니다.
 * @constraints  SSL 인증서 에러 방지를 위해 git http.sslVerify=false 구동.
 *               Strict Typing 및 OOP Patterns 아키텍처 규칙을 상시 준수합니다.
 * @dependencies git CLI, docker compose, Node.js child_process
 * @lastUpdated  2026-06-29
 * ==============================================================================
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 위키 동기화 경로 및 환경변수를 래핑하는 Config 클래스
 */
class WikiConfig {
  public readonly projectRoot: string = '/Users/ejpark/workspace/scraper';
  public readonly dumpDir: string;
  public readonly openkbDir: string;
  public readonly wikiDir: string;
  public readonly geminiApiKey: string | undefined;

  constructor() {
    this.dumpDir = path.join(this.projectRoot, 'data/agents/agy');
    this.openkbDir = path.join(this.projectRoot, 'data/openkb');
    this.wikiDir = path.join(this.projectRoot, 'data/gitea-wiki');
    this.geminiApiKey = process.env.GEMINI_API_KEY;
  }
}

/**
 * 파일 유틸리티 및 탐색을 제공하는 FileService 클래스 (SRP 준수)
 */
class FileService {
  public findFiles(dir: string, fileName: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.findFiles(fullPath, fileName));
      } else if (file === fileName) {
        results.push(fullPath);
      }
    });
    return results;
  }

  public copyDirSync(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirSync(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

/**
 * 지식 가공 및 동기화를 담당하는 WikiSynchronizer 클래스
 */
class WikiSynchronizer {
  private config: WikiConfig;
  private files: FileService;

  constructor(config: WikiConfig, files: FileService) {
    this.config = config;
    this.files = files;
  }

  private runCmd(cmd: string, cwd?: string): void {
    try {
      execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'inherit' });
    } catch (error) {
      const err = error as Error;
      console.error(`❌ 명령어 실행 실패: ${cmd}`);
      console.error(err.message);
      process.exit(1);
    }
  }

  private runCmdOutput(cmd: string, cwd?: string): string {
    try {
      return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch {
      return '';
    }
  }

  public execute(): void {
    console.log('🤖 Starting Gitea Wiki & OpenKB Sync Pipeline...');

    if (!this.config.geminiApiKey) {
      console.warn('⚠️  Warning: GEMINI_API_KEY가 정의되어 있지 않습니다. 로컬 Fallback이 활성화되거나 OpenKB 컴파일이 실패할 수 있습니다.');
    }

    const rawStore = path.join(this.config.openkbDir, 'raw');
    fs.mkdirSync(rawStore, { recursive: true });

    // 1. transcript.md 복사
    const transcripts = this.files.findFiles(this.config.dumpDir, 'transcript.md');
    console.log(`📁 Copying raw dump session memory into OpenKB raw store (Found ${transcripts.length} files)...`);

    for (const file of transcripts) {
      const tagFolder = path.basename(path.dirname(file)); // 예: 0001-e6673877...
      const sessionUuid = tagFolder.replace(/^[0-9]+-/, ''); // UUID 추출
      const dateFolder = path.basename(path.dirname(path.dirname(file))); // 예: 2026-06-28T211048
      const targetName = `${dateFolder}_${sessionUuid}_transcript.md`;
      const destPath = path.join(rawStore, targetName);

      let shouldCopy = !fs.existsSync(destPath);
      if (!shouldCopy) {
        const srcStat = fs.statSync(file);
        const destStat = fs.statSync(destPath);
        shouldCopy = srcStat.mtimeMs > destStat.mtimeMs;
      }

      if (shouldCopy) {
        fs.copyFileSync(file, destPath);
        console.log(`   + Copied new/updated session transcript: ${targetName}`);
      }
    }

    // 2. OpenKB 컴파일 실행 (Docker)
    console.log('🧠 Compiling knowledge via OpenKB inside Container (PageIndex)...');
    const rawContents = fs.readdirSync(rawStore);
    if (rawContents.length > 0) {
      this.runCmd('docker compose -p scraper run --rm openkb add /data/openkb/raw/');
    } else {
      console.log('   No raw logs found to compound.');
    }

    // 3. 컴파일 완료 파일들 Gitea Wiki로 복사
    console.log('🔄 Synchronizing compiled concepts & summaries to Gitea Wiki...');
    fs.mkdirSync(this.config.wikiDir, { recursive: true });

    const conceptsDir = path.join(this.config.openkbDir, 'wiki/concepts');
    if (fs.existsSync(conceptsDir)) {
      this.files.copyDirSync(conceptsDir, this.config.wikiDir);
    }

    const summariesDir = path.join(this.config.openkbDir, 'wiki/summaries');
    if (fs.existsSync(summariesDir)) {
      this.files.copyDirSync(summariesDir, path.join(this.config.wikiDir, 'summaries'));
    }

    // 4. Git Push 동기화
    console.log('📤 Pushing to Gitea Wiki remote...');
    this.runCmd('git config http.sslVerify false', this.config.wikiDir);

    const status = this.runCmdOutput('git status --porcelain', this.config.wikiDir);
    if (status) {
      this.runCmd('git add .', this.config.wikiDir);
      const dateStr = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
      this.runCmd(`git commit -m "chore: auto-compound agent session logs ${dateStr}"`, this.config.wikiDir);
      this.runCmd('git push origin master', this.config.wikiDir);
      console.log('✅ Gitea Wiki Remote synchronisation complete.');
    } else {
      console.log('   No changes detected in Wiki. Push skipped.');
    }

    console.log('🎉 Wiki & OpenKB Compounding Pipeline run finished.');
  }
}

// Execution Entrypoint
const config = new WikiConfig();
const fileService = new FileService();
const synchronizer = new WikiSynchronizer(config, fileService);
synchronizer.execute();
