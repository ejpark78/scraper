# 리뷰 문서: commit-changes.sh 내 자동 머지 기본값 설정 (097-set-merge-as-default-in-commit-changes.review.md)

## 1. 개요
- **작업명**: commit-changes.sh 내 자동 머지 기본값 설정
- **작업자**: Antigravity
- **리뷰 대상 파일**:
  - `scripts/agents/commit-changes.sh`
  - `AGENTS.md`

## 2. 변경 전/후 비교
### 변경 전
- `commit-changes.sh`: `--merge` 인자가 주어질 때만 `AUTO_MERGE=true`로 동작하고, 기본값은 `false`였습니다.
- `AGENTS.md`: 머지를 편하게 하려면 `commit-changes.sh --merge` 옵션을 붙여 실행하도록 가이드하고 있었습니다.

### 변경 후
- `commit-changes.sh`: `AUTO_MERGE` 기본값을 `true`로 설정합니다. `--no-merge` 인자가 주어지면 `AUTO_MERGE=false`로 꺼집니다.
- `AGENTS.md`: 작업 완료 후 원래 기준 브랜치로 자동 복원 및 머지 처리가 기본으로 동작함을 알리고, 커밋만 하려는 경우 `commit-changes.sh --no-merge` 형태로 실행하라는 지침을 추가하여 설명의 정합성을 맞췄습니다.
