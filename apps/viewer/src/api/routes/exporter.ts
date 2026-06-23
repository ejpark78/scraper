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
    const responseData = await joplinRes.json();
    const notes = (responseData.items || responseData) as any[];

    if (!notes || notes.length === 0) {
      return res.json({ success: true, count: 0, message: '가져올 노트가 없습니다.' });
    }

    // 2. data/joplin/[폴더명] 디렉토리 생성
    const cleanFolderName = folderName.replace(/[\\/:*?"<>|]/g, '_');
    const targetDir = path.resolve(__dirname, '../../../../../data/joplin', cleanFolderName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    let successCount = 0;
    const errors: string[] = [];

    // 3. 순회하면서 로컬 마크다운 파일로 저장
    for (const note of notes) {
      try {
        const cleanTitle = note.title.replace(/[\\/:*?"<>|]/g, '_') || `Untitled_${note.id}`;
        const filePath = path.join(targetDir, `${cleanTitle}.md`);
        
        // 노트 바디에 마크다운 내용 저장
        const bodyContent = note.body || '';
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
      message: `성공적으로 ${successCount}개의 노트를 임포트하여 '${cleanFolderName}' 폴더에 저장했습니다.`
    });
  } catch (error: any) {
    console.error('[Importer API] Import process failed:', error);
    res.status(500).json({ error: error.message || '가져오기 진행 도중 에러가 발생했습니다.' });
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

