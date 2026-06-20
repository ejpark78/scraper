# Task List: align-viewer-docker-configs

- [x] `docs/plans/align-viewer-docker-configs.md` 계획서 작성
- [x] `apps/viewer/package.json` entrypoint 및 scripts 경로 수정
- [x] `apps/viewer/docker/compose.yml` 에서 `viewer-fe` 서비스 빌드 속성 및 `viewer-api`/`viewer-mcp` 커맨드 경로 수정
- [x] `apps/viewer/docker/fe/Dockerfile` 에서 `src/frontend` 경로 갱신
- [x] `apps/viewer/docker/api/Dockerfile` 에서 `src/frontend` 및 CMD 경로 갱신
- [x] `apps/viewer/docker/mcp/Dockerfile` 에서 `src/frontend` 및 CMD 경로 갱신
- [ ] 신규 viewer config 검증 (`docker compose config`)
- [ ] 신규 viewer build 검증 (`docker compose build`)
- [ ] `docs/reviews/align-viewer-docker-configs.md` 리뷰 문서 작성
- [ ] Git commit 수행 (`scripts/agents/commit-changes.sh`)
