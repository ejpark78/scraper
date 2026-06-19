# Task List: remove-workspace-mount

- [x] `docs/plans/remove-workspace-mount.md` 계획서 작성
- [x] 모든 사이트 스크립트 실행 Makefile(`scripts/sites/*.mk`)의 `docker compose run` 구문에서 `$(WORKSPACE_MOUNT)` 옵션 제거 완료 (9개 파일)
- [x] `scripts/environments.mk` 상의 `WORKSPACE_MOUNT` 변수 정의부 제거 완료
- [x] **[Bugfix]** `apps/crawler/tsconfig.json` 에 독립 컴파일 설정 내장화 완료 (extends 해제 및 types 보강)
- [x] **[Bugfix]** `cli-list.ts` 내부 `pathMap` 레거시 중간 경로(`/crawler/`) 일괄 제거 완료
- [x] **[Bugfix]** `gpters` List.ts 소스의 BaseListService 상대 경로 복구 완료
- [x] **[Bugfix]** `BaseListService.ts` 내 데이터베이스 모듈 임포트 상대 경로 복구 완료
- [x] **[Bugfix]** 전수조사(Audit)를 통하여 발견된 18개 소스 파일들의 레거시 상대 경로 임포트(`database`, `config`, `utils` 관련) 일괄 교정 완료
- [ ] `make list` 정상 실행 및 검증
- [ ] `docs/reviews/remove-workspace-mount.md` 리뷰 문서 작성
- [ ] Git commit 수행 (`scripts/agents/commit-changes.sh`)
