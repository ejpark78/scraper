# Summary: 005-align-viewer-docker-configs

> Squashed from: 005-align-viewer-docker-configs.review.md 005-align-viewer-docker-configs.task.md 005-align-viewer-docker-configs.walkthrough.md

---

## Review

# Code Review: align-viewer-docker-configs

본 리뷰는 `docs/plans/align-viewer-docker-configs.md` 계획서에 따라 진행되었으며, `viewer-fe` 서비스의 빌드 컨텍스트 통일 및 `apps/viewer`가 `src/` 구조로 재배치됨에 따른 Dockerfile 복사 경로, 패키지 엔트리포인트 및 셸 스크립트 경로 최적화 상태를 검증합니다.

---

## 1. Safety & Infrastructure Checks
- [x] **No Host Port Access**: 변경된 사항은 도커 빌드 경로 및 소스 디렉토리 지참에 국한되며 포트 맵이나 호스트 노출과 무관합니다.
- [x] **Docker Network Usage**: 동일하게 컨테이너 네트워크에 속합니다.
- [x] **Connection Leak Prevention**: 데이터베이스 관련 로직 자체의 수정이 없으므로 누수 위험이 없습니다.
- [x] **Credentials Safe**: `.env`나 민감 자격증명이 노출되지 않았습니다.

---

## 2. Engineering & Architecture Checks
- [x] **Strict Typing**: TypeScript 코드의 논리적 수정이 아니므로 타입 시스템에 영향이 없습니다.
- [x] **Centralized Config**: 프로젝트 빌드 모듈 기준(`context: ..`)으로 구성하여 빌드 일관성이 향상되었습니다.

---

## 3. 검증 내역 (Verification Details)
- **`apps/viewer/package.json`**:
  - `main` 및 `start`, `mcp` 스크립트가 `src/api/server.ts` 및 `src/mcp/mcp-entry.ts`로 갱신되었습니다.
- **`apps/viewer/docker/compose.yml`**:
  - `viewer-fe` 서비스의 `context`가 `..`로, `dockerfile`이 `docker/fe/Dockerfile`로 변경되었습니다.
  - `viewer-api` 및 `viewer-mcp` 서비스의 구동 `command`가 `src/` 하위의 정확한 경로로 변경되었습니다.
- **`apps/viewer/docker/fe/Dockerfile`**:
  - `src/frontend/...` 경로로 단축되어 빌드가 수행되도록 갱신되었습니다.
- **`apps/viewer/docker/api/Dockerfile` & `apps/viewer/docker/mcp/Dockerfile`**:
  - `frontend` 복사 및 빌드 명령어가 `src/frontend`로 변경되고, 각각 `CMD` 엔트리포인트가 알맞게 갱신되었습니다.

---

## 4. 종합 의견 (Conclusion)
* `apps/crawler` 모듈 도커 사양에 맞춰 `apps/viewer` 하위 빌드 컨텍스트와 컴포즈 파일의 커맨드 구조가 일관되게 단축 및 통일되었습니다.
* `src/` 구조 및 `src/frontend` 디렉토리 개편에 따른 참조 소스 경로가 모든 Dockerfile에서 정확하게 갱신되었음을 최종 교차 검증했습니다.

---

## Task

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

---

## Walkthrough

# Walkthrough: align-viewer-docker-configs

`apps/viewer/docker/` 아래의 빌드 일관성을 `apps/crawler/` 스타일로 정렬 조정하고 `src/` 구조 개편에 맞춰 경로를 최적화한 변경 결과 보고서입니다.

## 변경 결과 요약

### 1. 설정 및 Dockerfile 경로 최적화
- `apps/viewer/package.json` 에서 실행 진입 스크립트 경로 갱신.
- `apps/viewer/docker/compose.yml` 에서 `viewer-fe` 서비스의 빌드 속성을 `context: ..`, `dockerfile: docker/fe/Dockerfile` 로 업데이트하고, `viewer-api` 및 `viewer-mcp` 구동 `command` 경로 최적화.
- 3개 Dockerfile (`fe/Dockerfile`, `api/Dockerfile`, `mcp/Dockerfile`)에서 `src/frontend/...` 경로 갱신 및 CMD 엔트리포인트 최종 보정 완료.

### 2. 관련 문서 작성
- [Plan](file:///home/ejpark/workspace/scraper/docs/plans/align-viewer-docker-configs.md)
- [Review](file:///home/ejpark/workspace/scraper/docs/reviews/align-viewer-docker-configs.md)
- [Task List](file:///home/ejpark/workspace/scraper/docs/reviews/align-viewer-docker-configs.task.md)

---

## 검증 (Verification)
- `docker compose --profile viewer config` 설정을 검증하여 정상 분석되는지 확인.
- `docker compose --profile viewer build` 빌드를 수행하여 Vite 프론트엔드가 오류 없이 빌드되는지 확인.
  - [x] config 및 빌드 검증 성공

---

