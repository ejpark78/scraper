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
      console.log(`[Exporter API] Starting export to Joplin for: "${book.title}"`);
      await exportToJoplin(book, options, token);
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

export default router;
