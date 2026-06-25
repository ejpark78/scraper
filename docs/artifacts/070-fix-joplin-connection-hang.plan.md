# 📋 작업 계획서: Joplin Server 연결 테스트 행(Hang) 해결 방안 (070-fix-joplin-connection-hang.plan.md)

이 문서는 `viewer-api` 컨테이너에서 Joplin Server(`https://notes.coala.pro`) 연결을 테스트할 때, 무한 대기(hang) 상태가 발생하는 문제를 분석하고 이를 해결하기 위한 구체적인 작업 계획을 수립합니다.

---

## 1. 🔍 문제 분석 및 원인 파악

### 현상
- 사용자가 Viewer 웹 인터페이스에서 Joplin Server 연결 테스트 시 `"🔗 Joplin Server(https://notes.coala.pro) 연결 테스트 시작..."` 로그만 표시되고 다음 단계로 진행되지 않음.
- 백엔드 컨테이너의 로그에는 요청을 받은 기록(`POST /api/exporter/joplin/cli-test`)이 누락되었거나 지연됨.

### 원인 분석
1. **`joplin sync` 명령어의 동기 방식 실행**:
   - `apps/viewer/src/api/routes/exporter.ts`의 `/joplin/cli-test` 엔드포인트는 Joplin CLI를 설정한 후 `execAsync('joplin sync')`를 동기적으로 실행합니다.
   - 인증 정보(ID/비밀번호)가 틀릴 경우 Joplin CLI는 즉시 실패하여 1초 이내에 결과를 반환하지만, **인증 정보가 올바를 경우 해당 계정의 전체 노트를 동기화(다운로드)하기 시작**합니다.
   - 동기화에 걸리는 시간은 노트의 양에 비례하므로(수십 초 ~ 수 시간), Express 서버의 HTTP 요청 처리 스레드를 점유하여 무한 대기(hang) 현상처럼 보이게 됩니다.
2. **Redis 연결 문제**:
   - `viewer-api` 컨테이너가 `redis` 호스트를 찾지 못하는 `getaddrinfo ENOTFOUND redis` 에러가 발생 중입니다. 
   - `apps/viewer/compose.yml`에는 `redis`에 대한 `depends_on` 또는 profile별 서비스 연결 구성이 누락되어 있습니다. 이 에러 자체는 애플리케이션 시작을 막지는 않지만 비동기적으로 에러를 지속 발생시킵니다.

---

## 2. 🛠️ 해결 방안

### 개선 1: `/api/exporter/joplin/cli-test` 연결 검증 방식 최적화
1. **REST API 직접 호출 검증 (우선 검증)**:
   - `joplin sync`를 실행하기 전에, 제공된 `apiUrl`의 `/api/sessions` 엔드포인트로 `fetch` POST 요청을 전송하여 이메일/비밀번호 인증을 먼저 수행합니다.
   - 응답 상태가 `200`/`201`이거나 rate limit 경고인 `429`일 경우, 서버가 살아있고 계정 정보가 유효한 것으로 판단합니다.
   - 잘못된 자격 증명(`401`/`403`)이 반환되면 즉시 에러 응답을 보냅니다.
2. **Joplin CLI Sync에 Timeout 적용 및 프로세스 강제 종료**:
   - API를 직접 호출할 수 없는 경우의 Fallback으로 `joplin sync`를 수행하되, Node.js `AbortController`를 사용하여 최대 **5초**의 타임아웃을 지정합니다.
   - 5초 이내에 완료되거나 인증 에러가 나면 처리하고, 5초 초과 시 동기화가 진행 중인 것으로 판단하여(계정 정보가 유효하여 다운로드를 시작한 상태) `AbortSignal`로 CLI 프로세스를 강제 종료하고 성공 처리합니다.

### 개선 2: Redis 연결 의존성 구성 보완
- `apps/viewer/compose.yml`의 `viewer-api` 및 `viewer-mcp` 서비스 정의 내에 `redis` 의존성이 누락되어 있으므로 이를 보완하거나, Docker 환경 설정에 맞춰 구성합니다.
  - 현재 root `compose.yml`에는 `docker/infra/redis/compose.yml`이 이미 include되어 있으며, `redis` 컨테이너가 실행되어 있습니다.
  - `viewer-api`가 Redis 컨테이너와 동일한 기본 네트워크(`scraper_default`)에 존재하므로, `depends_on` 관계를 설정하여 Redis 실행 순서를 보장합니다.

---

## 3. 📝 상세 작업 목록 (Tasks)

1. `apps/viewer/src/api/routes/exporter.ts` 파일의 `/joplin/cli-test` 라우트 핸들러를 수정합니다.
   - `/api/sessions` API 호출 검증 추가
   - `joplin sync` 프로세스 실행 시 `AbortController` 기반 5초 타임아웃 적용 및 타임아웃 시 프로세스 강제 종료(kill) 후 성공 응답 반환 로직 구현
2. `apps/viewer/compose.yml`을 수정하여 `viewer-api` 및 `viewer-mcp`에 `redis` 의존성 설정을 보완합니다.
3. 로컬에서 수정한 내용을 빌드하고 동작을 테스트합니다.
4. 작업 완료 후 결과보고서(`.walkthrough.md`)를 작성합니다.

---

## 4. ⚠️ 안전 조치 및 보안 가이드라인
- `NODE_TLS_REJECT_UNAUTHORIZED: '0'` 설정을 HTTP fetch 시에도 동일하게 적용하거나 글로벌하게 활성화하여 SSL 검증 우회를 유지합니다.
- 데이터의 변경이나 파괴 행위가 아니므로 DB 상태 안전 수칙에 위배되지 않습니다.
