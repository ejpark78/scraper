/**
 * ==============================================================================
 * 🌐 Gitea Wiki Synchronization and Deployment Service (update_wiki.ts)
 * ==============================================================================
 * @description  OpenKB로 정제된 concepts 및 summaries 문서들을
 *               gitea-wiki 저장소 및 Obsidian 보관소 경로로 복사하고 원격지에 push/동기화합니다.
 * @constraints  SSL 인증서 에러 방지를 위해 git http.sslVerify=false 구동.
 *               Strict Typing 및 OOP Patterns 아키텍처 규칙을 상시 준수합니다.
 * @dependencies Node.js runtime, fs, path, child_process
 * ==============================================================================
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

class WikiConfig {
  public readonly projectRoot: string = '/Users/ejpark/workspace/scraper';
  public readonly openkbDir: string;
  public readonly wikiDir: string;

  constructor() {
    this.openkbDir = path.join(this.projectRoot, 'data/openkb');
    this.wikiDir = path.join(this.projectRoot, 'data/gitea-wiki');
  }
}

class FileService {
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
      console.error(`❌ [WikiSync] 명령어 실행 실패: ${cmd}`);
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

  public sync(): void {
    console.log('🤖 Synchronizing compiled concepts & summaries to Gitea Wiki...');
    fs.mkdirSync(this.config.wikiDir, { recursive: true });

    const conceptsDir = path.join(this.config.openkbDir, 'wiki/concepts');
    if (fs.existsSync(conceptsDir)) {
      this.files.copyDirSync(conceptsDir, this.config.wikiDir);
    }

    const summariesDir = path.join(this.config.openkbDir, 'wiki/summaries');
    if (fs.existsSync(summariesDir)) {
      this.files.copyDirSync(summariesDir, path.join(this.config.wikiDir, 'summaries'));
    }

    // Git Push 동기화 진행
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

    console.log('🎉 Wiki Deployment and Synchronization Pipeline finished.');
  }
}

// Execute
const config = new WikiConfig();
const files = new FileService();
const synchronizer = new WikiSynchronizer(config, files);
synchronizer.sync();
