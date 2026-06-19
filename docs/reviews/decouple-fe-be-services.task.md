# Task List: decouple-fe-be-services

- [x] `docs/plans/decouple-fe-be-services.md` 계획서 작성
- [x] `apps/viewer/docker/api/Dockerfile` 에서 프론트엔드 설치 및 빌드 단계 제거
- [x] `apps/viewer/docker/mcp/Dockerfile` 에서 프론트엔드 설치 및 빌드 단계 제거
- [x] `apps/viewer/src/api/server.ts` 에서 프론트엔드 `dist` 호스팅 레거시 코드 제거
- [x] **[Bugfix]** `mcp-entry.ts` 임포트 경로 교정
- [x] **[Bugfix]** `server.ts` 임포트 경로 교정
- [x] **[Bugfix]** `mcp.ts` 임포트 경로 교정
- [x] **[Bugfix]** `compose.yml` 커맨드에 tsconfig 매핑 추가
- [x] 신규 백엔드 컴포즈 구문 검증 (`docker compose config` 완료)
- [x] 신규 백엔드 이미지 빌드 검증 (`docker compose build` 완료)
- [x] 신규 컨테이너 실행 검증 (`docker compose up` 완료 - Healthy 검증 성공)
- [x] `docs/reviews/decouple-fe-be-services.md` 리뷰 문서 작성
- [x] Git commit 수행 (`scripts/agents/commit-changes.sh` 완료)
