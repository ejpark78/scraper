import { execSync } from 'child_process';

function runCmd(cmd: string) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'inherit' });
  } catch (error: any) {
    console.error(`❌ 명령어 실행 실패: ${cmd}`);
    process.exit(1);
  }
}

function runCmdOutput(cmd: string): string {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error: any) {
    console.error(`❌ 명령어 실행 실패: ${cmd}`);
    process.exit(1);
  }
}

function main() {
  console.log('🚀 push-changes release sequence 시작...');

  // 로컬 Traefik 도메인 및 SSL 인증 에러 우회를 위한 로컬 바이패스 주입
  runCmd('git config http.sslVerify false');

  const currentBranch = runCmdOutput('git rev-parse --abbrev-ref HEAD');

  if (currentBranch !== 'develop') {
    console.log(`⚠️  WARNING: 현재 브랜치가 '${currentBranch}' 입니다 ('develop'이어야 함).`);
    console.log("   자동으로 'develop' 브랜치로 전환을 시도합니다...");

    const statusPorcelain = runCmdOutput('git status --porcelain');
    if (statusPorcelain) {
      console.error('❌ ERROR: 커밋되지 않은 변경 사항이 작업 디렉토리에 있습니다. 먼저 커밋하거나 Stash 하십시오.');
      process.exit(1);
    }

    runCmd('git checkout develop');
  }

  console.log("🚀 로컬 'develop' 브랜치를 origin에 push 중...");
  runCmd('git push origin develop');

  console.log("🔀 'develop' 변경 사항을 'main' 브랜치에 merge 중...");
  runCmd('git checkout main');

  try {
    runCmd('git merge develop');
  } catch (error) {
    console.error('❌ ERROR: 머지 충돌이 감지되었습니다! 원래의 develop 브랜치로 원복합니다.');
    runCmd('git merge --abort');
    runCmd('git checkout develop');
    process.exit(1);
  }

  console.log("🚀 로컬 'main' 브랜치를 origin에 push 중...");
  runCmd('git push origin main');

  console.log("🔙 'develop' 브랜치로 복귀 중...");
  runCmd('git checkout develop');

  console.log('🎉 main 및 develop 브랜치의 병합 및 원격지 push가 정상 완료되었습니다.');
}

main();
