import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ==============================================================================
// 📋 Interfaces & Configuration
// ==============================================================================

interface WikiDocsChapter {
  title: string;
  url: string;
  content: string;
}

interface WikiDocsBook {
  title: string;
  chapters: WikiDocsChapter[];
}

const JOPLIN_PROFILE_DIR = '/app/data/.joplin_profile';

const joplinEnv = {
  ...process.env,
  HOME: JOPLIN_PROFILE_DIR,
  NODE_TLS_REJECT_UNAUTHORIZED: '0'
};

// ==============================================================================
// 🛠️ Utility Functions
// ==============================================================================

function sanitizeFilename(filename: string): string {
  return filename.replace(/[\\/:*?"<>|]/g, '_');
}

function runCommandStream(
  command: string,
  args: string[],
  env: any
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { env });

    proc.stdout.on('data', (data) => {
      process.stdout.write(data.toString());
    });

    proc.stderr.on('data', (data) => {
      process.stderr.write(data.toString());
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command "${command} ${args.join(' ')}" failed with exit code ${code}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

function loadBookFromDirectory(directoryPath: string): WikiDocsBook {
  if (!fs.existsSync(directoryPath)) {
    throw new Error(`디렉터리가 존재하지 않습니다: ${directoryPath}`);
  }

  const stat = fs.statSync(directoryPath);
  if (!stat.isDirectory()) {
    throw new Error(`디렉터리 경로가 아닙니다: ${directoryPath}`);
  }

  const bookTitle = path.basename(directoryPath);
  const files = fs.readdirSync(directoryPath);

  // .md 파일 필터링 (INDEX.md나 임시 파일 제외)
  const allMdFiles = files.filter(file => {
    const ext = path.extname(file).toLowerCase();
    const name = path.basename(file, ext).toUpperCase();
    return ext === '.md' && name !== 'INDEX' && name !== 'README';
  });

  // 번역본 파일(.en-ko.md)이 있으면 원본(.md)은 배제
  const hasEnKo = new Set<string>();
  for (const file of allMdFiles) {
    if (file.toLowerCase().endsWith('.en-ko.md')) {
      const base = file.slice(0, -'.en-ko.md'.length).toLowerCase();
      hasEnKo.add(base);
    }
  }

  const mdFiles = allMdFiles.filter(file => {
    if (file.toLowerCase().endsWith('.en-ko.md')) {
      return true;
    }
    const ext = path.extname(file);
    const base = file.slice(0, -ext.length).toLowerCase();
    if (hasEnKo.has(base)) {
      return false;
    }
    return true;
  });

  mdFiles.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const chapters: WikiDocsChapter[] = [];
  for (const file of mdFiles) {
    const filePath = path.join(directoryPath, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const title = path.basename(file, path.extname(file));

    chapters.push({
      title,
      url: `file://${filePath}`,
      content
    });
  }

  return {
    title: bookTitle,
    chapters
  };
}

// ==============================================================================
// 📥 Sync Command Implementation
// ==============================================================================

async function handleSync(targetPath: string): Promise<void> {
  const serverUrl = process.env.JOPLIN_SERVER_URL;
  const username = process.env.JOPLIN_USERNAME;
  const password = process.env.JOPLIN_PASSWORD;
  const decPassword = process.env.JOPLIN_DEC_PASSWORD;

  if (!serverUrl || !username || !password) {
    throw new Error('Joplin CLI Sync를 기동하려면 JOPLIN_SERVER_URL, JOPLIN_USERNAME, JOPLIN_PASSWORD 환경변수가 필요합니다.');
  }

  if (!fs.existsSync(JOPLIN_PROFILE_DIR)) {
    fs.mkdirSync(JOPLIN_PROFILE_DIR, { recursive: true });
  }

  console.log(`[Joplin Sync] Configuring Joplin CLI sync target: ${serverUrl}`);
  await execAsync('joplin config sync.target 9', { env: joplinEnv });
  await execAsync(`joplin config sync.9.path "${serverUrl.trim()}"`, { env: joplinEnv });
  await execAsync(`joplin config sync.9.username "${username.trim()}"`, { env: joplinEnv });
  await execAsync(`joplin config sync.9.password "${password.trim()}"`, { env: joplinEnv });

  if (decPassword) {
    console.log('[Joplin Sync] Setting decryption password...');
    await execAsync(`joplin encryption decrypt "${decPassword}"`, { env: joplinEnv }).catch(err => {
      console.warn(`[Warning] Encryption decryption configuration warning: ${err.message}`);
    });
  }

  console.log('[Joplin Sync] Initiating Joplin server sync...');
  await runCommandStream('joplin', ['sync'], joplinEnv);

  console.log('[Joplin Sync] Sync completed. Loading local notebooks list...');
  const { stdout: lsStdout } = await execAsync('joplin ls /', { env: joplinEnv });
  const lines = lsStdout.split('\n');
  const notebooksToExport: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let folderName = trimmed.split('(')[0].trim();
    if (folderName.endsWith('/')) {
      folderName = folderName.slice(0, -1).trim();
    }
    if (folderName && folderName !== '..' && folderName !== '.') {
      notebooksToExport.push(folderName);
    }
  }

  console.log(`[Joplin Sync] Found ${notebooksToExport.length} notebooks. Exporting to ${targetPath}...`);
  const resolvedTargetDir = path.resolve(targetPath);

  for (let i = 0; i < notebooksToExport.length; i++) {
    const folderName = notebooksToExport[i];
    const progressPrefix = `[${i + 1}/${notebooksToExport.length}]`;
    console.log(`${progressPrefix} Exporting "${folderName}"...`);

    const cleanFolderName = sanitizeFilename(folderName);
    const finalDir = path.join(resolvedTargetDir, cleanFolderName);
    const tempExportDir = path.join(resolvedTargetDir, '.tmp_export', cleanFolderName);

    try {
      if (fs.existsSync(tempExportDir)) {
        fs.rmSync(tempExportDir, { recursive: true, force: true });
      }
      fs.mkdirSync(tempExportDir, { recursive: true });

      await runCommandStream(
        'joplin',
        ['export', '--format', 'md', '--notebook', folderName, tempExportDir],
        joplinEnv
      );

      if (fs.existsSync(finalDir)) {
        fs.rmSync(finalDir, { recursive: true, force: true });
      }
      fs.mkdirSync(path.dirname(finalDir), { recursive: true });
      fs.renameSync(tempExportDir, finalDir);
      console.log(`${progressPrefix} Exported "${folderName}" successfully.`);
    } catch (err: any) {
      console.error(`${progressPrefix} Failed to export "${folderName}": ${err.message}`);
    }
  }

  // 임시 폴더 정리
  const tempDirParent = path.join(resolvedTargetDir, '.tmp_export');
  if (fs.existsSync(tempDirParent)) {
    fs.rmSync(tempDirParent, { recursive: true, force: true });
  }

  console.log('[Joplin Sync] All notebooks exported successfully.');
}

// ==============================================================================
// 📤 Push Command Implementation (Web Clipper API)
// ==============================================================================

async function createBookFolder(title: string, token: string, apiUrl: string): Promise<{ id: string }> {
  const response = await fetch(`${apiUrl}/folders?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: sanitizeFilename(title)
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`폴더 생성 실패: ${response.statusText}\n${errorText}`);
  }

  return (await response.json()) as { id: string };
}

async function createNote(
  title: string,
  content: string,
  parentId: string,
  token: string,
  apiUrl: string
): Promise<void> {
  const response = await fetch(`${apiUrl}/notes?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: sanitizeFilename(title),
      body: content,
      parent_id: parentId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`노트 생성 실패: ${response.statusText}\n${errorText}`);
  }
}

async function handlePush(fromPath: string, toPath: string): Promise<void> {
  const token = process.env.JOPLIN_TOKEN;
  const apiUrl = process.env.JOPLIN_API_URL || 'http://host.docker.internal:41184';

  if (!token) {
    throw new Error('Joplin Web Clipper API로 push를 전송하려면 JOPLIN_TOKEN 환경변수가 제공되어야 합니다.');
  }

  console.log(`[Joplin Push] Reading local book from: ${fromPath}`);
  const book = loadBookFromDirectory(fromPath);
  
  // TO_PATH가 제공되면 책 제목 대신 TO_PATH를 폴더(노트북)명으로 사용합니다.
  const targetFolderName = toPath || book.title;
  console.log(`[Joplin Push] Targeting notebook "${targetFolderName}" via Web Clipper API: ${apiUrl}`);

  let bookFolder: { id: string };
  try {
    bookFolder = await createBookFolder(targetFolderName, token, apiUrl);
  } catch (error: any) {
    throw new Error(`Joplin에 연결하여 노트북을 생성할 수 없습니다: ${error.message}`);
  }

  console.log(`[Joplin Push] Notebook created (ID: ${bookFolder.id}). Pushing ${book.chapters.length} chapters...`);

  for (let i = 0; i < book.chapters.length; i++) {
    const chapter = book.chapters[i];
    const progressPrefix = `[${i + 1}/${book.chapters.length}]`;
    console.log(`${progressPrefix} Pushing note: "${chapter.title}"...`);

    try {
      await createNote(
        chapter.title,
        chapter.content,
        bookFolder.id,
        token,
        apiUrl
      );
    } catch (err: any) {
      console.error(`${progressPrefix} Failed to push note "${chapter.title}": ${err.message}`);
    }
  }

  console.log('[Joplin Push] Push completed successfully.');
}

// ==============================================================================
// 🚦 Main Entry Point
// ==============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  try {
    if (command === 'sync') {
      // sync [TARGET_PATH]
      // 예: npx ts-node src/index.ts sync data/joplin
      const targetPath = args[1] || 'data/joplin';
      await handleSync(targetPath);
    } else if (command === 'push') {
      // push [FROM_PATH] [TO_PATH]
      // 예: npx ts-node src/index.ts push data/joplin/books/abc books/abc
      const fromPath = args[1];
      const toPath = args[2];

      if (!fromPath) {
        console.error('Usage: npm run push -- <FROM_PATH> [TO_PATH]');
        process.exit(1);
      }
      await handlePush(fromPath, toPath);
    } else {
      console.error('알 수 없는 명령어입니다. 지원 명령어: sync, push');
      console.error('Usage: npm run sync -- [TARGET_PATH]');
      console.error('Usage: npm run push -- <FROM_PATH> [TO_PATH]');
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`❌ 에러 발생: ${err.message}`);
    process.exit(1);
  }
}

main();
