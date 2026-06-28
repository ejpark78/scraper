import * as fs from 'fs';
import * as path from 'path';

// .env 파일 파싱 유틸리티 (외부 라이브러리 없이 독립 동작하도록 구현)
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf-8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;

    const parts = trimmed.split('=');
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
    process.env[key] = value;
  });
}

loadEnv();

const GITEA_API_URL = process.env.GITEA_API_URL || 'https://gitea.localhost/api/v1';
const GITEA_ACCESS_TOKEN = process.env.GITEA_ACCESS_TOKEN || process.env.GITEA_API_TOKEN;
const REPO = 'gitea-admin/scraper';

if (!GITEA_ACCESS_TOKEN) {
  console.error('❌ GITEA_ACCESS_TOKEN 이 설정되지 않았습니다. .env 파일을 확인해 주십시오.');
  process.exit(1);
}

// self-signed 인증서 오류 방지를 위해 Node.js 전역 설정 적용
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

interface IssuePayload {
  title: string;
  body: string;
}

interface CommentPayload {
  body: string;
}

interface StatePayload {
  state: 'closed' | 'open';
}

async function request(endpoint: string, method: string, body?: any) {
  const url = `${GITEA_API_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `token ${GITEA_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP Error ${response.status}: ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`❌ API 호출 중 오류 발생 [${method} ${url}]:`, error.message);
    process.exit(1);
  }
}

async function createIssue(title: string, body: string) {
  console.log(`🚀 Gitea 이슈 생성 중... [${title}]`);
  const data = await request(`/repos/${REPO}/issues`, 'POST', { title, body } as IssuePayload);
  console.log(`✅ 이슈가 성공적으로 생성되었습니다! [Issue #${data.number}]`);
  console.log(`🔗 URL: ${data.html_url}`);
}

async function createComment(issueId: string, body: string) {
  console.log(`💬 이슈 #${issueId} 에 댓글 등록 중...`);
  const data = await request(`/repos/${REPO}/issues/${issueId}/comments`, 'POST', { body } as CommentPayload);
  console.log(`✅ 댓글이 등록되었습니다! [ID: ${data.id}]`);
}

async function closeIssue(issueId: string) {
  console.log(`🔒 이슈 #${issueId} 마감 중...`);
  const data = await request(`/repos/${REPO}/issues/${issueId}`, 'PATCH', { state: 'closed' } as StatePayload);
  console.log(`✅ 이슈 #${issueId} 가 마감(Closed)되었습니다.`);
}

async function main() {
  const args = process.argv.slice(2);
  const action = args[0];

  switch (action) {
    case 'create-issue':
      if (args.length < 3) {
        console.error('Usage: npx ts-node .agents/scripts/gitea.ts create-issue <title> <body>');
        process.exit(1);
      }
      await createIssue(args[1], args[2]);
      break;

    case 'comment':
      if (args.length < 3) {
        console.error('Usage: npx ts-node .agents/scripts/gitea.ts comment <issueId> <body>');
        process.exit(1);
      }
      await createComment(args[1], args[2]);
      break;

    case 'close-issue':
      if (args.length < 2) {
        console.error('Usage: npx ts-node .agents/scripts/gitea.ts close-issue <issueId>');
        process.exit(1);
      }
      await closeIssue(args[1]);
      break;

    default:
      console.error('❌ 알 수 없는 작업명입니다. 지원하는 명령어: create-issue, comment, close-issue');
      process.exit(1);
  }
}

main();
