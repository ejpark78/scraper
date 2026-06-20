import * as path from 'path';
import { loadBookFromDirectory } from './utils/fileLoader';
import { exportToJoplin } from './export/joplin';
import { exportToObsidian } from './export/obsidian';
import type { ExportOptions } from './types';

function parseArgs(args: string[]): Record<string, string> {
  const params: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const parts = arg.slice(2).split('=');
      const key = parts[0];
      const val = parts.slice(1).join('=');
      if (key) {
        params[key] = val || 'true';
      }
    }
  }
  return params;
}

function printHelp() {
  console.log(`
📚 Scraper Exporter CLI
사용법: npm run start -- [옵션]

옵션:
  --target=joplin|obsidian    내보낼 대상 앱 (필수)
  --path=DIRECTORY_PATH       내보낼 책/문서가 들어있는 폴더 경로 (필수)
  --token=JOPLIN_TOKEN        Joplin API 웹클리퍼 토큰 (target이 joplin일 때 필수)
  --key=OBSIDIAN_API_KEY      Obsidian Local REST API 키 (target이 obsidian일 때 필수)
  --addFrontmatter=true|false 각 노트에 프론트매터 자동 추가 여부 (기본값: true)
  --createIndex=true|false    INDEX.md 파일 자동 생성 여부 (기본값: true)

예시:
  # Joplin으로 내보내기
  npm run start -- --target=joplin --path="/app/data/ebook/output/Generative AI on Kubernetes - Roland Huss , Daniele Zonca 2026" --token=abcd1234efgh

  # Obsidian으로 내보내기
  npm run start -- --target=obsidian --path="/app/data/ebook/output/Generative AI on Kubernetes - Roland Huss , Daniele Zonca 2026" --key=your-obsidian-rest-api-key
  `);
}

async function main() {
  const args = process.argv.slice(2);
  const params = parseArgs(args);

  if (params.help || params.h || Object.keys(params).length === 0) {
    printHelp();
    return;
  }

  const target = params.target as 'joplin' | 'obsidian';
  const dirPath = params.path;
  const token = params.token;
  const key = params.key;

  if (!target || !['joplin', 'obsidian'].includes(target)) {
    console.error('❌ 에러: 올바른 --target 값을 입력해주세요. (joplin 또는 obsidian)');
    process.exit(1);
  }

  if (!dirPath) {
    console.error('❌ 에러: 내보낼 마크다운 폴더 경로 --path를 입력해주세요.');
    process.exit(1);
  }

  const options: ExportOptions = {
    target,
    includeImages: false,
    addFrontmatter: params.addFrontmatter !== 'false',
    createIndex: params.createIndex !== 'false',
  };

  try {
    console.log(`📖 [FileLoader] 폴더 읽는 중: ${dirPath}`);
    const resolvedPath = path.resolve(dirPath);
    const book = loadBookFromDirectory(resolvedPath);

    console.log(`📚 서적 확인됨: "${book.title}" (총 ${book.chapters.length}개 챕터)`);

    if (target === 'joplin') {
      if (!token) {
        console.error('❌ 에러: Joplin으로 내보내려면 --token이 필요합니다.');
        process.exit(1);
      }
      console.log('🚀 Joplin 내보내기 시작...');
      await exportToJoplin(book, options, token);
      console.log('✅ Joplin으로 내보내기를 성공적으로 완료했습니다!');
    } else if (target === 'obsidian') {
      if (!key) {
        console.error('❌ 에러: Obsidian으로 내보내려면 --key가 필요합니다.');
        process.exit(1);
      }
      console.log('🚀 Obsidian 내보내기 시작...');
      await exportToObsidian(book, options, key);
      console.log('✅ Obsidian으로 내보내기를 성공적으로 완료했습니다!');
    }
  } catch (error) {
    console.error('❌ 내보내기 실패:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
