import * as fs from 'fs';
import * as path from 'path';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ==============================================================================
// 📋 Interfaces
// ==============================================================================

export interface WikiDocsChapter {
  title: string;
  url: string;
  content: string;
}

export interface WikiDocsBook {
  title: string;
  chapters: WikiDocsChapter[];
}

// ==============================================================================
// 📖 Class: MarkdownBookLoader (SRP: Local markdown book file loading)
// ==============================================================================

export class MarkdownBookLoader {
  /**
   * 로컬 디렉터리 경로에서 책 정보를 WikiDocsBook 구조로 빌드하고 마크다운 파일을 로드합니다.
   */
  public static loadBook(directoryPath: string): WikiDocsBook {
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
}

// ==============================================================================
// 📥 Class: JoplinCliService (Joplin CLI Interaction Service)
// ==============================================================================

export class JoplinCliService {
  private readonly profileDir: string;
  private readonly env: any;

  constructor(profileDir: string = '/app/data/.joplin_profile') {
    this.profileDir = profileDir;
    this.env = {
      ...process.env,
      HOME: this.profileDir,
      NODE_TLS_REJECT_UNAUTHORIZED: '0'
    };
  }

  /**
   * 자식 프로세스를 생성하여 CLI 출력을 스트리밍 형식으로 실행합니다.
   */
  private runCommandStream(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { env: this.env });

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

  /**
   * Joplin CLI에 서버 연동 자격 증명 설정을 반영합니다.
   */
  public async configureCredentials(
    serverUrl: string,
    username: string,
    password: string,
    decPassword?: string
  ): Promise<void> {
    if (!fs.existsSync(this.profileDir)) {
      fs.mkdirSync(this.profileDir, { recursive: true });
    }

    console.log(`[JoplinCliService] Configuring target sync server: ${serverUrl}`);
    await execAsync('joplin config sync.target 9', { env: this.env });
    await execAsync(`joplin config sync.9.path "${serverUrl.trim()}"`, { env: this.env });
    await execAsync(`joplin config sync.9.username "${username.trim()}"`, { env: this.env });
    await execAsync(`joplin config sync.9.password "${password.trim()}"`, { env: this.env });

    if (decPassword) {
      console.log('[JoplinCliService] Configuring E2EE decryption password...');
      await execAsync(`joplin encryption decrypt "${decPassword}"`, { env: this.env }).catch(err => {
        console.warn(`[Warning] Failed to set decryption password: ${err.message}`);
      });
    }
  }

  /**
   * Joplin Server 동기화(sync) 명령을 발송합니다.
   */
  public async sync(): Promise<void> {
    console.log('[JoplinCliService] Running sync...');
    await this.runCommandStream('joplin', ['sync']);
  }

  /**
   * Joplin 로컬 DB에 등록된 노트북 목록을 스캔하여 반환합니다.
   */
  public async getNotebooks(): Promise<string[]> {
    console.log('[JoplinCliService] Fetching local notebooks...');
    const { stdout } = await execAsync('joplin ls /', { env: this.env });
    const lines = stdout.split('\n');
    const notebooks: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let folderName = trimmed.split('(')[0].trim();
      if (folderName.endsWith('/')) {
        folderName = folderName.slice(0, -1).trim();
      }
      if (folderName && folderName !== '..' && folderName !== '.') {
        notebooks.push(folderName);
      }
    }
    return notebooks;
  }

  /**
   * 특정 노트북을 지정한 디렉터리에 마크다운 형태로 export합니다.
   */
  public async exportNotebook(notebookName: string, destDir: string): Promise<void> {
    await this.runCommandStream('joplin', ['export', '--format', 'md', '--notebook', notebookName, destDir]);
  }
}

// ==============================================================================
// 📤 Class: JoplinWebClipperService (Joplin Web Clipper API Client)
// ==============================================================================

export class JoplinWebClipperService {
  private readonly token: string;
  private readonly apiUrl: string;

  constructor(token: string, apiUrl: string = 'http://host.docker.internal:41184') {
    this.token = token;
    this.apiUrl = apiUrl;
  }

  private sanitizeFilename(filename: string): string {
    return filename.replace(/[\\/:*?"<>|]/g, '_');
  }

  /**
   * Joplin Web Clipper API를 호출해 새 폴더(노트북)를 생성합니다.
   */
  public async createFolder(title: string): Promise<{ id: string }> {
    const url = `${this.apiUrl}/folders?token=${encodeURIComponent(this.token)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: this.sanitizeFilename(title)
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`폴더 생성 실패: ${response.statusText}\n${errorText}`);
    }

    return (await response.json()) as { id: string };
  }

  /**
   * 지정된 폴더 하위에 새 마크다운 노트를 포스팅합니다.
   */
  public async createNote(title: string, content: string, parentId: string): Promise<void> {
    const url = `${this.apiUrl}/notes?token=${encodeURIComponent(this.token)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: this.sanitizeFilename(title),
        body: content,
        parent_id: parentId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`노트 생성 실패: ${response.statusText}\n${errorText}`);
    }
  }
}

// ==============================================================================
// 🚦 Class: JoplinTaskRunner (Application Controller)
// ==============================================================================

export class JoplinTaskRunner {
  private static sanitizeDir(dir: string): string {
    return dir.replace(/[\\/:*?"<>|]/g, '_');
  }

  /**
   * Joplin CLI 동기화 및 마크다운 내보내기 흐름을 제어합니다.
   */
  public async runSync(targetPath: string): Promise<void> {
    const serverUrl = process.env.JOPLIN_SERVER_URL;
    const username = process.env.JOPLIN_USERNAME;
    const password = process.env.JOPLIN_PASSWORD;
    const decPassword = process.env.JOPLIN_DEC_PASSWORD;

    if (!serverUrl || !username || !password) {
      throw new Error('Joplin CLI Sync를 기동하려면 JOPLIN_SERVER_URL, JOPLIN_USERNAME, JOPLIN_PASSWORD 환경변수가 필요합니다.');
    }

    const cliService = new JoplinCliService();
    await cliService.configureCredentials(serverUrl, username, password, decPassword);
    await cliService.sync();

    const notebooks = await cliService.getNotebooks();
    console.log(`[JoplinTaskRunner] Found ${notebooks.length} notebooks. Commencing export...`);

    const resolvedTargetDir = path.resolve(targetPath);
    for (let i = 0; i < notebooks.length; i++) {
      const notebook = notebooks[i];
      const progressPrefix = `[${i + 1}/${notebooks.length}]`;
      console.log(`${progressPrefix} Exporting notebook: "${notebook}"...`);

      const cleanFolderName = JoplinTaskRunner.sanitizeDir(notebook);
      const finalDir = path.join(resolvedTargetDir, cleanFolderName);
      const tempExportDir = path.join(resolvedTargetDir, '.tmp_export', cleanFolderName);

      try {
        if (fs.existsSync(tempExportDir)) {
          fs.rmSync(tempExportDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempExportDir, { recursive: true });

        await cliService.exportNotebook(notebook, tempExportDir);

        if (fs.existsSync(finalDir)) {
          fs.rmSync(finalDir, { recursive: true, force: true });
        }
        fs.mkdirSync(path.dirname(finalDir), { recursive: true });
        fs.renameSync(tempExportDir, finalDir);
        console.log(`${progressPrefix} Exported "${notebook}" successfully.`);
      } catch (err: any) {
        console.error(`${progressPrefix} Failed to export "${notebook}": ${err.message}`);
      }
    }

    // 임시 디렉터리 클린업
    const tempDirParent = path.join(resolvedTargetDir, '.tmp_export');
    if (fs.existsSync(tempDirParent)) {
      fs.rmSync(tempDirParent, { recursive: true, force: true });
    }

    console.log('[JoplinTaskRunner] CLI Sync and export completed.');
  }

  /**
   * 로컬 마크다운 문서를 Joplin Web Clipper API를 통해 푸시하는 흐름을 제어합니다.
   */
  public async runPush(fromPath: string, toPath?: string): Promise<void> {
    const token = process.env.JOPLIN_TOKEN;
    const apiUrl = process.env.JOPLIN_API_URL || 'http://host.docker.internal:41184';

    if (!token) {
      throw new Error('Joplin Web Clipper API로 push를 전송하려면 JOPLIN_TOKEN 환경변수가 제공되어야 합니다.');
    }

    console.log(`[JoplinTaskRunner] Scanning local markdown directories in: ${fromPath}`);
    const book = MarkdownBookLoader.loadBook(fromPath);
    const targetNotebookName = toPath || book.title;

    console.log(`[JoplinTaskRunner] Pushing book "${book.title}" to target notebook "${targetNotebookName}"...`);
    const apiService = new JoplinWebClipperService(token, apiUrl);
    
    let folder: { id: string };
    try {
      folder = await apiService.createFolder(targetNotebookName);
    } catch (err: any) {
      throw new Error(`Joplin 서버에 노트북 폴더를 생성하지 못했습니다: ${err.message}`);
    }

    console.log(`[JoplinTaskRunner] Folder created (ID: ${folder.id}). Starting node push loop...`);
    for (let i = 0; i < book.chapters.length; i++) {
      const chapter = book.chapters[i];
      const progressPrefix = `[${i + 1}/${book.chapters.length}]`;
      console.log(`${progressPrefix} Pushing node: "${chapter.title}"...`);

      try {
        await apiService.createNote(chapter.title, chapter.content, folder.id);
      } catch (err: any) {
        console.error(`${progressPrefix} Failed to push note "${chapter.title}": ${err.message}`);
      }
    }

    console.log('[JoplinTaskRunner] Web Clipper push task completed.');
  }
}

// ==============================================================================
// 🎬 System Execution Bootstrapper
// ==============================================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const runner = new JoplinTaskRunner();

  try {
    if (command === 'sync') {
      const targetPath = args[1] || 'data/joplin';
      await runner.runSync(targetPath);
    } else if (command === 'push') {
      const fromPath = args[1];
      const toPath = args[2];

      if (!fromPath) {
        console.error('Usage: npm run push -- <FROM_PATH> [TO_PATH]');
        process.exit(1);
      }
      await runner.runPush(fromPath, toPath);
    } else {
      console.error('알 수 없는 명령어입니다. 지원 명령어: sync, push');
      console.error('Usage: npm run sync -- [TARGET_PATH]');
      console.error('Usage: npm run push -- <FROM_PATH> [TO_PATH]');
      process.exit(1);
    }
  } catch (err: any) {
    console.error(`❌ 실행 실패: ${err.message}`);
    process.exit(1);
  }
}

main();
