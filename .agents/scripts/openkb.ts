/**
 * ==============================================================================
 * 🧠 Agent Session Compounding to OpenKB Raw Store (openkb.ts)
 * ==============================================================================
 * @description  에이전트 세션 로그 데이터를 획득하여 Obsidian Graph View 가독성을 높이기 위해
 *               'YYYY-MM-DD_이슈번호_핵심요약.md' 형태의 가시성 높은 파일명으로 자동 변환해
 *               OpenKB raw 스토어에 복사하고, OpenKB 컴파일을 수행합니다.
 * @constraints  Strict Typing 및 OOP Patterns 아키텍처 규칙을 상시 준수합니다.
 * @dependencies Node.js runtime, fs, path, child_process
 * ==============================================================================
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

class OpenKbConfig {
  public readonly projectRoot: string = '/Users/ejpark/workspace/scraper';
  public readonly dumpDir: string;
  public readonly openkbDir: string;

  constructor() {
    this.dumpDir = path.join(this.projectRoot, 'data/agents/agy');
    this.openkbDir = path.join(this.projectRoot, 'data/openkb');
  }
}

class SessionNameHelper {
  /**
   * transcript.md 파일의 내용을 분석하여 'YYYY-MM-DD_이슈번호_핵심요약' 형태의 가시성 높은 파일명을 리턴합니다.
   */
  public static extractFriendlyName(filePath: string, dateFolder: string, uuid: string): string {
    // 날짜 포맷 정리 (예: 2026-06-28T211048 -> 2026-06-28)
    const datePart = dateFolder.split('T')[0];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // 1단계: 유저 요청 부분 파싱
      const userRequestMatch = content.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
      if (userRequestMatch && userRequestMatch[1]) {
        const userRequest = userRequestMatch[1].trim();

        // 2단계: 이슈 번호 추출 (예: #104, 104번, feature/104 등)
        let issueNo = '';
        const issueNoMatch = userRequest.match(/(?:#|이슈\s*|버그\s*|feature\/)([0-9]{3})/i);
        if (issueNoMatch) {
          issueNo = `_#${issueNoMatch[1]}`;
        }

        // 3단계: 핵심 요약 타이틀 생성
        // 첫 줄 텍스트에서 한글/영문/숫자 공백 위주로 남김
        const firstLine = userRequest.split('\n')[0]
          .replace(/[#*`~\[\]\(\)<>\-_]/g, ' ') // 마크다운/특수기호 제거
          .replace(/https?:\/\/[^\s]+/g, '')    // URL 제거
          .trim();

        let cleanTitle = firstLine
          .replace(/[^a-zA-Z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s]/g, '') // 특수기호 제거
          .replace(/\s+/g, '_') // 공백을 언더바로 변환
          .substring(0, 40); // 파일 이름 길이 제한

        if (!cleanTitle) {
          cleanTitle = 'agent_session';
        }

        return `${datePart}${issueNo}_${cleanTitle}.md`;
      }
    } catch {
      // 오류 발생 시 fallback
    }

    return `${datePart}_${uuid.substring(0, 8)}_session.md`;
  }
}

class OpenKbCompiler {
  private config: OpenKbConfig;

  constructor(config: OpenKbConfig) {
    this.config = config;
  }

  private runCmd(cmd: string): void {
    try {
      execSync(cmd, { encoding: 'utf-8', stdio: 'inherit' });
    } catch (error) {
      const err = error as Error;
      console.error(`❌ [OpenKB] 명령어 실행 실패: ${cmd}`);
      console.error(err.message);
      process.exit(1);
    }
  }

  private findTranscripts(dir: string, fileName: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.findTranscripts(fullPath, fileName));
      } else if (file === fileName) {
        results.push(fullPath);
      }
    }
    return results;
  }

  public compile(): void {
    console.log('🤖 Starting OpenKB Compiling Pipeline...');
    const rawStore = path.join(this.config.openkbDir, 'raw');
    fs.mkdirSync(rawStore, { recursive: true });

    // 1. transcript.md 파일들을 탐색하고 분석하여 이름 치환 후 복사
    const transcripts = this.findTranscripts(this.config.dumpDir, 'transcript.md');
    console.log(`📁 Copying raw dump session transcripts to OpenKB raw store (Found ${transcripts.length} files)...`);

    for (const file of transcripts) {
      const tagFolder = path.basename(path.dirname(file)); // 예: 0001-e6673877...
      const sessionUuid = tagFolder.replace(/^[0-9]+-/, ''); 
      const dateFolder = path.basename(path.dirname(path.dirname(file))); // 예: 2026-06-28T211048

      const friendlyName = SessionNameHelper.extractFriendlyName(file, dateFolder, sessionUuid);
      const destPath = path.join(rawStore, friendlyName);

      let shouldCopy = !fs.existsSync(destPath);
      if (!shouldCopy) {
        const srcStat = fs.statSync(file);
        const destStat = fs.statSync(destPath);
        shouldCopy = srcStat.mtimeMs > destStat.mtimeMs;
      }

      if (shouldCopy) {
        fs.copyFileSync(file, destPath);
        console.log(`   + Copied friendly transcript: ${friendlyName}`);
      }
    }

    // 2. OpenKB 컨테이너 구동
    console.log('🧠 Compiling knowledge via OpenKB inside Container (PageIndex)...');
    const rawContents = fs.readdirSync(rawStore);
    if (rawContents.length > 0) {
      this.runCmd('docker compose -p scraper run --rm openkb add /data/openkb/raw/');
      console.log('✅ OpenKB Compile execution complete.');
    } else {
      console.log('   No raw logs found to compound.');
    }
  }
}

// Execute
const config = new OpenKbConfig();
const compiler = new OpenKbCompiler(config);
compiler.compile();
