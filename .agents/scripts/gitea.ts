/**
 * ==============================================================================
 * 🤖 Gitea API Helper Script (gitea.ts)
 * ==============================================================================
 * @description  Gitea API를 호출하여 이슈 생성, 댓글 등록, 이슈 마감을 제어하는 헬퍼 유틸리티입니다.
 *               기존의 gitea-mcp 및 tea CLI의 대화형(interactive) 실행 장애를 대체합니다.
 * @constraints  .env 파일의 자격 증명(GITEA_ACCESS_TOKEN)을 사용합니다.
 *               Strict Typing 및 OOP Patterns 아키텍처 규칙을 상시 준수합니다.
 * @dependencies Node.js runtime, fetch API (v18+)
 * @lastUpdated  2026-06-29
 * ==============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * 프로젝트 전역 설정을 파싱하고 검증하는 Config 클래스
 */
class Config {
  public readonly apiUrl: string;
  public readonly accessToken: string;
  public readonly repo: string = 'gitea-admin/scraper';

  constructor() {
    this.loadEnv();
    this.apiUrl = process.env.GITEA_API_URL || 'https://gitea.localhost/api/v1';
    
    const token = process.env.GITEA_ACCESS_TOKEN || process.env.GITEA_API_TOKEN;
    if (!token) {
      console.error('❌ GITEA_ACCESS_TOKEN 이 설정되지 않았습니다. .env 파일을 확인해 주십시오.');
      process.exit(1);
    }
    this.accessToken = token;

    // Self-signed 인증서 오류 우회 설정
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
  }

  private loadEnv() {
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
}

interface IssueResponse {
  number: number;
  html_url: string;
}

interface CommentResponse {
  id: number;
}

/**
 * Gitea API 통신을 담당하는 Client 클래스 (SRP 준수)
 */
class GiteaClient {
  private config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  private async request<T>(endpoint: string, method: string, body?: object): Promise<T> {
    const url = `${this.config.apiUrl}${endpoint}`;
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `token ${this.config.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${errorText}`);
      }

      return await response.json() as T;
    } catch (error) {
      const err = error as Error;
      console.error(`❌ API 호출 중 오류 발생 [${method} ${url}]:`, err.message);
      process.exit(1);
    }
  }

  private formatText(text: string): string {
    // 쉘에서 리터럴로 넘어온 '\n' 문자열을 실제 줄바꿈 문자로 변환
    return text.replace(/\\n/g, '\n');
  }

  public async createIssue(title: string, body: string): Promise<void> {
    console.log(`🚀 Gitea 이슈 생성 중... [${title}]`);
    const formattedTitle = this.formatText(title);
    const formattedBody = this.formatText(body);
    const data = await this.request<IssueResponse>(`/repos/${this.config.repo}/issues`, 'POST', { title: formattedTitle, body: formattedBody });
    console.log(`✅ 이슈가 성공적으로 생성되었습니다! [Issue #${data.number}]`);
    console.log(`🔗 URL: ${data.html_url}`);
  }

  public async createComment(issueId: string, body: string): Promise<void> {
    console.log(`💬 이슈 #${issueId} 에 댓글 등록 중...`);
    const formattedBody = this.formatText(body);
    const data = await this.request<CommentResponse>(`/repos/${this.config.repo}/issues/${issueId}/comments`, 'POST', { body: formattedBody });
    console.log(`✅ 댓글이 등록되었습니다! [ID: ${data.id}]`);
  }

  public async closeIssue(issueId: string): Promise<void> {
    console.log(`🔒 이슈 #${issueId} 마감 중...`);
    await this.request<void>(`/repos/${this.config.repo}/issues/${issueId}`, 'PATCH', { state: 'closed' });
    console.log(`✅ 이슈 #${issueId} 가 마감(Closed)되었습니다.`);
  }
}

/**
 * 스크립트 실행의 진입점을 제어하는 Controller
 */
class GiteaController {
  public static async execute(): Promise<void> {
    const args = process.argv.slice(2);
    const action = args[0];

    const config = new Config();
    const client = new GiteaClient(config);

    switch (action) {
      case 'create-issue':
        if (args.length < 3) {
          console.error('Usage: npm run gitea create-issue <title> <body>');
          process.exit(1);
        }
        await client.createIssue(args[1], args[2]);
        break;

      case 'comment':
        if (args.length < 3) {
          console.error('Usage: npm run gitea comment <issueId> <body>');
          process.exit(1);
        }
        await client.createComment(args[1], args[2]);
        break;

      case 'close-issue':
        if (args.length < 2) {
          console.error('Usage: npm run gitea close-issue <issueId>');
          process.exit(1);
        }
        await client.closeIssue(args[1]);
        break;

      default:
        console.error('❌ 알 수 없는 작업명입니다. 지원하는 명령어: create-issue, comment, close-issue');
        process.exit(1);
    }
  }
}

GiteaController.execute();
