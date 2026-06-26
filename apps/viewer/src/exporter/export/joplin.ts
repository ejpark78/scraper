import type { WikiDocsBook, ExportOptions } from '../types';
import { sanitizeFilename } from './base';
import { generateIndex } from '../generators';
import { AppConfig } from '../../config/AppConfig';

const JOPLIN_API_URL = AppConfig.JOPLIN_API_URL;

export async function exportToJoplin(
  book: WikiDocsBook,
  options: ExportOptions,
  token: string,
  apiUrl?: string
): Promise<void> {
  if (!token) {
    throw new Error('Joplin API 토큰이 제공되지 않았습니다.');
  }

  const targetApiUrl = apiUrl || JOPLIN_API_URL;

  let bookFolder: { id: string };
  try {
    bookFolder = await createBookFolder(book.title, token, targetApiUrl);
  } catch (error) {
    throw new Error(`Joplin에 연결할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}\nJoplin 앱이 실행 중이고 웹 클리퍼가 활성화되어 있으며, API URL(${targetApiUrl})에 접근 가능한지 확인해주세요.`, { cause: error });
  }

  for (const chapter of book.chapters) {
    const content = chapter.content;

    await createNote(
      sanitizeFilename(chapter.title),
      content,
      bookFolder.id,
      token,
      targetApiUrl
    );
  }
}

async function createBookFolder(title: string, token: string, apiUrl: string): Promise<{ id: string }> {
  const response = await fetch(`${apiUrl}/folders?token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: sanitizeFilename(title),
      // parent_id를 생략하면 Joplin 루트에 생성됩니다.
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
