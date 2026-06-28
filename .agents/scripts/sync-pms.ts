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
const VIKUNJA_API_URL = process.env.VIKUNJA_API_URL || 'https://vikunja.127.0.0.1.nip.io/api/v1';
const VIKUNJA_API_TOKEN = process.env.VIKUNJA_API_TOKEN;

const REPO_OWNER = 'gitea-admin';
const REPO_NAME = 'scraper';

if (!GITEA_API_TOKEN || !VIKUNJA_API_TOKEN) {
  console.error('❌ 에러: GITEA_API_TOKEN 또는 VIKUNJA_API_TOKEN 환경 변수가 설정되지 않았습니다.');
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
      currentBodyLines = [];
    };

    for (const line of lines) {
      const headerMatch = line.match(/^## (\d{3})-(.+?)\.(plan|task|walkthrough|spec|adr|walkthrough)$/);
      if (headerMatch) {
        flushCurrent();
        currentId = headerMatch[1];
        currentTitle = headerMatch[2].replace(/-/g, ' ');
        const matchedType = headerMatch[3];
        if (matchedType === 'spec' || matchedType === 'adr') {
          currentType = 'plan'; // spec 이나 adr은 plan으로 분류
        } else {
          currentType = matchedType as 'plan' | 'task' | 'walkthrough';
        }
      } else {
        if (currentId) {
          currentBodyLines.push(line);
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

// 3. Vikunja API 호출용 헬퍼 함수
async function callVikunja(endpoint: string, options: RequestInit = {}) {
  const url = `${VIKUNJA_API_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${VIKUNJA_API_TOKEN}`,
    ...(options.headers || {}),
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`Vikunja API 오류 (${response.status} ${response.statusText}): ${text}`);
  }
  return response;
}

// Gitea 저장소 확보 및 이슈 동기화
async function syncGitea(groups: ArtifactGroup[]) {
  console.log('\n🐙 Gitea 아티팩트 동기화 진행 중...');

  // 기존 저장소 강제 삭제 (리셋)
  try {
    console.log(`🗑️ Gitea 기존 '${REPO_NAME}' 저장소를 초기화하기 위해 삭제합니다...`);
    await callGitea(`/repos/${REPO_OWNER}/${REPO_NAME}`, { method: 'DELETE' });
  } catch (err) {
    // 무시
  }

  console.log(`📦 Gitea에 '${REPO_NAME}' 저장소를 새로 생성합니다.`);
  await callGitea('/user/repos', {
    method: 'POST',
    body: JSON.stringify({
      name: REPO_NAME,
      private: true,
      description: 'LinkedIn Clipper & Scraper Project Hub',
    }),
  });
  console.log(`✅ Gitea 저장소가 성공적으로 생성되었습니다.`);

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


    // 매칭 이슈 검색
    const matchedIssue = existingIssues.find((iss: any) => iss.title.startsWith(`[SCR-${group.id}]`));

    if (matchedIssue) {
      // 이슈 상태 동기화 (walkthrough가 있거나 100번 이하의 역사적 아티팩트는 closed, 그 외는 open)
      const state = (group.walkthroughFile || Number(group.id) <= 100) ? 'closed' : 'open';
      if (matchedIssue.body !== body || matchedIssue.state !== state) {
        console.log(`🔄 Gitea 이슈 업데이트: ${issueTitle}`);
        await callGitea(`/repos/${REPO_OWNER}/${REPO_NAME}/issues/${matchedIssue.number}`, {
          method: 'PATCH',
          body: JSON.stringify({ body, state }),
        });
      }
    } else {
      console.log(`➕ Gitea 신규 이슈 생성: ${issueTitle}`);
      await callGitea(`/repos/${REPO_OWNER}/${REPO_NAME}/issues`, {
        method: 'POST',
        body: JSON.stringify({
          title: issueTitle,
          body: body,
          assignees: [REPO_OWNER],
        }),
      });
      // 완료된 상태이거나 100번 이하인 경우 즉시 닫아줌
      if (group.walkthroughFile || Number(group.id) <= 100) {
        const freshIssuesRes = await callGitea(`/repos/${REPO_OWNER}/${REPO_NAME}/issues?state=all`);
        const freshIssues = await freshIssuesRes.json();
        const createdIssue = freshIssues.find((iss: any) => iss.title.startsWith(`[SCR-${group.id}]`));
        if (createdIssue) {
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

// Vikunja 프로젝트 및 칸반 카드 동기화
async function syncVikunja(groups: ArtifactGroup[]) {
  console.log('\n🎯 Vikunja 아티팩트 동기화 진행 중...');

  // 1. 프로젝트 확인 및 생성
  const projectsRes = await callVikunja('/projects');
  const projects = projectsRes.status === 200 ? await projectsRes.json() : [];
  let project = projects.find((p: any) => p.title === REPO_NAME);

  if (project) {
    console.log(`🗑️ Vikunja 기존 '${REPO_NAME}' 프로젝트를 초기화하기 위해 삭제합니다...`);
    await callVikunja(`/projects/${project.id}`, { method: 'DELETE' });
  }

  console.log(`📦 Vikunja에 '${REPO_NAME}' 프로젝트를 새로 생성합니다.`);
  const newProjRes = await callVikunja('/projects', {
    method: 'PUT',
    body: JSON.stringify({ title: REPO_NAME }),
  });
  project = await newProjRes.json();
  console.log(`✅ Vikunja 프로젝트가 생성되었습니다.`);

  const projectId = project.id;

  // 2. 표준 칸반 버킷 구성 확인 및 생성
  const bucketsRes = await callVikunja(`/projects/${projectId}/buckets`);
  let buckets = bucketsRes.status === 200 ? await bucketsRes.json() : [];

  const requiredBucketNames = ['Planned', 'In Progress', 'Done'];
  const bucketMap: { [name: string]: number } = {};

  for (const name of requiredBucketNames) {
    let bucket = buckets.find((b: any) => b.title === name);
    if (!bucket) {
      console.log(`🏗️  Vikunja 버킷 생성: ${name}`);
      const newBucketRes = await callVikunja(`/projects/${projectId}/buckets`, {
        method: 'PUT',
        body: JSON.stringify({ title: name }),
      });
      bucket = await newBucketRes.json();
    }
    bucketMap[name] = bucket.id;
  }

  // 3. 기존 태스크 목록 가져오기
  const tasksRes = await callVikunja(`/projects/${projectId}/tasks`);
  const existingTasks = tasksRes.status === 200 ? await tasksRes.json() : [];

  for (const group of groups) {
    const taskTitle = `[SCR-${group.id}] ${group.title}`;
    
    // 타스크 상태에 기반한 적절한 버킷 결정
    let targetBucketName = 'Planned';
    if (group.walkthroughFile || Number(group.id) <= 100) {
      targetBucketName = 'Done';
    } else if (group.taskFile) {
      targetBucketName = 'In Progress';
    }
    const targetBucketId = bucketMap[targetBucketName];

    // 대표 아티팩트의 설명/상세
    let description = `## Artifact Documentation (${group.id})\n\n`;
    if (group.planFile) description += `- Plan: \`${group.planFile}\`\n`;
    if (group.taskFile) description += `- Task: \`${group.taskFile}\`\n`;
    if (group.walkthroughFile) description += `- Walkthrough: \`${group.walkthroughFile}\`\n`;

    const artifactsDir = path.join(process.cwd(), 'docs/artifacts');
    const targetFile = group.walkthroughFile || group.planFile || group.taskFile;
    let fileContent = '';
    if (group.virtualContent) {
      fileContent = group.virtualContent.walkthrough || group.virtualContent.plan || group.virtualContent.task || '';
    }
    if (!fileContent && targetFile && !targetFile.startsWith('(Archived')) {
      fileContent = fs.readFileSync(path.join(artifactsDir, targetFile), 'utf8');
    }

    if (fileContent) {
      description += `\n\n### 🔍 핵심 요약 및 내용 (${targetFile})\n\n\`\`\`markdown\n`;
      description += fileContent.length > 3000 ? fileContent.substring(0, 3000) + '\n\n...(본문 중략)...' : fileContent;
      description += `\n\`\`\``;
    }



    const matchedTask = existingTasks.find((t: any) => t.title.startsWith(`[SCR-${group.id}]`));

    if (matchedTask) {
      // 정보 업데이트 및 버킷 이동
      if (matchedTask.bucket_id !== targetBucketId || matchedTask.description !== description) {
        console.log(`🔄 Vikunja 태스크 업데이트 및 버킷 이동 (${targetBucketName}): ${taskTitle}`);
        await callVikunja(`/tasks/${matchedTask.id}`, {
          method: 'POST',
          body: JSON.stringify({
            bucket_id: targetBucketId,
            description: description,
          }),
        });
      }
    } else {
      // 신규 태스크 생성
      console.log(`➕ Vikunja 신규 태스크 생성 (${targetBucketName}): ${taskTitle}`);
      await callVikunja(`/projects/${projectId}/tasks`, {
        method: 'PUT',
        body: JSON.stringify({
          title: taskTitle,
          description: description,
          bucket_id: targetBucketId,
        }),
      });
    }
  }

  console.log('✅ Vikunja 아티팩트 동기화 완료!');
}

async function main() {
  console.log('🚀 PMS 동기화 유틸리티를 시작합니다.');
  const groups = scanArtifacts();
  console.log(`📊 발견된 아티팩트 그룹 개수: ${groups.length}개`);
  
  if (groups.length === 0) {
    console.log('ℹ️  동기화할 아티팩트가 없습니다.');
    return;
  }

  try {
    await syncGitea(groups);
    await syncVikunja(groups);
    console.log('\n🎉 모든 PMS 아티팩트 동기화가 안전하게 종료되었습니다.');
  } catch (error) {
    console.error('\n❌ PMS 동기화 중 오류 발생:', error);
    process.exit(1);
  }
}

main();
