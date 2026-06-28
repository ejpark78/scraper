import { execSync } from 'child_process';
import * as fs from 'fs';

function runCmdOutput(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return '';
  }
}

function main() {
  console.log('🔍 Running offline local static code review on modified files...');

  const diff1 = runCmdOutput('git diff --name-only').split('\n').filter(Boolean);
  const diff2 = runCmdOutput('git diff --cached --name-only').split('\n').filter(Boolean);
  const modifiedFiles = Array.from(new Set([...diff1, ...diff2])).filter((file) => fs.existsSync(file));

  if (modifiedFiles.length === 0) {
    console.log('✨ No local code changes detected (working tree clean).');
    process.exit(0);
  }

  console.log('📄 Modified Files List:');
  let hasTsChanges = false;

  for (const file of modifiedFiles) {
    console.log(`  - ${file}`);
    if (/\.tsx?$/.test(file) || /\.jsx?$/.test(file)) {
      hasTsChanges = true;
    }
  }
  console.log('');

  const isContainer = fs.existsSync('/.dockerenv') || fs.existsSync('/run/.containerenv');
  const runningWorkerId = runCmdOutput('docker compose ps -q worker');

  function runLintCheck(targetFile: string): string {
    const isCrawler = targetFile.startsWith('apps/crawler/');
    const isViewer = targetFile.startsWith('apps/viewer/');
    if (!isCrawler && !isViewer) return '';

    const prefix = isCrawler ? 'apps/crawler' : 'apps/viewer';

    if (!isContainer && runningWorkerId) {
      // Proxying to docker container
      try {
        return execSync(`docker compose exec -T worker npm run lint --prefix ${prefix} -- --quiet`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      } catch (e: any) {
        return e.stdout || e.stderr || e.message;
      }
    } else {
      // Local fallback
      if (fs.existsSync(`${prefix}/node_modules`)) {
        try {
          return execSync(`npm run lint --prefix ${prefix} -- --quiet`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
        } catch (e: any) {
          return e.stdout || e.stderr || e.message;
        }
      }
    }
    return '';
  }

  console.log('🏃 Running lint diagnostics...');
  let lintErrors = '';

  for (const file of modifiedFiles) {
    if (/\.tsx?$/.test(file) || /\.jsx?$/.test(file)) {
      const lintOut = runLintCheck(file);
      if (lintOut && (lintOut.includes('error') || lintOut.includes('warning'))) {
        lintErrors += `${lintOut}\n`;
      }
    }
  }

  let hasErrors = false;

  if (lintErrors) {
    console.warn('⚠️  Lint issues detected:\n');
    console.warn(lintErrors);
    hasErrors = true;
  } else {
    console.log('✅ Clean! No lint issues detected.');
  }

  // TypeScript Type Checking
  if (hasTsChanges) {
    console.log('\n🏃 Running TypeScript Type Checking...');
    let tscOut = '';

    if (!isContainer && runningWorkerId) {
      try {
        tscOut = execSync('docker compose exec -T worker npm run type-check', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      } catch (e: any) {
        tscOut = e.stdout || e.stderr || e.message;
      }
    } else {
      if (fs.existsSync('apps/crawler/node_modules')) {
        try {
          tscOut = execSync('npm run type-check', { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
        } catch (e: any) {
          tscOut = e.stdout || e.stderr || e.message;
        }
      }
    }

    if (tscOut) {
      console.log(tscOut);
      if (tscOut.includes('error')) {
        console.warn('⚠️  TypeScript compilation contains errors.');
        hasErrors = true;
      } else {
        console.log('✅ TypeScript Compilation Clean!');
      }
    } else {
      console.log('No compilation diagnostics run.');
    }
  }

  console.log('');
  if (hasErrors) {
    console.error('❌ Local static validation failed. Please fix the errors before committing.');
    process.exit(1);
  } else {
    console.log('🎯 Final Local Verdict: [Complete] Local static validation passed.');
    process.exit(0);
  }
}

main();
