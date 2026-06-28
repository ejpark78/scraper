# 🏁 작업 목록: Gitea 이슈 기반 문서화 수명 주기 전환 (113-transition-to-gitea-issues.task.md)

- [ ] 로컬 Git 저장소의 Gitea 원격지 등록 및 연동 (`git remote add gitea`)
- [ ] `.agents/rules/documentation_lifecycle.md` 규칙 내용 개정 (로컬 아티팩트 관리 정책 폐지 및 Gitea 이슈 기반 프로세스 수립)
- [ ] `AGENTS.md` 제약 사항 2번(계획 수립 및 자율 실행) 수정
- [ ] 초기 아티팩트 데이터를 Gitea 이슈로 동기화 (`sync-pms.ts --reset` 실행)
- [ ] 작업 완료 후 Git 커밋 실행 (`commit-changes.sh`)
