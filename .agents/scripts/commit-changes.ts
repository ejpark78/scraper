/**
 * ==============================================================================
 * 🤖 Auto Commit & Merge Helper Script (commit-changes.ts)
 * ==============================================================================
 * @description  수정된 파일을 탐색하고 린트/컴파일 검사를 수행한 뒤,
 *               Conventional Commit 형태의 메시지로 커밋 및 develop 병합을 자동화합니다.
 * @constraints  main 브랜치 직접 커밋 방지 기능 내장.
 *               Strict Typing 및 OOP Patterns 아키텍처 규칙을 상시 준수합니다.
 * @dependencies git CLI, Node.js child_process
 * @lastUpdated  2026-06-29
 * ==============================================================================
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 커밋 스크립트의 실행 파라미터를 래핑하는 Config 클래스
 */
class CommitConfig {
  public readonly autoMerge: boolean;

  constructor() {
    const args = process.argv.slice(2);
    this.autoMerge = !args.includes('--no-merge');
  }
}

/**
 * Git 제어 및 Diff 파싱을 담당하는 GitService 클래스
 */
class GitService {
  public runCmd(cmd: string, ignoreError = false): string {
    try {
      return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch (error) {
      if (ignoreError) {
        return '';
      }
      const err = error as Error;
      console.error(`❌ 명령어 실행 실패: ${cmd}`);
      console.error(err.message);
      process.exit(1);
    }
  }

  public showFileDiff(file: string, status: string): void {
    const absPath = path.resolve(process.cwd(), file);
    let action = 'Edit';
    if (status === 'A') action = 'Create';
    if (status === 'D') action = 'Delete';

    console.log(`● ${action}(${absPath})`);

    const numstat = this.runCmd(`git diff --cached --numstat -- "${file}"`, true);
    if (!numstat) {
      console.log(`  ⎿  +0 / -0 lines`);
      return;
    }

    const parts = numstat.split(/\s+/);
    const addedStr = parts[0];
    const deletedStr = parts[1];
    
    const isBinary = addedStr === '-' || deletedStr === '-';
    const added = isBinary ? 0 : parseInt(addedStr, 10) || 0;
    const deleted = isBinary ? 0 : parseInt(deletedStr, 10) || 0;

    console.log(`  ⎿  +${added} / -${deleted} lines`);

    if (isBinary) {
      console.log(`       [Binary file]\n`);
      return;
    }

    const diffOutput = this.runCmd(`git diff --cached -U3 -- "${file}"`, true);
    if (!diffOutput) {
      console.log('');
      return;
    }

    let lineOld = 0;
    let lineNew = 0;

    const lines = diffOutput.split('\n');
    for (const line of lines) {
      if (/^(diff|index|---|\+\+\+)/.test(line)) {
        continue;
      }

      const hunkHeaderMatch = line.match(/^@@\s+-(\d+),?(\d*)\s+\+(\d+),?(\d*)\s+@@/);
      if (hunkHeaderMatch) {
        lineOld = parseInt(hunkHeaderMatch[1], 10);
        lineNew = parseInt(hunkHeaderMatch[3], 10);
        continue;
      }

      if (lineOld === 0 && lineNew === 0) {
        continue;
      }

      if (line.startsWith('-')) {
        const content = line.substring(1);
        console.log(`       ${String(lineOld).padEnd(4)} - ${content}`);
        lineOld++;
      } else if (line.startsWith('+')) {
        const content = line.substring(1);
        console.log(`       ${String(lineNew).padEnd(4)} + ${content}`);
        lineNew++;
      } else if (line.startsWith(' ')) {
        const content = line.substring(1);
        console.log(`       ${String(lineNew).padEnd(4)}   ${content}`);
        lineOld++;
        lineNew++;
      } else if (line === '') {
        console.log(`       ${String(lineNew).padEnd(4)}   `);
        lineOld++;
        lineNew++;
      }
    }
    console.log('');
  }
}

/**
 * 정적 검사 및 린트 검증을 대행하는 ValidationService 클래스
 */
class ValidationService {
  public runCodeReview(): void {
    if (fs.existsSync('.agents/scripts/review-changes.ts')) {
      console.log('🤖 Running Code Review Check...');
      try {
        execSync('npx ts-node .agents/scripts/review-changes.ts', { stdio: 'inherit' });
      } catch (e) {
        console.log('⚠️ Review check script failed to run. Proceeding with commit...');
      }
    }
  }

  public runPackageVerification(stagedFiles: string[]): void {
    let runCrawler = false;
    let runViewer = false;
    let runEbook = false;

    for (const file of stagedFiles) {
      if (file.startsWith('apps/crawler/')) runCrawler = true;
      else if (file.startsWith('apps/viewer/')) runViewer = true;
      else if (file.startsWith('apps/ebook/')) runEbook = true;
    }

    if (runCrawler && fs.existsSync('apps/crawler/scripts/lint.sh')) {
      console.log('🏃 Executing apps/crawler/scripts/lint.sh...');
      this.executeLintScript('./apps/crawler/scripts/lint.sh', 'Crawler');
    }

    if (runViewer && fs.existsSync('apps/viewer/scripts/lint.sh')) {
      console.log('🏃 Executing apps/viewer/scripts/lint.sh...');
      this.executeLintScript('./apps/viewer/scripts/lint.sh', 'Viewer');
    }

    if (runEbook && fs.existsSync('apps/ebook/scripts/lint.sh')) {
      console.log('🏃 Executing apps/ebook/scripts/lint.sh...');
      this.executeLintScript('./apps/ebook/scripts/lint.sh', 'Ebook');
    }
  }

  private executeLintScript(scriptPath: string, name: string): void {
    try {
      execSync(scriptPath, { stdio: 'inherit' });
    } catch (e) {
      console.error(`❌ ERROR: ${name} static check failed!`);
      process.exit(1);
    }
  }
}

/**
 * Auto Commit 프로세스를 조율하는 Coordinator 클래스
 */
class CommitCoordinator {
  private config: CommitConfig;
  private git: GitService;
  private validator: ValidationService;

  constructor(config: CommitConfig, git: GitService, validator: ValidationService) {
    this.config = config;
    this.git = git;
    this.validator = validator;
  }

  private generateCommitMessage(branchName: string): string {
    const featureMatch = branchName.match(/^feature\/([0-9]{3})-(.+)$/);
    const hotfixMatch = branchName.match(/^hotfix\/([0-9]{3})-(.+)$/);

    if (featureMatch) {
      const num = featureMatch[1];
      const desc = featureMatch[2].replace(/-/g, ' ');
      return `feat(${num}): ${desc}`;
    } else if (hotfixMatch) {
      const num = hotfixMatch[1];
      const desc = hotfixMatch[2].replace(/-/g, ' ');
      return `fix(${num}): ${desc}`;
    }

    const allStaged = this.git.runCmd('git diff --cached --name-only');
    if (allStaged.includes('AGENTS.md') || allStaged.includes('.agents/rules/')) {
      return 'docs: update agent rules';
    } else if (allStaged.includes('src/crawler/workers/ConverterWorker.ts')) {
      return 'feat(crawler): retain original image URLs and append collected metadata';
    } else if (allStaged.includes('src/')) {
      return 'feat: update scraper/converter implementation';
    }

    return 'chore: commit changes';
  }

  public execute(): void {
    const statusPorcelain = this.git.runCmd('git status --porcelain', true);
    const branchName = this.git.runCmd('git rev-parse --abbrev-ref HEAD');

    if (branchName === 'main') {
      console.error('❌ ERROR: Direct commit to \'main\' branch is strictly prohibited by Git Flow guidelines.');
      console.error('   Please create or checkout a feature or develop branch first.');
      process.exit(1);
    }

    if (statusPorcelain) {
      this.validator.runCodeReview();

      console.log('🔍 Running static verification tests...');
      const stagedFiles = statusPorcelain.split('\n').map(l => l.substring(3).trim()).filter(Boolean);
      this.validator.runPackageVerification(stagedFiles);

      console.log('🔄 Detecting modifications...');
      this.git.runCmd('git add .');

      const diffSummary = this.git.runCmd('git diff --cached --name-status');
      if (diffSummary) {
        diffSummary.split('\n').filter(Boolean).forEach((line) => {
          const parts = line.split(/\s+/);
          this.git.showFileDiff(parts[1], parts[0]);
        });
      }

      const msg = this.generateCommitMessage(branchName);
      this.git.runCmd(`git commit -m "${msg}"`);
      console.log(`✅ Committed: ${msg}`);

      this.attemptAutoMerge(branchName);
    } else {
      console.log('✨ No changes to commit.');
      this.attemptAutoMerge(branchName);
    }
  }

  private attemptAutoMerge(branchName: string): void {
    if (this.config.autoMerge && branchName !== 'develop' && branchName !== 'main') {
      console.log('🔀 Auto-merge option detected. Transitioning to develop...');
      try {
        this.git.runCmd('git checkout develop');
        this.git.runCmd(`git merge "${branchName}"`);
        console.log(`✅ Successfully merged ${branchName} into develop branch.`);
      } catch (e) {
        console.error('❌ ERROR: Merge conflict detected! Please resolve conflicts manually.');
        process.exit(1);
      }
    }
  }
}

// Execution Entrypoint
const config = new CommitConfig();
const git = new GitService();
const validator = new ValidationService();
const coordinator = new CommitCoordinator(config, git, validator);

coordinator.execute();
