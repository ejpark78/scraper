# 📋 108-reorganize-docker-scripts.task.md

이 문서는 `scripts/` 디렉토리를 `docker/` 및 `.agents/scripts/`로 분리/통합하는 작업에 대한 수행 체크리스트입니다.

---

## 🏁 Task List

- [x] **물리적 파일 이동 및 디렉토리 분리**
  - [x] `scripts/environments.mk` ➡️ `docker/environments.mk`
  - [x] `scripts/utils/docker.mk` ➡️ `docker/docker.mk`
  - [x] `scripts/utils/mongo.mk` ➡️ `docker/infra/mongodb/mongo.mk`
  - [x] `scripts/utils/meili.mk` ➡️ `docker/infra/meilisearch/meili.mk`
  - [x] `scripts/utils/browser.mk` ➡️ `docker/browser.mk`
  - [x] `scripts/tools/tools.mk` ➡️ `docker/tools/tools.mk`
  - [x] `scripts/agents/*` ➡️ `.agents/scripts/*`
  - [x] 기존 `scripts/` 디렉토리 완전 삭제

- [x] **설정 파일 경로 수정 및 연동**
  - [x] 루트 [Makefile](file:///Users/ejpark/workspace/scraper/Makefile) 내 `include` 및 `-f` 메이크 지시자 경로 최신화
  - [x] [.agents/scripts/agents.mk](file:///Users/ejpark/workspace/scraper/.agents/scripts/agents.mk) 내부 셸 스크립트 실행 경로 최신화
  - [x] [.agents/scripts/commit-changes.sh](file:///Users/ejpark/workspace/scraper/.agents/scripts/commit-changes.sh) 내 `review-changes.sh` 탐색/실행 경로 최신화

- [x] **기능 및 동작 검증**
  - [x] `make agents-usage` 명령어 실행 테스트 및 검증 완료
  - [ ] 작업 완료 후 Git 로컬 커밋 수행 (`make agents-commit`)
