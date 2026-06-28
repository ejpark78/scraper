import * as fs from 'fs';
import * as path from 'path';

// 로컬 자가서명 SSL 인증서 오류 우회 설정
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// .env 파일 수동 파싱 도우미 함수 (추가 의존성 배제)
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env 파일이 존재하지 않습니다. 시스템 환경 변수를 사용합니다.');
    return;
  }
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIdx = trimmed.indexOf('=');
    if (separatorIdx === -1) continue;
    const key = trimmed.slice(0, separatorIdx).trim();
    const val = trimmed.slice(separatorIdx + 1).trim();
    process.env[key] = val;
  }
}

loadEnv();

const GITEA_API_URL = process.env.GITEA_API_URL || 'https://gitea.127.0.0.1.nip.io/api/v1';
const GITEA_API_TOKEN = process.env.GITEA_API_TOKEN;

const REPO_OWNER = 'gitea-admin';
const REPO_NAME = 'scraper';

const SHOULD_RESET = process.argv.includes('--reset');

if (!GITEA_API_TOKEN) {
  console.error('❌ 에러: GITEA_API_TOKEN 환경 변수가 설정되지 않았습니다.');
  console.error('       .env 파일에 값을 입력한 후 다시 실행해 주십시오.');
  process.exit(1);
}

interface ArtifactGroup {
  id: string; // 3자리 번호 (예: 109)
  title: string; // 파일명 기반 타이틀
  planFile?: string;
  taskFile?: string;
  walkthroughFile?: string;
  virtualContent?: {
    plan?: string;
    task?: string;
    walkthrough?: string;
  };
}

// 1. docs/artifacts 디렉토리 스캔 및 그룹화
function scanArtifacts(): ArtifactGroup[] {
  const artifactsDir = path.join(process.cwd(), 'docs/artifacts');
  if (!fs.existsSync(artifactsDir)) {
    console.error(`❌ 에러: 아티팩트 디렉토리가 존재하지 않습니다: ${artifactsDir}`);
    return [];
  }

  const files = fs.readdirSync(artifactsDir);
  const groups: { [key: string]: ArtifactGroup } = {};

  // A. 일반 개별 아티팩트 파일 스캔
  for (const file of files) {
    const match = file.match(/^(\d{3})-(.+?)\.(plan|task|walkthrough)\.md$/);
    if (!match) continue;

    const [_, id, titleSlug, type] = match;
    const title = titleSlug.replace(/-/g, ' ');

    if (!groups[id]) {
      groups[id] = { id, title };
    }

    if (type === 'plan') groups[id].planFile = file;
    else if (type === 'task') groups[id].taskFile = file;
    else if (type === 'walkthrough') groups[id].walkthroughFile = file;
  }

  // B. 아카이브 파일 파싱하여 개별 아티팩트 복원
  for (const file of files) {
    const archiveMatch = file.match(/^(\d{3})-(\d{3})\.archive\.md$/);
    if (!archiveMatch) continue;

    const archivePath = path.join(artifactsDir, file);
    const content = fs.readFileSync(archivePath, 'utf8');
    const lines = content.split('\n');

    let currentId = '';
    let currentTitle = '';
    let currentType: 'plan' | 'task' | 'walkthrough' | '' = '';
    let currentBodyLines: string[] = [];

    const flushCurrent = () => {
      if (currentId && currentType && currentBodyLines.length > 0) {
        if (!groups[currentId]) {
          groups[currentId] = { id: currentId, title: currentTitle, virtualContent: {} };
        }
        if (!groups[currentId].virtualContent) {
          groups[currentId].virtualContent = {};
        }
        groups[currentId].virtualContent![currentType] = currentBodyLines.join('\n');
        
        // 가상 상태 파일 설정
        if (currentType === 'plan') groups[currentId].planFile = `(Archived Plan in ${file})`;
        else if (currentType === 'task') groups[currentId].taskFile = `(Archived Task in ${file})`;
        else if (currentType === 'walkthrough') groups[currentId].walkthroughFile = `(Archived Walkthrough in ${file})`;
      }
    };

    for (const rawLine of lines) {
      const line = rawLine.replace(/\r/g, '');
      const headerMatch = line.match(/^## (\d{3})-(.+?)\.(plan|task|walkthrough)$/);
      
      if (headerMatch) {
        flushCurrent();
        currentId = headerMatch[1];
        currentTitle = headerMatch[2].replace(/-/g, ' ');
        currentType = headerMatch[3] as 'plan' | 'task' | 'walkthrough';
        currentBodyLines = [];
      } else {
        if (currentId) {
          currentBodyLines.push(rawLine);
        }
      }
    }
    flushCurrent();
  }

  return Object.values(groups).sort((a, b) => Number(a.id) - Number(b.id));
}

// 2. Gitea API 호출용 헬퍼 함수
async function callGitea(endpoint: string, options: RequestInit = {}) {
  const url = `${GITEA_API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `token ${GITEA_API_TOKEN}`,
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`Gitea API 오류 (${response.status} ${response.statusText}): ${text}`);
  }
  return response;
}

// Gitea 라벨 자동 검증 및 생성 및 ID 맵핑 반환
async function ensureGiteaLabels(): Promise<{ [name: string]: number }> {
  const labelsRes = await callGitea(`/repos/${REPO_OWNER}/${REPO_NAME}/labels`);
  let existingLabels = labelsRes.status === 200 ? await labelsRes.json() : [];
  
  const requiredLabels = [
    { name: 'status/planned', color: 'd4c5f9', description: 'Planned Task' },
    { name: 'status/in-progress', color: 'fbca04', description: 'In Progress Task' },
    { name: 'status/done', color: '0e8a16', description: 'Done Task' }
  ];
  
  const labelMap: { [name: string]: number } = {};
  
  for (const label of requiredLabels) {
    let found = existingLabels.find((l: any) => l.name === label.name);
    if (!found) {
      console.log(`🏷️  Gitea 라벨 생성: ${label.name}`);
      const createRes = await callGitea(`/repos/${REPO_OWNER}/${REPO_NAME}/labels`, {
        method: 'POST',
        body: JSON.stringify(label),
      });
      found = await createRes.json();
    }
    labelMap[label.name] = found.id;
  }
  
  return labelMap;
}

// 태스크 체크박스 상태 판독 도우미 함수
function isTaskCompleted(taskFile: string | undefined, virtualTaskContent: string | undefined): boolean {
  let content = '';
  if (virtualTaskContent) {
    content = virtualTaskContent;
  } else if (taskFile && !taskFile.startsWith('(Archived')) {
    const taskPath = path.join(process.cwd(), 'docs/artifacts', taskFile);
    if (fs.existsSync(taskPath)) {
      content = fs.readFileSync(taskPath, 'utf8');
    }
  }
  
  if (!content) return false;
  
  // 미완료 체크박스 '- [ ]'가 있으면 완료가 아님
  const hasUnfinished = /-\s*\[\s*\]/g.test(content);
  return !hasUnfinished;
}

// Gitea 저장소 확보 및 이슈 동기화
async function syncGitea(groups: ArtifactGroup[]) {
  console.log('\n🐙 Gitea 아티팩트 동기화 진행 중...');

  let repoExists = false;

  if (SHOULD_RESET) {
    try {
      console.log(`🗑️ [Reset] Gitea 기존 '${REPO_NAME}' 저장소를 삭제합니다...`);
      await callGitea(`/repos/${REPO_OWNER}/${REPO_NAME}`, { method: 'DELETE' });
    } catch (err) {
      // 무시
    }
  } else {
    try {
      const res = await callGitea(`/repos/${REPO_OWNER}/${REPO_NAME}`);
      if (res.status === 200) repoExists = true;
    } catch (err) {
      // 무시
    }
  }

  if (!repoExists) {
    console.log(`📦 Gitea에 '${REPO_NAME}' 저장소를 생성합니다.`);
    await callGitea('/user/repos', {
      method: 'POST',
      body: JSON.stringify({
        name: REPO_NAME,
        private: true,
        description: 'LinkedIn Clipper & Scraper Project Hub',
      }),
    });
    console.log(`✅ Gitea 저장소가 성공적으로 생성되었습니다.`);
  }

  // 필수 라벨 구성 및 ID 매핑 획득
  const labelMap = await ensureGiteaLabels();

  // 기존 이슈 목록 가져오기
  const issuesRes = await callGitea(`/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all`);
  const existingIssues = issuesRes.status === 200 ? await issuesRes.json() : [];

  for (const group of groups) {
    const issueTitle = `[SCR-${group.id}] ${group.title}`;
    const artifactsDir = path.join(process.cwd(), 'docs/artifacts');

    // 이슈 내용 작성
    let body = `## 📄 Artifact Documentation Link (${group.id})\n\n`;
    body += `| Type | Artifact File | Link |\n| :--- | :--- | :--- |\n`;
    if (group.planFile) {
      body += `| 📋 Plan | \`${group.planFile}\` | [View Plan](file:///docs/artifacts/${group.planFile}) |\n`;
    }
    if (group.taskFile) {
      body += `| 📝 Task | \`${group.taskFile}\` | [View Task](file:///docs/artifacts/${group.taskFile}) |\n`;
    }
    if (group.walkthroughFile) {
      body += `| 🚀 Walkthrough | \`${group.walkthroughFile}\` | [View Walkthrough](file:///docs/artifacts/${group.walkthroughFile}) |\n`;
    }

    // 대표 파일 내용(예: plan 또는 walkthrough의 요약)을 상세 내용으로 추가
    const targetFile = group.walkthroughFile || group.planFile || group.taskFile;
    let fileContent = '';
    if (group.virtualContent) {
      fileContent = group.virtualContent.walkthrough || group.virtualContent.plan || group.virtualContent.task || '';
    }
    if (!fileContent && targetFile && !targetFile.startsWith('(Archived')) {
      fileContent = fs.readFileSync(path.join(artifactsDir, targetFile), 'utf8');
    }

    if (fileContent) {
      body += `\n\n### 🔍 핵심 요약 및 내용 (${targetFile})\n\n\`\`\`markdown\n`;
      body += fileContent.length > 5000 ? fileContent.substring(0, 5000) + '\n\n...(본문 중략)...' : fileContent;
      body += `\n\`\`\``;
    }

    body = body.replace(/\r/g, '');

    // 진행 상태 및 목표 라벨/이슈 상태 결정
    let targetState = 'open';
    let targetLabel = 'status/planned';
    
    // 현재 세션에서 다루어지는 피처 번호 보호 목록 (강제 In Progress)
    const activeSessionIds = ['109', '110'];

    const isArchiveDone = Number(group.id) <= 100;
    const hasWalkthrough = !!group.walkthroughFile;
    const allChecked = isTaskCompleted(group.taskFile, group.virtualContent?.task);

    // 100번 이하 완료 건이거나, 활성 세션 번호가 아니면서 walkthrough 존재 및 체크박스 완료된 경우 Done
    const isDone = isArchiveDone || 
      (!activeSessionIds.includes(group.id) && hasWalkthrough && allChecked);

    if (isDone) {
      targetState = 'closed';
      targetLabel = 'status/done';
    } else if (group.taskFile) {
      targetState = 'open';
      targetLabel = 'status/in-progress';
    }

    // 매칭 이슈 검색
    const matchedIssue = existingIssues.find((iss: any) => iss.title.startsWith(`[SCR-${group.id}]`));

    if (matchedIssue) {
      // 기존 라벨 확인 및 변경 여부 판단
      const currentLabels = matchedIssue.labels || [];
      const currentStatusLabel = currentLabels.find((l: any) => l.name.startsWith('status/'));
      const isLabelDifferent = !currentStatusLabel || currentStatusLabel.name !== targetLabel;

      if (matchedIssue.body !== body || matchedIssue.state !== targetState || isLabelDifferent) {
        console.log(`🔄 Gitea 이슈 업데이트: ${issueTitle} (상태: ${targetState}, 라벨: ${targetLabel})`);
        
        // 라벨 교체 ID 배열 구성 (기존 status/ 라벨의 ID를 제외하고 새 라벨 ID 추가)
        const labelIds = currentLabels
          .filter((l: any) => !l.name.startsWith('status/'))
          .map((l: any) => l.id);
        labelIds.push(labelMap[targetLabel]);

        await callGitea(`/repos/${REPO_OWNER}/${REPO_NAME}/issues/${matchedIssue.number}`, {
          method: 'PATCH',
          body: JSON.stringify({
            body,
            state: targetState,
            labels: labelIds,
          }),
        });
      }
    } else {
      console.log(`➕ Gitea 신규 이슈 생성: ${issueTitle} (라벨: ${targetLabel})`);
      const createRes = await callGitea(`/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
        method: 'POST',
        body: JSON.stringify({
          title: issueTitle,
          body: body,
          assignees: [REPO_OWNER],
          labels: [labelMap[targetLabel]],
        }),
      });

      // Done 판정 상태라면 생성 직후 즉시 닫아줌
      if (isDone) {
        const createdIssue = await createRes.json();
        if (createdIssue && createdIssue.number) {
          await callGitea(`/repos/${REPO_OWNER}/${REPO_NAME}/issues/${createdIssue.number}`, {
            method: 'PATCH',
            body: JSON.stringify({ state: 'closed' }),
          });
        }
      }
    }
  }
  console.log('✅ Gitea 아티팩트 동기화 완료!');
}

async function main() {
  console.log('🚀 PMS 동기화 유틸리티를 시작합니다. (Gitea 단일 통합 버젼)');
  const groups = scanArtifacts();
  console.log(`📊 발견된 아티팩트 그룹 개수: ${groups.length}개`);
  
  if (groups.length === 0) {
    console.log('ℹ️  동기화할 아티팩트가 없습니다.');
    return;
  }

  try {
    await syncGitea(groups);
    console.log('\n🎉 모든 PMS 아티팩트 동기화가 안전하게 종료되었습니다.');
  } catch (error) {
    console.error('\n❌ PMS 동기화 중 오류 발생:', error);
    process.exit(1);
  }
}

main();
