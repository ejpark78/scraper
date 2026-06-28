import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Argument parsing
const args = process.argv.slice(2);
const autoMerge = !args.includes('--no-merge');

function runCmd(cmd: string, ignoreError = false): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error: any) {
    if (ignoreError) {
      return '';
    }
    console.error(`❌ 명령어 실행 실패: ${cmd}`);
    console.error(error.stderr || error.message);
    process.exit(1);
  }
}

function showFileDiff(file: string, status: string) {
  const absPath = path.resolve(process.cwd(), file);
  let action = 'Edit';
  if (status === 'A') action = 'Create';
  if (status === 'D') action = 'Delete';

  console.log(`● ${action}(${absPath})`);

  // Calculate added/deleted lines using numstat
  const numstat = runCmd(`git diff --cached --numstat -- "${file}"`, true);
  if (!numstat) {
    console.log(`  ⎿  +0 / -0 lines`);
    return;
  }

  const [addedStr, deletedStr] = numstat.split(/\s+/);
  const isBinary = addedStr === '-' || deletedStr === '-';
  const added = isBinary ? 0 : parseInt(addedStr, 10) || 0;
  const deleted = isBinary ? 0 : parseInt(deletedStr, 10) || 0;

  console.log(`  ⎿  +${added} / -${deleted} lines`);

  if (isBinary) {
    console.log(`       [Binary file]\n`);
    return;
  }

  // Parse diff output
  const diffOutput = runCmd(`git diff --cached -U3 -- "${file}"`, true);
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

function main() {
  const statusPorcelain = runCmd('git status --porcelain', true);
  const branchName = runCmd('git rev-parse --abbrev-ref HEAD');

  if (branchName === 'main') {
    console.error('❌ ERROR: Direct commit to \'main\' branch is strictly prohibited by Git Flow guidelines.');
    console.error('   Please create or checkout a feature or develop branch first.');
    process.exit(1);
  }

  if (statusPorcelain) {
    // Run AI Code Review if exists
    if (fs.existsSync('.agents/scripts/review-changes.sh')) {
      console.log('🤖 Running AI Code Review Check...');
      try {
        execSync('bash .agents/scripts/review-changes.sh', { stdio: 'inherit' });
      } catch (e) {
        console.log('⚠️ AI Review check script failed to run. Proceeding with commit...');
      }
    }

    console.log('🔍 Running static verification tests...');
    const stagedFiles = statusPorcelain.split('\n').map(l => l.substring(3).trim()).filter(Boolean);

    let runCrawler = false;
    let runViewer = false;
    let runEbook = false;

    for (const file of stagedFiles) {
      if (file.startsWith('apps/crawler/')) runCrawler = true;
      else if (file.startsWith('apps/viewer/')) runViewer = true;
      else if (file.startsWith('apps/ebook/')) runEbook = true;
    }

    // Crawler validation
    if (runCrawler && fs.existsSync('apps/crawler/scripts/lint.sh')) {
      console.log('🏃 Executing apps/crawler/scripts/lint.sh...');
      try {
        execSync('./apps/crawler/scripts/lint.sh', { stdio: 'inherit' });
      } catch (e) {
        console.error('❌ ERROR: Crawler static check failed!');
        process.exit(1);
      }
    }

    // Viewer validation
    if (runViewer && fs.existsSync('apps/viewer/scripts/lint.sh')) {
      console.log('🏃 Executing apps/viewer/scripts/lint.sh...');
      try {
        execSync('./apps/viewer/scripts/lint.sh', { stdio: 'inherit' });
      } catch (e) {
        console.error('❌ ERROR: Viewer static check failed!');
        process.exit(1);
      }
    }

    // Ebook validation
    if (runEbook && fs.existsSync('apps/ebook/scripts/lint.sh')) {
      console.log('🏃 Executing apps/ebook/scripts/lint.sh...');
      try {
        execSync('./apps/ebook/scripts/lint.sh', { stdio: 'inherit' });
      } catch (e) {
        console.error('❌ ERROR: Ebook static check failed!');
        process.exit(1);
      }
    }

    console.log('🔄 Detecting modifications...');
    runCmd('git add .');

    // Display diff summary
    const diffSummary = runCmd('git diff --cached --name-status');
    if (diffSummary) {
      diffSummary.split('\n').filter(Boolean).forEach((line) => {
        const [status, file] = line.split(/\s+/);
        showFileDiff(file, status);
      });
    }

    // Compose commit message
    let msg = '';
    const featureMatch = branchName.match(/^feature\/([0-9]{3})-(.+)$/);
    const hotfixMatch = branchName.match(/^hotfix\/([0-9]{3})-(.+)$/);

    if (featureMatch) {
      const num = featureMatch[1];
      const desc = featureMatch[2].replace(/-/g, ' ');
      msg = `feat(${num}): ${desc}`;
    } else if (hotfixMatch) {
      const num = hotfixMatch[1];
      const desc = hotfixMatch[2].replace(/-/g, ' ');
      msg = `fix(${num}): ${desc}`;
    }

    if (!msg) {
      msg = 'chore: commit changes';
      const allStaged = runCmd('git diff --cached --name-only');
      if (allStaged.includes('AGENTS.md') || allStaged.includes('.agents/rules/')) {
        msg = 'docs: update agent rules';
      } else if (allStaged.includes('src/crawler/workers/ConverterWorker.ts')) {
        msg = 'feat(crawler): retain original image URLs and append collected metadata';
      } else if (allStaged.includes('src/')) {
        msg = 'feat: update scraper/converter implementation';
      }
    }

    runCmd(`git commit -m "${msg}"`);
    console.log(`✅ Committed: ${msg}`);

    if (autoMerge && branchName !== 'develop' && branchName !== 'main') {
      console.log('🔀 Auto-merge option detected. Transitioning to develop...');
      try {
        runCmd('git checkout develop');
        runCmd(`git merge "${branchName}"`);
        console.log(`✅ Successfully merged ${branchName} into develop branch.`);
      } catch (e: any) {
        console.error('❌ ERROR: Merge conflict detected! Please resolve conflicts manually.');
        process.exit(1);
      }
    }
  } else {
    console.log('✨ No changes to commit.');

    if (autoMerge && branchName !== 'develop' && branchName !== 'main') {
      console.log('🔀 Auto-merge option detected (No changes). Transitioning to develop...');
      try {
        runCmd('git checkout develop');
        runCmd(`git merge "${branchName}"`);
        console.log(`✅ Successfully merged ${branchName} into develop branch.`);
      } catch (e: any) {
        console.error('❌ ERROR: Merge conflict detected!');
        process.exit(1);
      }
    }
  }
}

main();
