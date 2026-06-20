import type { WikiDocsBook, ExportOptions } from '../types';
import { sanitizeFilename } from './base';
import { generateIndex } from '../generators';

const JOPLIN_API_URL = process.env.JOPLIN_API_URL || 'http://host.docker.internal:41184';

export async function exportToJoplin(
  book: WikiDocsBook,
  options: ExportOptions,
  token: string
): Promise<void> {
  if (!token) {
    throw new Error('Joplin API 토큰이 제공되지 않았습니다.');
  }

  let bookFolder;
  try {
    bookFolder = await createBookFolder(book.title, token);
  } catch (error) {
    throw new Error(`Joplin에 연결할 수 없습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}\nJoplin 앱이 실행 중이고 웹 클리퍼가 활성화되어 있으며, API URL(${JOPLIN_API_URL})에 접근 가능한지 확인해주세요.`);
  }

  for (const chapter of book.chapters) {
    let content = chapter.content;
    if (options.addFrontmatter) {
      content = `---\ntitle: "${chapter.title.replace(/"/g, '\\"')}"\nbook: "${book.title.replace(/"/g, '\\"')}"\nsource: "${chapter.url}"\n---\n\n` + content;
    }

    await createNote(
      sanitizeFilename(chapter.title),
      content,
      bookFolder.id,
      token
    );
  }

  if (options.createIndex) {
    const indexContent = generateIndex(book, 'joplin');
    await createNote(
      'INDEX',
      indexContent,
      bookFolder.id,
      token
    );
  }
}

async function createBookFolder(title: string, token: string): Promise<{ id: string }> {
  const response = await fetch(`${JOPLIN_API_URL}/folders?token=${encodeURIComponent(token)}`, {
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
  token: string
): Promise<void> {
  const response = await fetch(`${JOPLIN_API_URL}/notes?token=${encodeURIComponent(token)}`, {
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
