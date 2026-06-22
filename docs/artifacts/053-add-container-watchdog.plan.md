# 📋 계획서: 컨테이너 와치독 및 하트비트 헬스체크 추가 계획 (053-add-container-watchdog.plan.md)

## 1. 🔍 문제 정의 및 분석
- **현상**: Scraper 등 워커 컨테이너가 락(Lock) 상태이거나 비정상 대기 상태일 때, 기존 `pgrep` 기반 헬스체크는 프로세스가 살아있는 한 `healthy`로 오판함.
- **해결 방안**:
  1. **하트비트 파일 기반 헬스체크**:
     - 워커 루프 실행 시 `/tmp/worker-heartbeat`와 같은 하트비트 파일을 터치하여 주기적으로 갱신.
     - Docker `healthcheck`에서 해당 파일의 최근 수정 시간(mtime)을 대조하여 비정상 대기 시 `unhealthy` 상태로 전이되도록 고도화.
  2. **Docker Autoheal (와치독) 도입**:
     - 헬스체크 상태가 `unhealthy`로 변경될 경우 자동으로 컨테이너를 재시작해주는 `autoheal` 서비스를 구성하여 무중단 복구 메커니즘 구축.

---

## 🛠️ 세부 변경 계획

### 1. `autoheal` 서비스 구성
- 파일 경로: `docker/infra/autoheal/compose.yml`
- 구성 내용: Docker 소켓을 마운트하여 컨테이너들의 헬스 상태를 감시하고, 라벨 `autoheal=true`를 가진 컨테이너가 `unhealthy`일 때 자동으로 재시작.
- 루트 `compose.yml`에 `docker/infra/autoheal/compose.yml` 추가.

### 2. 워커 코드에 하트비트 업데이트 적용
- **수정 파일**:
  - `apps/crawler/src/workers/ScraperWorker.ts`
  - `apps/crawler/src/workers/ConverterWorker.ts`
- **로직**:
  - 시작 시 및 루프의 매 이터레이션(또는 blpop 타임아웃 발생 시 포함)마다 하트비트 파일 `/tmp/scraper-heartbeat` / `/tmp/converter-heartbeat`를 갱신하는 헬퍼 함수 구현.

### 3. Docker Compose 헬스체크 스크립트 수정
- **수정 파일**: `apps/crawler/docker/worker/compose.yml`
- **내용**:
  - `scraper` 및 `converter`의 `healthcheck.test`를 `pgrep` 대신 하트비트 파일의 갱신 여부를 판별하는 쉘 명령어로 교체.
  - autoheal 활성화를 위해 `labels: { autoheal: "true" }` 추가.

---

## 📂 수정 대상 파일 목록
1. [compose.yml](file:///home/ejpark/workspace/scraper/compose.yml) (루트 compose 수정)
2. `docker/infra/autoheal/compose.yml` (신규 작성)
3. [apps/crawler/docker/worker/compose.yml](file:///home/ejpark/workspace/scraper/apps/crawler/docker/worker/compose.yml) (라벨 및 헬스체크 수정)
4. [ScraperWorker.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/workers/ScraperWorker.ts) (하트비트 로직 구현)
5. [ConverterWorker.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/workers/ConverterWorker.ts) (하트비트 로직 구현)

---

## 🧪 검증 계획
1. 소스 코드 수정 후 타입 검사 수행.
2. `docker compose`로 autoheal 및 하트비트 헬스체크 적용 후 컨테이너 구동 여부 확인.
3. 임의로 컨테이너 내부의 하트비트 파일 갱신을 멈추어(예: 프로세스 일시중단) `unhealthy` 판정 및 자동 재시작이 동작하는지 테스트.
