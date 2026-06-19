# Task List: move-ebook-docker-configs

- [x] `docs/plans/move-ebook-docker-configs.md` 계획서 작성
- [x] `apps/ebook/docker/Dockerfile` 신규 생성 (이관)
- [x] `apps/ebook/docker/compose.yml` 신규 생성 (이관)
- [x] `apps/crawler/docker/worker/compose.yml` 에서 `ebook` 서비스 선언 제거
- [x] 기존 `apps/crawler/docker/worker/ebook` 디렉토리 삭제
- [x] 신규 compose config 검증 (`docker compose config` 완료)
- [x] `docs/reviews/move-ebook-docker-configs.md` 리뷰 문서 작성
- [ ] Git commit 수행 (`scripts/agents/commit-changes.sh`)
