# Walkthrough: decouple-fe-be-services

프론트엔드와 백엔드를 완전히 디커플링하여 불필요한 빌드 종속성을 제거하고, `src/` 구조 개편에 따른 TypeScript 임포트 및 컴파일 장애를 해결(Bugfix)한 변경 결과 보고서입니다.

## 변경 결과 요약

### 1. 백엔드 이미지 빌드 최적화
- `apps/viewer/docker/api/Dockerfile` 에서 프론트엔드 복사 및 빌드 레이어 제거 완료.
- `apps/viewer/docker/mcp/Dockerfile` 에서 프론트엔드 복사 및 빌드 레이어 제거 완료.

### 2. 소스 코드 분리 및 임포트 해결 (Bugfix)
- `apps/viewer/src/api/server.ts` 에서 `frontend/dist` 정적 호스팅 코드 삭제 완료.
- `mcp-entry.ts`, `server.ts`, `mcp.ts` 의 database 및 config 모듈 상대 임포트 경로 교정 완료.
- `apps/viewer/docker/compose.yml` 에서 `ts-node` 구동 시 tsconfig.json을 로드하도록 `--project` 옵션 추가 완료.

### 3. 관련 문서 작성
- [Plan](file:///home/ejpark/workspace/scraper/docs/plans/decouple-fe-be-services.md)
- [Review](file:///home/ejpark/workspace/scraper/docs/reviews/decouple-fe-be-services.md)
- [Task List](file:///home/ejpark/workspace/scraper/docs/reviews/decouple-fe-be-services.task.md)

---

## 검증 (Verification)
- `docker compose --profile viewer config` 설정을 검증하여 정상 분석되는지 확인.
- `docker compose --profile viewer build` 빌드를 수행하여 프론트엔드 종속성 없이 컴파일 및 빌드가 빠르게 성공하는지 확인.
  - [x] config 및 빌드 검증 성공
