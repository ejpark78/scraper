# 할 일 목록: commit-changes.sh 내 자동 머지(--merge) 기능 도입 (096-auto-merge-commit-changes.task.md)

## 📌 할 일 목록 (Todo List)
- [x] 작업 브랜치 생성 및 전환 (`feature/096-auto-merge-commit-changes`)
- [ ] `commit-changes.sh` 수정
  - [ ] 최상단 인자 파싱 처리 (`AUTO_MERGE` 변수)
  - [ ] `git commit` 완료 후 `develop` 체크아웃 및 머지 자동화 추가
  - [ ] 머지 충돌 감지 및 에러 핸들링
- [ ] `AGENTS.md` 수정
  - [ ] `commit-changes.sh --merge` 옵션 가이드를 브랜치 전략 규칙에 추가
- [ ] 검증 및 실행 (`scripts/agents/commit-changes.sh --merge`)
