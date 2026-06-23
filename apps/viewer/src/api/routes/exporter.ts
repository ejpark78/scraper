/**
 * @module exporterRoute
 * @description Express Router handling Joplin/Obsidian document exporting.
 * @constraints
 *   - Strictly typed request and response parameters.
 *   - Proper error handling and input validation.
 * @dependencies express, path, fileLoader, joplin, obsidian
 */

import { Router, Request, Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { listAvailableBooks, loadBookFromDirectory } from '../../exporter/utils/fileLoader';
import { exportToJoplin } from '../../exporter/export/joplin';
import { exportToObsidian } from '../../exporter/export/obsidian';
import type { ExportOptions } from '../../exporter/types';

const router = Router();

// 기본 책 저장 디렉토리 경로 (Docker 환경의 /app/data/ebook/output 및 로컬 개발용 fallback)
const DEFAULT_BOOKS_DIR = '/app/data/ebook/output';
const LOCAL_BOOKS_DIR = path.resolve(__dirname, '../../../../../data/ebook/output');

function getBooksDirectory(): string {
  if (fs.existsSync(DEFAULT_BOOKS_DIR)) {
    return DEFAULT_BOOKS_DIR;
  }
  return LOCAL_BOOKS_DIR;
}

/**
 * GET /api/exporter/books
 * 사용 가능한 책 목록(폴더명 목록)을 반환합니다.
 */
router.get('/books', (req: Request, res: Response) => {
  try {
    const booksDir = getBooksDirectory();
    console.log(`[Exporter API] Scanning books directory: ${booksDir}`);
    const books = listAvailableBooks(booksDir);
    res.json(books);
  } catch (error: any) {
    console.error('[Exporter API] Failed to list books:', error);
    res.status(500).json({ error: error.message || 'Failed to list available books' });
  }
});

/**
 * POST /api/exporter/export
 * 서적 데이터를 대상 플랫폼(Joplin/Obsidian)으로 내보내기를 수행합니다.
 */
router.post('/export', async (req: Request, res: Response) => {
  try {
    const { target, pathName, token, key } = req.body;

    if (!target || !['joplin', 'obsidian'].includes(target)) {
      return res.status(400).json({ error: '올바른 target 값을 지정해주세요. (joplin 또는 obsidian)' });
    }

    if (!pathName) {
      return res.status(400).json({ error: '내보낼 서적 폴더명(pathName)을 입력해주세요.' });
    }

    const booksDir = getBooksDirectory();
    // 상위 디렉토리 참조 공격 방지
    const sanitizedPathName = path.basename(pathName);
    const resolvedPath = path.join(booksDir, sanitizedPathName);

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: `해당 서적 폴더가 존재하지 않습니다: ${sanitizedPathName}` });
    }

    console.log(`[Exporter API] Loading book from: ${resolvedPath}`);
    const book = loadBookFromDirectory(resolvedPath);

    const options: ExportOptions = {
      target: target as 'joplin' | 'obsidian',
      includeImages: false,
      addFrontmatter: false,
      createIndex: false,
    };

    if (target === 'joplin') {
      if (!token) {
        return res.status(400).json({ error: 'Joplin으로 내보내려면 API 토큰이 필요합니다.' });
      }
      const { apiUrl } = req.body;
      const finalApiUrl = resolveJoplinUrl(apiUrl);
      console.log(`[Exporter API] Starting export to Joplin for: "${book.title}" on URL: ${finalApiUrl}`);
      await exportToJoplin(book, options, token, finalApiUrl);
    } else {
      if (!key) {
        return res.status(400).json({ error: 'Obsidian으로 내보내려면 API 키가 필요합니다.' });
      }
      console.log(`[Exporter API] Starting export to Obsidian for: "${book.title}"`);
      await exportToObsidian(book, options, key);
    }

    res.json({ success: true, message: `"${book.title}" 서적 내보내기를 완료했습니다.` });
  } catch (error: any) {
    console.error('[Exporter API] Export processing failed:', error);
    res.status(500).json({ error: error.message || '내보내기 수행 도중 에러가 발생했습니다.' });
  }
});

// 루프백 로컬 호스트 주소를 도커 백엔드 내부 연동용 가상 도메인으로 치환하는 헬퍼 함수
function resolveJoplinUrl(url?: string): string {
  if (!url) return 'http://host.docker.internal:41184';
  let resolved = url.trim();
  if (resolved.includes('127.0.0.1')) {
    resolved = resolved.replace('127.0.0.1', 'host.docker.internal');
  } else if (resolved.includes('localhost')) {
    resolved = resolved.replace('localhost', 'host.docker.internal');
  }
  return resolved;
}

/**
 * POST /api/exporter/joplin/folders
 * Joplin 연결 설정(URL, Token)을 확인하고 폴더(노트북) 목록을 반환합니다.
 */
router.post('/joplin/folders', async (req: Request, res: Response) => {
  try {
    const { apiUrl, token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'Joplin 토큰이 제공되지 않았습니다.' });
    }
    const resolvedUrl = resolveJoplinUrl(apiUrl);
    console.log(`[Importer API] Fetching folders from Joplin: ${resolvedUrl}`);
    const joplinRes = await fetch(`${resolvedUrl}/folders?token=${encodeURIComponent(token)}`);
    if (!joplinRes.ok) {
      const errText = await joplinRes.text();
      return res.status(joplinRes.status).json({ error: `Joplin 연결 실패: ${errText}` });
    }
    const folders = await joplinRes.json();
    res.json(folders);
  } catch (error: any) {
    console.error('[Importer API] Failed to fetch folders:', error);
    res.status(500).json({ error: error.message || 'Joplin 폴더를 조회하는 중 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/exporter/joplin/notes
 * 특정 폴더(노트북) ID 내의 모든 노트 목록을 가져옵니다.
 */
router.post('/joplin/notes', async (req: Request, res: Response) => {
  try {
    const { apiUrl, token, folderId } = req.body;
    if (!token || !folderId) {
      return res.status(400).json({ error: '토큰 및 폴더 ID가 제공되지 않았습니다.' });
    }
    const resolvedUrl = resolveJoplinUrl(apiUrl);
    const joplinRes = await fetch(`${resolvedUrl}/folders/${folderId}/notes?token=${encodeURIComponent(token)}`);
    if (!joplinRes.ok) {
      const errText = await joplinRes.text();
      return res.status(joplinRes.status).json({ error: `노트 목록 가져오기 실패: ${errText}` });
    }
    const data = await joplinRes.json();
    res.json(data);
  } catch (error: any) {
    console.error('[Importer API] Failed to fetch notes:', error);
    res.status(500).json({ error: error.message || 'Joplin 노트 목록을 가져오는 중 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/exporter/joplin/import
 * 선택한 폴더의 모든 노트를 가져와 'data/joplin/[폴더명]/[노트명].md' 파일로 저장합니다.
 */
router.post('/joplin/import', async (req: Request, res: Response) => {
  try {
    const { apiUrl, token, folderId, folderName } = req.body;
    if (!token || !folderId || !folderName) {
      return res.status(400).json({ error: '토큰, 폴더 ID 및 폴더 이름이 필요합니다.' });
    }
    const resolvedUrl = resolveJoplinUrl(apiUrl);

    // 1. 폴더 내 노트 목록 조회
    const joplinRes = await fetch(`${resolvedUrl}/folders/${folderId}/notes?token=${encodeURIComponent(token)}&fields=id,title,body`);
    if (!joplinRes.ok) {
      const errText = await joplinRes.text();
      return res.status(joplinRes.status).json({ error: `Joplin 노트 조회 실패: ${errText}` });
    }
    const responseData = (await joplinRes.json()) as any;
    const notes = (responseData.items || responseData) as any[];

    if (!notes || notes.length === 0) {
      return res.json({ success: true, count: 0, message: '가져올 노트가 없습니다.' });
    }

    // 2. /app/data/joplin/[폴더명]/images 디렉토리 생성
    const cleanFolderName = folderName.replace(/[\\/:*?"<>|]/g, '_');
    const targetDir = path.join('/app/data/joplin', cleanFolderName);
    const imagesDir = path.join(targetDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    let successCount = 0;
    const errors: string[] = [];

    // 3. 순회하면서 로컬 마크다운 파일로 저장
    for (const note of notes) {
      try {
        const cleanTitle = note.title.replace(/[\\/:*?"<>|]/g, '_') || `Untitled_${note.id}`;
        const filePath = path.join(targetDir, `${cleanTitle}.md`);
        
        let bodyContent = note.body || '';

        // Joplin 이미지 리소스 식별 정규식: (:/32자리리소스ID)
        const resourceRegex = /\(:\/([a-zA-Z0-9]{32})\)/g;
        let match;
        const processedResources = new Set<string>();

        while ((match = resourceRegex.exec(bodyContent)) !== null) {
          const resourceId = match[1];
          if (processedResources.has(resourceId)) continue;
          processedResources.add(resourceId);

          try {
            // 3-1. Joplin Resource 메타데이터 조회 (확장자 획득용)
            const metaRes = await fetch(`${resolvedUrl}/resources/${resourceId}?token=${encodeURIComponent(token)}`);
            if (metaRes.ok) {
              const metaData = (await metaRes.json()) as any;
              const fileExt = metaData.file_extension ? `.${metaData.file_extension}` : '.png';
              const imageFileName = `${resourceId}${fileExt}`;
              const imagePath = path.join(imagesDir, imageFileName);

              // 3-2. 실제 이미지 파일 바이너리 다운로드 및 저장
              if (!fs.existsSync(imagePath)) {
                console.log(`[Importer API] Downloading image resource: ${resourceId}`);
                const fileRes = await fetch(`${resolvedUrl}/resources/${resourceId}/file?token=${encodeURIComponent(token)}`);
                if (fileRes.ok) {
                  const arrayBuffer = await fileRes.arrayBuffer();
                  fs.writeFileSync(imagePath, Buffer.from(arrayBuffer));
                } else {
                  console.warn(`[Importer API] Failed to download file for resource ${resourceId}`);
                }
              }

              // 3-3. 마크다운 본문의 :/리소스ID 링크를 images/파일명 링크로 치환
              const targetLink = `(:/${resourceId})`;
              const localLink = `(images/${imageFileName})`;
              bodyContent = bodyContent.split(targetLink).join(localLink);
            }
          } catch (resourceErr: any) {
            console.error(`[Importer API] Failed to process resource ${resourceId} for note ${note.title}:`, resourceErr);
          }
        }
        
        // 최종 노트 마크다운 파일 저장
        fs.writeFileSync(filePath, bodyContent, 'utf8');
        successCount++;
      } catch (err: any) {
        console.error(`[Importer API] Failed to save note ${note.title}:`, err);
        errors.push(`${note.title || note.id}: ${err.message}`);
      }
    }

    res.json({
      success: errors.length === 0,
      count: successCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `성공적으로 ${successCount}개의 노트를 임포트(이미지 리소스 포함)하여 '${cleanFolderName}' 폴더에 저장했습니다.`
    });
  } catch (error: any) {
    console.error('[Importer API] Import process failed:', error);
    res.status(500).json({ error: error.message || '가져오기 진행 도중 에러가 발생했습니다.' });
  }
});

import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

// Joplin CLI 실행 시 홈 디렉토리 수동 지정 및 SSL 검증 완화 설정 적용
const joplinEnv = { 
  ...process.env, 
  HOME: '/tmp',
  NODE_TLS_REJECT_UNAUTHORIZED: '0'
};

/**
 * POST /api/exporter/joplin/cli-test
 * Joplin CLI의 설정을 변경하고 서버 연결성을 간단히 확인합니다.
 */
router.post('/joplin/cli-test', async (req: Request, res: Response) => {
  try {
    const { apiUrl, username, password } = req.body;
    if (!apiUrl || !username || !password) {
      return res.status(400).json({ error: 'Joplin Server URL, ID, Password는 필수 항목입니다.' });
    }

    console.log(`[Joplin CLI Test] Configuring Joplin CLI to target: ${apiUrl}`);
    
    // Config 설정 반영
    await execAsync('joplin config sync.target 9', { env: joplinEnv });
    await execAsync(`joplin config sync.9.path "${apiUrl.trim()}"`, { env: joplinEnv });
    await execAsync(`joplin config sync.9.username "${username.trim()}"`, { env: joplinEnv });
    await execAsync(`joplin config sync.9.password "${password.trim()}"`, { env: joplinEnv });

    // 간단한 동기화 드라이 런 혹은 API 테스트를 시도합니다. (joplin sync 명령어로 동기화 통신을 1회 가볍게 시도)
    console.log('[Joplin CLI Test] Testing connection...');
    // --random-option 같은게 없으므로 joplin sync를 짧게 시도하여 자격증명 에러가 안 생기는지 판별
    const { stdout } = await execAsync('joplin sync', { env: joplinEnv });
    
    if (stdout.includes('Error:') || stdout.includes('Invalid username or password') || stdout.includes('Could not connect')) {
      return res.status(401).json({ error: `연결 실패: ${stdout}` });
    }

    res.json({ success: true, message: 'Joplin Server 연결 테스트가 통과되었습니다.' });
  } catch (error: any) {
    console.error('[Joplin CLI Test] Error:', error);
    res.status(500).json({ error: error.message || 'Joplin Server 연결 테스트 도중 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/exporter/joplin/cli-sync
 * Joplin CLI의 설정을 변경하고 동기화를 실행합니다.
 */
router.post('/joplin/cli-sync', async (req: Request, res: Response) => {
  try {
    const { apiUrl, username, password, encryptionPassword } = req.body;
    if (!apiUrl || !username || !password) {
      return res.status(400).json({ error: 'Joplin Server URL, ID, Password는 필수 항목입니다.' });
    }

    console.log(`[Joplin CLI Sync] Configuring Joplin CLI to target: ${apiUrl}`);
    
    // 1. Joplin Target 및 계정 설정 구성
    await execAsync('joplin config sync.target 9', { env: joplinEnv });
    await execAsync(`joplin config sync.9.path "${apiUrl.trim()}"`, { env: joplinEnv });
    await execAsync(`joplin config sync.9.username "${username.trim()}"`, { env: joplinEnv });
    await execAsync(`joplin config sync.9.password "${password.trim()}"`, { env: joplinEnv });

    // E2EE 암호가 전달된 경우 설정
    if (encryptionPassword) {
      await execAsync(`joplin encryption decrypt "${encryptionPassword}"`, { env: joplinEnv }).catch(err => {
        console.warn('[Joplin CLI Sync] Encryption password warning:', err.message);
      });
    }

    // 2. 동기화 실행
    console.log('[Joplin CLI Sync] Running "joplin sync"...');
    const { stdout } = await execAsync('joplin sync', { env: joplinEnv });
    console.log('[Joplin CLI Sync] Sync completed:', stdout);

    // 3. 자동 전체 내보내기 (Export all notebooks to Markdown)
    console.log('[Joplin CLI Sync] Auto exporting all notebooks to data/joplin/...');
    const { stdout: lsStdout } = await execAsync('joplin ls /', { env: joplinEnv });
    console.log('[Joplin CLI Sync] joplin ls / output:\n', lsStdout);
    const lines = lsStdout.split('\n');
    const exportedBooks: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // 괄호 앞의 노트북 이름만 순수 추출 (예: "노트북이름 (id)" -> "노트북이름")
      // "/" 문자 역시 끝에 붙어있으면 제거
      let folderName = trimmed.split('(')[0].trim();
      if (folderName.endsWith('/')) {
        folderName = folderName.slice(0, -1).trim();
      }

      if (folderName && folderName !== '..' && folderName !== '.') {
        const cleanFolderName = folderName.replace(/[\\/:*?"<>|]/g, '_');
        const targetDir = path.join('/app/data/joplin', cleanFolderName);
        const tempExportDir = path.join('/tmp/joplin_export', cleanFolderName);

        try {
          if (fs.existsSync(tempExportDir)) {
            fs.rmSync(tempExportDir, { recursive: true, force: true });
          }
          fs.mkdirSync(tempExportDir, { recursive: true });

          console.log(`[Joplin CLI Sync] Auto exporting notebook "${folderName}" to "${tempExportDir}"...`);
          await execAsync(`joplin export --format md --notebook "${folderName}" "${tempExportDir}"`, { env: joplinEnv });

          if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }
          fs.mkdirSync(path.dirname(targetDir), { recursive: true });
          fs.renameSync(tempExportDir, targetDir);
          exportedBooks.push(folderName);
        } catch (exportErr: any) {
          console.error(`[Joplin CLI Sync] Failed to auto export notebook "${folderName}":`, exportErr);
        }
      }
    }

    const finalLog = stdout + `\n\n[Auto Export Completed]\n내보낸 노트북 목록: ${exportedBooks.join(', ') || '없음'}`;
    res.json({ 
      success: true, 
      message: `동기화 완료 및 ${exportedBooks.length}개 노트북이 마크다운으로 자동 저장되었습니다.`, 
      log: finalLog 
    });
  } catch (error: any) {
    console.error('[Joplin CLI Sync] Error:', error);
    res.status(500).json({ error: error.message || 'Joplin Server 동기화 도중 에러가 발생했습니다.' });
  }
});

/**
 * GET /api/exporter/joplin/cli-folders
 * 동기화 완료된 로컬 Joplin CLI 데이터베이스 상태에서 노트북(폴더) 목록을 반환합니다.
 */
router.get('/joplin/cli-folders', async (req: Request, res: Response) => {
  try {
    console.log('[Joplin CLI Folders] Fetching folder list...');
    // joplin ls / 명령으로 노트북 목록 조회
    const { stdout } = await execAsync('joplin ls /', { env: joplinEnv });
    
    // 출력 라인 파싱 (예: "My Notebook/ (notebook_id)")
    const lines = stdout.split('\n');
    const folders = lines
      .map(line => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        // 노트북은 보통 끝에 "/"가 붙거나 ID가 괄호로 표기됨
        // 정규식 매칭: "이름/ (ID)" 또는 "이름 (ID)"
        const match = trimmed.match(/^([^\(]+?)\/?\s*\(([a-zA-Z0-9]{32})\)$/) || trimmed.match(/^([^\(]+?)\/?$/);
        if (match) {
          return {
            title: match[1].trim(),
            id: match[2] || match[1].trim(),
          };
        }
        return null;
      })
      .filter(Boolean);

    res.json(folders);
  } catch (error: any) {
    console.error('[Joplin CLI Folders] Error:', error);
    res.status(500).json({ error: error.message || '노트북 목록을 읽어오는 도중 에러가 발생했습니다.' });
  }
});

/**
 * POST /api/exporter/joplin/cli-import
 * 지정된 노트북을 통째로 마크다운 디렉토리로 내보낸 뒤, data/joplin/ 디렉토리로 이동시킵니다.
 */
router.post('/joplin/cli-import', async (req: Request, res: Response) => {
  try {
    const { folderName } = req.body;
    if (!folderName) {
      return res.status(400).json({ error: '가져올 노트북 이름(folderName)이 필요합니다.' });
    }

    const cleanFolderName = folderName.replace(/[\\/:*?"<>|]/g, '_');
    const targetDir = path.join('/app/data/joplin', cleanFolderName);
    
    // 임시 export 폴더 생성
    const tempExportDir = path.join('/tmp/joplin_export', cleanFolderName);
    if (fs.existsSync(tempExportDir)) {
      fs.rmSync(tempExportDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempExportDir, { recursive: true });

    console.log(`[Joplin CLI Import] Exporting notebook "${folderName}" to Markdown...`);
    // joplin export --format md --notebook <name> <path>
    await execAsync(`joplin export --format md --notebook "${folderName}" "${tempExportDir}"`, { env: joplinEnv });

    // 내보낸 마크다운 결과물을 최종 data/joplin/ 하위로 이동/복사
    if (fs.existsSync(targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true });
    }
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    fs.renameSync(tempExportDir, targetDir);

    res.json({
      success: true,
      message: `성공적으로 노트북 "${folderName}"을 마크다운 파일과 이미지 리소스를 포함하여 '${cleanFolderName}' 폴더에 가져왔습니다.`
    });
  } catch (error: any) {
    console.error('[Joplin CLI Import] Error:', error);
    res.status(500).json({ error: error.message || '가져오기 도중 에러가 발생했습니다.' });
  }
});


/**
 * GET /api/exporter/book-content
 * 특정 서적의 전체 마크다운 파일 내용(WikiDocsBook 구조)을 반환합니다.
 */
router.get('/book-content', (req: Request, res: Response) => {
  try {
    const { pathName } = req.query;
    if (!pathName || typeof pathName !== 'string') {
      return res.status(400).json({ error: '서적 폴더명(pathName)을 입력해주세요.' });
    }

    const booksDir = getBooksDirectory();
    const sanitizedPathName = path.basename(pathName);
    const resolvedPath = path.join(booksDir, sanitizedPathName);

    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: `해당 서적 폴더가 존재하지 않습니다: ${sanitizedPathName}` });
    }

    console.log(`[Exporter API] Loading book content from: ${resolvedPath}`);
    const book = loadBookFromDirectory(resolvedPath);
    res.json(book);
  } catch (error: any) {
    console.error('[Exporter API] Failed to load book content:', error);
    res.status(500).json({ error: error.message || 'Failed to load book content' });
  }
});

/**
 * GET /api/exporter/image
 * 서적 폴더 내부의 특정 이미지 파일을 서빙합니다.
 */
router.get('/image', (req: Request, res: Response) => {
  try {
    const { pathName, imagePath } = req.query;
    if (!pathName || typeof pathName !== 'string' || !imagePath || typeof imagePath !== 'string') {
      return res.status(400).json({ error: '필수 파라미터가 누락되었습니다. (pathName, imagePath)' });
    }

    const booksDir = getBooksDirectory();
    const sanitizedBookPath = path.basename(pathName);
    
    // 이미지 상대 경로에 대한 기본적인 디렉터리 상위 탐색 방지 (.. 방지)
    const sanitizedImagePath = imagePath.replace(/\.\./g, '');
    const resolvedImagePath = path.join(booksDir, sanitizedBookPath, sanitizedImagePath);

    if (!fs.existsSync(resolvedImagePath)) {
      return res.status(404).json({ error: `이미지 파일이 존재하지 않습니다: ${imagePath}` });
    }

    // 파일 타입에 맞는 Content-Type 설정 (단순하게 확장자 기반 처리)
    const ext = path.extname(resolvedImagePath).toLowerCase();
    let contentType = 'image/png';
    if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.svg') {
      contentType = 'image/svg+xml';
    }

    res.setHeader('Content-Type', contentType);
    fs.createReadStream(resolvedImagePath).pipe(res);
  } catch (error: any) {
    console.error('[Exporter API] Failed to serve image:', error);
    res.status(500).json({ error: error.message || 'Failed to serve image' });
  }
});

export default router;

