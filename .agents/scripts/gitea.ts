/**
 * ==============================================================================
 * 🤖 Gitea API Helper Script (gitea.ts)
 * ==============================================================================
 * @description  Gitea API를 호출하여 이슈 생성, 조회, 수정, 댓글 등록/수정/조회, 이슈 마감을 제어하는 헬퍼 유틸리티입니다.
 *               기존의 gitea-mcp 및 tea CLI의 대화형(interactive) 실행 장애를 대체합니다.
 * @constraints  .env 파일의 자격 증명(GITEA_ACCESS_TOKEN)을 사용합니다.
 *               Strict Typing 및 OOP Patterns 아키텍처 규칙을 상시 준수합니다.
 * @dependencies Node.js runtime, fetch API (v18+), git CLI
 * @lastUpdated  2026-06-29
 * ==============================================================================
 */

import { execSync } from 'child_process';
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
  title: string;
  body: string;
  html_url: string;
}

interface CommentResponse {
  id: number;
  body: string;
}

interface TimelineEvent {
  type: string;
  event: string;
  commit_id?: string;
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
    // [br] 기호만 실제 줄바꿈 문자로 변환합니다.
    return text.replace(/\[br\]/g, '\n');
  }

  private runGitCmd(cmd: string): string {
    try {
      return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    } catch {
      return '';
    }
  }

  public async getIssues(): Promise<IssueResponse[]> {
    return await this.request<IssueResponse[]>(`/repos/${this.config.repo}/issues?state=all&limit=250`, 'GET');
  }

  public async getIssue(issueId: string): Promise<IssueResponse> {
    return await this.request<IssueResponse>(`/repos/${this.config.repo}/issues/${issueId}`, 'GET');
  }

  public async getComments(issueId: string): Promise<CommentResponse[]> {
    return await this.request<CommentResponse[]>(`/repos/${this.config.repo}/issues/${issueId}/comments`, 'GET');
  }

  public async getTimeline(issueId: string): Promise<TimelineEvent[]> {
    return await this.request<TimelineEvent[]>(`/repos/${this.config.repo}/issues/${issueId}/timeline`, 'GET');
  }

  public async updateIssue(issueId: string, title: string, body: string): Promise<void> {
    await this.request<void>(`/repos/${this.config.repo}/issues/${issueId}`, 'PATCH', { title, body });
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

  public async updateComment(commentId: string, body: string): Promise<void> {
    console.log(`💬 댓글 ID #${commentId} 수정 중...`);
    const formattedBody = this.formatText(body);
    await this.request<void>(`/repos/${this.config.repo}/issues/comments/${commentId}`, 'PATCH', { body: formattedBody });
    console.log(`✅ 댓글 ID #${commentId} 수정이 정상 완료되었습니다.`);
  }

  public async closeIssue(issueId: string): Promise<void> {
    console.log(`🔒 이슈 #${issueId} 마감 중...`);
    await this.request<void>(`/repos/${this.config.repo}/issues/${issueId}`, 'PATCH', { state: 'closed' });
    console.log(`✅ 이슈 #${issueId} 가 마감(Closed)되었습니다.`);
  }

  public async fixLegacyIssues(issueIds: string[]): Promise<void> {
    console.log(`⚙️ 기존 깨진 이슈 본문 복구 프로세스 시작... 대상 이슈: [${issueIds.join(', ')}]`);
    for (const id of issueIds) {
      try {
        const issue = await this.getIssue(id);
        const originalBody = issue.body;
        const fixedBody = originalBody.replace(/\\n/g, '\n');

        if (originalBody !== fixedBody) {
          await this.updateIssue(id, issue.title, fixedBody);
          console.log(`   ✅ 이슈 #${id} 본문 복구 완료!`);
        } else {
          console.log(`   ℹ️ 이슈 #${id} 는 이미 정상 포맷이거나 치환할 문자열이 없습니다.`);
        }
      } catch (e) {
        const err = e as Error;
        console.error(`   ❌ 이슈 #${id} 복구 실패:`, err.message);
      }
    }
    console.log('🎉 일괄 복구 프로세스가 성공적으로 완료되었습니다.');
  }

  public async retroactiveCommitLinks(): Promise<void> {
    console.log('🔍 전체 이슈 대상 Commit Diff 링크 소급 매핑 프로세스 기동 (v3)...');
    try {
      const issues = await this.getIssues();
      console.log(`📄 조회된 Gitea 이슈 개수: ${issues.length}`);

      for (const issue of issues) {
        const issueId = issue.number;
        const comments = await this.getComments(String(issueId));

        // 엄밀한 검사: 본문(body)이나 댓글(comments) 타임라인 통틀어 Commit Diff 링크(/commit/)가 존재하는지 확인
        const hasDiffLink = issue.body.includes('Gitea Commit Diff') ||
                            issue.body.includes('/commit/') ||
                            comments.some((c) => c.body.includes('Gitea Commit Diff') || c.body.includes('/commit/'));

        if (hasDiffLink) {
          console.log(`   ℹ️ 이슈 #${issueId}: 이미 Commit Diff 링크가 매핑되어 있습니다. 건너뜁니다.`);
          continue;
        }

        let commitHash: string | undefined = undefined;

        // 1단계: Git 커밋 메시지에서 번호 매칭 시도
        const paddedIssueId = String(issueId).padStart(3, '0'); // 예: 92 -> 092
        let gitLogCmd = `git log --grep="(${issueId})" --grep="(${paddedIssueId})" --oneline -n 1`;
        if (issueId === 92) {
          gitLogCmd = `git log --grep="(115)" --oneline -n 1`;
        }
        
        const logOutput = this.runGitCmd(gitLogCmd);
        if (logOutput) {
          commitHash = logOutput.split(/\s+/)[0];
        }

        // 2단계: Gitea 이슈 타임라인 API를 역추적하여 커밋 참조 해시 추출 (Fallback)
        if (!commitHash) {
          try {
            const timeline = await this.getTimeline(String(issueId));
            // event === 'reference' 혹은 commit_id가 있는 객체 추적
            const commitRef = timeline.find((e) => e.commit_id && e.commit_id.length > 0);
            if (commitRef) {
              commitHash = commitRef.commit_id;
              console.log(`   🎯 이슈 #${issueId} ➡ Gitea 타임라인 참조 역추적 성공! [${commitHash}]`);
            }
          } catch (e) {
            // timeline 조회 실패 시 로깅 생략
          }
        }

        if (!commitHash) {
          console.log(`   ℹ️ 이슈 #${issueId}: 매칭되는 Git 커밋 및 Gitea 타임라인 참조를 찾지 못했습니다. 건너뜁니다.`);
          continue;
        }

        console.log(`   🎯 이슈 #${issueId} ➡ 매칭 커밋 해시: [${commitHash}]`);

        const reportComment = comments.find((c) => c.body.includes('🏁 작업 완료 보고'));

        if (reportComment) {
          // 1. 완료 보고 댓글이 존재할 시, 해당 댓글 하단에 덧붙임
          const retroactiveLink = `[br][br]### 🔗 Gitea Commit Diff 링크 (소급 매핑)[br]- [Commit Diff #${commitHash.substring(0, 8)}](https://gitea.localhost/${this.config.repo}/commit/${commitHash})`;
          const updatedBody = reportComment.body + retroactiveLink;
          await this.updateComment(String(reportComment.id), updatedBody);
          console.log(`      ✅ 댓글 ID #${reportComment.id} 에 Commit Diff 링크 소급 주입 완료!`);
        } else {
          // 2. 완료 보고 댓글이 존재하지 않는 과거 이슈 (#1~#91 등) ➡ 이슈 본문(body) 가장 하단에 직접 주입
          const retroactiveLink = `[br][br]### 🔗 Gitea Commit Diff 링크 (소급 매핑)[br]- [Commit Diff #${commitHash.substring(0, 8)}](https://gitea.localhost/${this.config.repo}/commit/${commitHash})`;
          const updatedIssueBody = issue.body + retroactiveLink;
          const formattedBody = this.formatText(updatedIssueBody);
          await this.updateIssue(String(issueId), issue.title, formattedBody);
          console.log(`      ✅ 이슈 #${issueId} 본문(body)에 직접 Commit Diff 링크 소급 주입 완료!`);
        }
      }
      console.log('🎉 전체 이슈 대상 Commit Diff 링크 소급 매핑이 완료되었습니다!');
    } catch (error) {
      const err = error as Error;
      console.error('❌ 소급 매핑 실패:', err.message);
    }
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

      case 'update-comment':
        if (args.length < 3) {
          console.error('Usage: npm run gitea update-comment <commentId> <body>');
          process.exit(1);
        }
        await client.updateComment(args[1], args[2]);
        break;

      case 'close-issue':
        if (args.length < 2) {
          console.error('Usage: npm run gitea close-issue <issueId>');
          process.exit(1);
        }
        await client.closeIssue(args[1]);
        break;

      case 'fix-legacy-issues':
        if (args.length < 2) {
          console.error('Usage: npm run gitea fix-legacy-issues <issueId1> <issueId2> ...');
          process.exit(1);
        }
        const ids = args.slice(1);
        await client.fixLegacyIssues(ids);
        break;

      case 'retroactive-commit-links':
        await client.retroactiveCommitLinks();
        break;

      default:
        console.error('❌ 알 수 없는 작업명입니다. 지원하는 명령어: create-issue, comment, update-comment, close-issue, fix-legacy-issues, retroactive-commit-links');
        process.exit(1);
    }
  }
}

GiteaController.execute();
