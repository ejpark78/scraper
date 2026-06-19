# Code Review: decouple-fe-be-services (Bugfix)

본 리뷰는 `docs/plans/decouple-fe-be-services.md` 계획서에 따라 진행되었으며, 웹 프론트엔드(Vite)와 백엔드 API/MCP 서버 간의 물리적 디커플링(Decoupling) 및 `src/` 구조 개편에 따른 TypeScript 컴파일 참조 오류 해결(Bugfix) 상태를 검증합니다.

---

## 1. Safety & Infrastructure Checks
- [x] **No Host Port Access**: 변경된 도커파일은 프론트엔드 빌드 단계를 걷어낸 것으로 포트 할당이나 네트워크 노출과 무관합니다.
- [x] **Docker Network Usage**: 동일하게 컨테이너 네트워크에 속합니다.
- [x] **Connection Leak Prevention**: 커넥션 핸들러의 수정이 없으므로 누수 위험이 없습니다.
- [x] **Credentials Safe**: `.env`나 민감 자격증명이 노출되지 않았습니다.

---

## 2. Engineering & Architecture Checks
- [x] **Strict Typing**: 코드 파일 수정 중 TypeScript의 상대 참조가 정상화되어 `TSError` 없이 정상 컴파일됨을 검증했습니다.
- [x] **Centralized Config**: 백엔드는 정적 서빙 책임을 걷어내고 순수한 API 응답만 처리하게 아키텍처 역할이 고도화되었습니다.

---

## 3. 검증 내역 (Verification Details & Bugfixes)
- **`[Bugfix]` TypeScript Imports 정합성 해결**:
  - `mcp-entry.ts`, `server.ts`, `mcp.ts` 가 `src/` 디렉토리 하위로 이동하면서 망가졌던 database 및 config 상대 경로 임포트(`../database/mongo`, `../core/SiteRegistry` 등)를 올바르게 일괄 수정하여 `TSError`를 해결했습니다.
- **`[Bugfix]` ts-node 프로젝트 경로 보강**:
  - `apps/viewer/docker/compose.yml` 에서 `ts-node` 구동 시 tsconfig.json을 로드하도록 `--project /app/tsconfig.json` 매개변수를 추가하여 글로벌 Node API(`process`, `console` 등)가 정상 감지되도록 수정했습니다.
- **`apps/viewer/docker/api/Dockerfile` & `apps/viewer/docker/mcp/Dockerfile`**:
  - `src/frontend` 디렉토리를 복사하여 `npm run build`를 수행하던 종속 단계가 완벽히 삭제되었음을 확인했습니다.
  - 이로써 백엔드 서비스의 이미지 용량 및 빌드 타임이 대폭 최적화되었습니다.
- **`apps/viewer/src/api/server.ts`**:
  - `express.static`을 활용해 프론트엔드 번들(`dist` 폴더)을 배포(서빙)하던 31번 라인 레거시가 깔끔하게 삭제되었음을 확인했습니다.

---

## 4. 종합 의견 (Conclusion)
* 이미 Traefik의 서브도메인 라우팅에 의해 독립 분할되어 있던 인프라 설계에 맞춰, 소스 및 빌드 차원에서도 프론트엔드와 백엔드가 완전히 디커플링되었습니다.
* 특히 `src/` 구조 리팩토링 후 빌드 실패(Unhealthy)의 원인이었던 상대 경로 컴파일 장애가 정상 교정(Bugfix)되었음을 최종 교차 검증했습니다.
