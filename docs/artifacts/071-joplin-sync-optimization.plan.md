# 📋 작업 계획서: Joplin CLI 동기화 속도 개선 및 진행 상황 실시간 스트리밍 구현 (071-joplin-sync-optimization.plan.md)

이 문서는 Joplin CLI 동기화가 너무 오래 걸리고 진행 상황을 알 수 없었던 문제를 근본적으로 해결하기 위해, 프로필 영구 디렉토리 매핑과 진행률 실시간 스트리밍(ReadableStream)을 구현하기 위한 설계 및 계획을 수립합니다.

---

## 1. 🔍 상세 설계 및 개선 방향

### 개선 1: Joplin 프로필 디렉토리 영구 저장소 매핑 (속도 개선)
- **기존 방식**: `HOME` 환경 변수를 `/tmp`로 임시 지정하여, 컨테이너 재부팅이나 주기적 정리 시 Joplin CLI 로컬 DB 및 리소스 데이터가 휘발되어 매번 전량 다운로드가 일어남.
- **변경 방식**: `HOME` 환경 변수를 볼륨이 보장되는 디렉토리인 `/app/data/.joplin_profile`로 변경합니다.
- **효과**: 최초 동기화(Full Sync) 이후에는 **변경된 증분 데이터만 매우 빠르게 동기화(Incremental Sync)**되어 속도가 극대화됩니다.

### 개선 2: HTTP POST ReadableStream 기반 실시간 로그 스트리밍 (진행 상황 조회)
- **기존 방식**: 전체 `joplin sync` 및 `joplin export` 완료 시점까지 단일 POST 요청이 차단(Blocking)되어 진행률을 알 수 없음.
- **변경 방식**: `/api/exporter/joplin/cli-sync/stream` POST API를 신설하여, 클라이언트와 연결을 유지한 상태에서 작업이 진행될 때마다 진행 로그를 청크(chunk) 단위로 스트리밍 송신합니다.
  - 응답 헤더 설정: `Content-Type: text/event-stream` 또는 `Transfer-Encoding: chunked` 적용.
- **실시간 프로세스 파이핑 (`child_process.spawn`)**:
  - `execAsync` 대신 `spawn`을 사용하여 `joplin sync` 명령어의 콘솔 출력을 실시간으로 읽어와 클라이언트에 실시간으로 푸시합니다.

### 개선 3: 프론트엔드 UI 연동 개선
- `apps/viewer/src/frontend/src/views/ExternalView.vue` 파일에서 동기화 요청 시, `fetch` API의 `response.body.getReader()`를 활용하여 스트리밍 데이터를 받음과 동시에 화면 로그 창에 즉각 렌더링하도록 수정합니다.

---

## 📝 상세 작업 목록 (Tasks)

1. **Joplin 환경 변수 설정 통합 보완 (`apps/viewer/src/api/routes/exporter.ts`)**
   - `HOME` 디렉토리를 `/app/data/.joplin_profile`로 지정하고 해당 디렉토리가 없는 경우 노드 실행 시 자동 생성되도록 보완합니다.
2. **실시간 스트리밍 API 신설 (`apps/viewer/src/api/routes/exporter.ts`)**
   - `/api/exporter/joplin/cli-sync/stream` 라우터 등록.
   - `spawn`을 활용해 `joplin sync`, `joplin ls`, `joplin export`를 수행하며 진행 사항을 `res.write()`로 청크 단위 응답 스트리밍.
3. **프론트엔드 Vue 컴포넌트 수정 (`apps/viewer/src/frontend/src/views/ExternalView.vue`)**
   - `syncJoplinCli()` 함수가 `/api/exporter/joplin/cli-sync/stream`을 호출하고 `ReadableStream` 리더를 사용해 실시간 로그를 한 줄씩 받아서 로그 화면에 실시간 추가하도록 변경.
4. **빌드, 실행 및 최종 결과 검증**
5. **결과보고서(`.walkthrough.md`) 작성 및 변경 이력 Commit**

---

## 🛡️ 안정성 및 품질 가이드라인
- `process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'` 설정을 동일하게 상속하여 사설 Joplin Server SSL 연동 호환성을 유지합니다.
- 스트리밍 응답이 도중에 끊어지거나 에러가 나더라도 `res.end()`를 통해 HTTP 연결이 영구히 대기 상태에 머물지 않도록 `finally` 예외 처리를 엄격히 적용합니다.
