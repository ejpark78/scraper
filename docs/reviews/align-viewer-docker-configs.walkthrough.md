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
