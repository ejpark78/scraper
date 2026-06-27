# 리뷰 문서: commit-changes.sh 내 자동 머지(--merge) 기능 도입 (096-auto-merge-commit-changes.review.md)

## 1. 개요
- **작업명**: commit-changes.sh 내 자동 머지(--merge) 기능 도입
- **작업자**: Antigravity
- **리뷰 대상 파일**:
  - `scripts/agents/commit-changes.sh`
  - `AGENTS.md`

## 2. 변경 전/후 비교
### 변경 전
- `commit-changes.sh`: 단순 커밋만 수행하고 현재 브랜치에 그대로 머무릅니다. 머지 및 원래 브랜치로 복귀하는 절차는 에이전트가 별도의 쉘 명령어로 승인받아 수동 진행해야 했습니다.
- `AGENTS.md`: 작업 완료 후 기준 브랜치(`develop`)로 돌아가 머지하도록 지시하고 있으나, 스크립트 기반 연동 가이드는 부재했습니다.

### 변경 후
- `commit-changes.sh`: 스크립트 최상단에서 `--merge` 옵션을 감지하는 플래그를 처리합니다. 커밋이 완료된 후 `--merge` 플래그가 참이면 자동으로 `git checkout develop && git merge <피처브랜치>`를 수행하여 머지 파이프라인을 자동화합니다.
- `AGENTS.md`: 작업 완료 후 최종 머지 시 `commit-changes.sh --merge` 옵션을 활용하도록 명문화하여 에이전트의 불필요한 수동 쉘 승인 요구 횟수를 최소화합니다.
