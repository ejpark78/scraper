# Task List: relocate-agents-tooling

- [x] `docs/plans/relocate-agents-tooling.md` 계획서 작성
- [x] 신규 `apps/agents/` 디렉토리 생성 및 파일들 이동
- [x] `apps/agents/tsconfig.json` 신규 생성
- [x] `apps/agents/rules.ts` 경로 정합성 수정
- [x] `apps/agents/sessions.ts` 경로 정합성 수정
- [x] `scripts/utils/agents.mk` 실행 스크립트 타겟 경로 갱신
- [x] 레거시 `apps/crawler/src/tools/agents/` 디렉토리 삭제
- [x] **[Bugfix]** `apps/agents/tsconfig.json` 에 node types 명시 추가
- [x] **[Bugfix]** `agents.mk` 내 ts-node 실행 시 tsconfig 명시적 로딩 처리
- [x] `make agents-dump` 정상 실행 및 검증 (성공)
- [x] `docs/reviews/relocate-agents-tooling.md` 리뷰 문서 작성
- [ ] Git commit 수행 (`scripts/agents/commit-changes.sh`)
