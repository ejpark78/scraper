# 계획서: commit-changes.sh 내 자동 머지 기본값 설정 (097-set-merge-as-default-in-commit-changes.plan.md)

## 1. 목적 및 배경
피처 브랜치 작업이 완료된 후 `develop` 브랜치로 복귀하여 머지(merge)하는 프로세스는 항상 수행되는 고정적인 절차입니다. 따라서 기존의 `--merge` 옵션을 명시적으로 주지 않더라도 기본적으로 커밋 완료 후 자동 머지가 수행되도록 변경합니다. 대신 머지를 원치 않고 커밋만 수행하고 싶을 때를 대비해 `--no-merge` 옵션을 새로 제공합니다.

## 2. 관련 파일 및 변경 부분
- **[commit-changes.sh](../../scripts/agents/commit-changes.sh)**:
  - `AUTO_MERGE` 기본값을 `true`로 설정
  - 인자 파싱 시 `--no-merge`를 만나면 `AUTO_MERGE=false`로 토글하도록 로직 변경
- **[AGENTS.md](../../AGENTS.md)**:
  - `commit-changes.sh` 규칙에 기본 동작(자동 머지) 설명 및 필요한 경우 `--no-merge` 옵션을 사용하라는 지침으로 보완

## 3. 실행 단계 및 명령어 목록
1. **코드 수정**:
   - `commit-changes.sh` 및 `AGENTS.md` 수정
2. **검증 및 자동 커밋**:
   - 현재 브랜치(`develop`)에서 변경 사항을 커밋하고 안전하게 종료
     - 명령어 (사전 승인 스크립트): `scripts/agents/commit-changes.sh --no-merge` (develop 브랜치이므로 머지 대상이 아니며, 커밋만 수행)
