# 할 일 목록: commit-changes.sh 내 자동 머지 기본값 설정 (097-set-merge-as-default-in-commit-changes.task.md)

## 📌 할 일 목록 (Todo List)
- [x] 작업 착수 및 승인 획득
- [x] `commit-changes.sh` 수정
  - [x] `AUTO_MERGE` 기본값을 `true`로 설정
  - [x] 인자 파싱 시 `--no-merge`를 만나면 `AUTO_MERGE=false`로 토글하도록 로직 변경
- [x] `AGENTS.md` 수정
  - [x] 기본값 설정 및 `--no-merge` 안내 보완
- [x] 검증 및 실행 (`scripts/agents/commit-changes.sh --no-merge`)
