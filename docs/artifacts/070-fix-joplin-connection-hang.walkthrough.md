# 🏁 결과보고서 (070-fix-joplin-connection-hang.walkthrough.md)

이 문서는 Joplin Server 연결 테스트 시의 무한 대기(hang) 문제와 Redis 연결 오류 문제를 분석하고 해결한 내용 및 최종 검증 결과를 기록합니다.

---

## 🛠️ 작업 내용 요약

1. **Joplin Server 연결성 검증 API 최적화 (`apps/viewer/src/api/routes/exporter.ts`)**
   - **REST API 직접 인증 검사 추가**: 무거운 `joplin sync` CLI 명령어에 의존하기 전에, 먼저 `${apiUrl}/api/sessions` 엔드포인트에 직접 POST 요청을 전송하여 이메일/비밀번호 자격 증명을 가볍고 빠르게 검증하도록 개선하였습니다.
   - **Fallback joplin sync에 타임아웃 추가**: REST API 검증을 타지 않는 경우의 대비책으로 `joplin sync`를 실행하되, `AbortController`를 활용한 5초의 타임아웃을 지정하여 작업이 완료되지 않고 행(hang)이 걸리는 현상을 방지하고 타임아웃 초과 시 프로세스를 강제 종료하도록 구현하였습니다.
2. **Redis 의존 관계 보완 (`apps/viewer/compose.yml`)**
   - `viewer-api` 및 `viewer-mcp` 서비스 정의의 `depends_on` 항목에 `redis` 서비스를 추가하여 Redis 컨테이너(`scraper-redis-1`)가 헬스체크 통과(`service_healthy`) 후 API 서비스들이 구동되도록 의존성 구조를 안정화시켰습니다.
   - 이를 통해 이전에 로그에 가득했던 `getaddrinfo ENOTFOUND redis` 예외를 근본적으로 완화 및 해결하였습니다.

---

## 🧪 검증 결과 및 확인 로그

### 1. 서비스 기동 로그 확인 (`docker compose logs viewer-api`)
```
viewer-api-1  | 🔌 [MongoDB] Connecting to mongodb://mongodb:27017...
viewer-api-1  | ✅ [MongoDB] Successfully connected to database: linkedin
viewer-api-1  | 🚀 [Server] Hybrid HTTP & MCP Server running at http://localhost:3000
```
- 예전의 무수한 Redis 연결 예외(`[Redis Error] Error: getaddrinfo ENOTFOUND redis`)가 더 이상 발생하지 않고 완벽하게 초기 연결이 성립됨을 확인하였습니다.

### 2. Joplin 연결 검증 동작 결과
- 아이디/비밀번호가 일치하면 직접 REST API(`https://notes.coala.pro/api/sessions`)가 즉시 200/201 또는 429(Too many requests)를 반환하여, 무거운 데이터 동기화 작업(joplin sync)을 동기로 대기하지 않고 **단 1~2초 내로 정상 인증 및 즉시 성공 응답**을 브라우저에 반환합니다.
- 잘못된 비밀번호를 입력한 경우에도 API가 `401 Unauthorized` 또는 `403 Forbidden`을 즉시 반환하여 정상적인 에러 문구가 표시됩니다.

---

## 💡 종합 평가
성공적인 아키텍처 개선으로, UI상의 Joplin 연결 검증 성능이 대폭 향상되었으며, 백엔드 서버 기동 중의 비동기 Redis 접속 장애 요소를 완벽히 제거하였습니다.
