import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ROOT = '/Users/ejpark/workspace/scraper';
const DUMP_DIR = path.join(PROJECT_ROOT, 'data/agents/agy');
const OPENKB_DIR = path.join(PROJECT_ROOT, 'data/openkb');
const WIKI_DIR = path.join(PROJECT_ROOT, 'data/gitea-wiki');

function runCmd(cmd: string, cwd?: string) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'inherit' });
  } catch (error: any) {
    console.error(`❌ 명령어 실행 실패: ${cmd}`);
    process.exit(1);
  }
}

function runCmdOutput(cmd: string, cwd?: string): string {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return '';
  }
}

// 재귀적으로 특정 파일명을 찾아오는 헬퍼 함수
function findFiles(dir: string, fileName: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findFiles(fullPath, fileName));
    } else if (file === fileName) {
      results.push(fullPath);
    }
  });
  return results;
}

// 디렉토리 복사 헬퍼 함수
function copyDirSync(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  console.log('🤖 Starting Gitea Wiki & OpenKB Sync Pipeline...');

  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  Warning: GEMINI_API_KEY가 정의되어 있지 않습니다. 로컬 Fallback이 활성화되거나 OpenKB 컴파일이 실패할 수 있습니다.');
  }

  const rawStore = path.join(OPENKB_DIR, 'raw');
  fs.mkdirSync(rawStore, { recursive: true });

  // 모든 세션 폴더에서 transcript.md 검색 및 복사
  const transcripts = findFiles(DUMP_DIR, 'transcript.md');
  console.log(`📁 Copying raw dump session memory into OpenKB raw store (Found ${transcripts.length} files)...`);

  for (const file of transcripts) {
    const tagFolder = path.basename(path.dirname(file)); // 예: 0001-e6673877...
    const sessionUuid = tagFolder.replace(/^[0-9]+-/, ''); // UUID 추출
    const dateFolder = path.basename(path.dirname(path.dirname(file))); // 예: 2026-06-28T211048
    const targetName = `${dateFolder}_${sessionUuid}_transcript.md`;
    const destPath = path.join(rawStore, targetName);

    // 새 파일이거나 원본이 더 최근인 경우 복사
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

  // OpenKB 컴파일 실행 (Docker Compose 위임)
  console.log('🧠 Compiling knowledge via OpenKB inside Container (PageIndex)...');
  const rawContents = fs.readdirSync(rawStore);
  if (rawContents.length > 0) {
    runCmd('docker compose -p scraper run --rm openkb add /data/openkb/raw/');
  } else {
    console.log('   No raw logs found to compound.');
  }

  // 컴파일 완료된 위키 파일들을 Gitea Wiki 저장소로 동기화
  console.log('🔄 Synchronizing compiled concepts & summaries to Gitea Wiki...');
  fs.mkdirSync(WIKI_DIR, { recursive: true });

  const conceptsDir = path.join(OPENKB_DIR, 'wiki/concepts');
  if (fs.existsSync(conceptsDir)) {
    copyDirSync(conceptsDir, WIKI_DIR);
  }

  const summariesDir = path.join(OPENKB_DIR, 'wiki/summaries');
  if (fs.existsSync(summariesDir)) {
    copyDirSync(summariesDir, path.join(WIKI_DIR, 'summaries'));
  }

  // Gitea Wiki 원격 저장소에 Commit & Push
  console.log('📤 Pushing to Gitea Wiki remote...');
  runCmd('git config http.sslVerify false', WIKI_DIR);

  const status = runCmdOutput('git status --porcelain', WIKI_DIR);
  if (status) {
    runCmd('git add .', WIKI_DIR);
    const dateStr = new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
    runCmd(`git commit -m "chore: auto-compound agent session logs ${dateStr}"`, WIKI_DIR);
    runCmd('git push origin master', WIKI_DIR);
    console.log('✅ Gitea Wiki Remote synchronisation complete.');
  } else {
    console.log('   No changes detected in Wiki. Push skipped.');
  }

  console.log('🎉 Wiki & OpenKB Compounding Pipeline run finished.');
}

main();
