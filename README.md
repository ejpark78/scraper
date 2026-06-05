# 🌐 LinkedIn Job & Company Clipper

> Playwright 기반 링크드인 채용 공고 및 회사 상세 프로필 백업, MongoDB/Redis 분산 파이프라인 수집, 마크다운 자동 변환, 동기화를 지원하는 TypeScript 엔터프라이즈 OOP 파이프라인

이 프로젝트는 링크드인(LinkedIn)의 채용 공고(Jobs) 및 회사 상세 정보(Company About) 페이지를 자동 수집하고 가공하여, 사람이 읽기 쉬운 표준 마크다운(Markdown) 문서로 정제하고 MongoDB에 완벽히 적재해 주는 강력한 자동화 도구입니다.

최근 클린 아키텍처 리팩토링 및 몽고디비/레디스 기반 실시간 비동기 아키텍처 개편을 거쳐 **100% TypeScript 객체 지향 프로그래밍(OOP)** 기반 구조로 전면 개편되었습니다. **템플릿 메서드 패턴(Template Method Pattern)**을 이용해 메인 루프를 추상화하였고, **제네릭 규격 인터페이스(IConverter<T>)** 적용, 그리고 **링크드인 도메인(`src/sites/linkedin`)**으로 통합하여 탄탄한 유지보수성을 제공합니다.

---

## ✨ 핵심 리팩토링 및 기능 (Key Features)

### 1. 클린 아키텍처 및 도메인 격리
* **🏢 코어 레이어 구축 (`src/core/`)**:
  * [BasePipeline.ts](file:///home/ejpark/workspace/linkedin/src/core/BasePipeline.ts): 시간 경과 로그, 수집 속도 기반 ETR(남은 시간) 계산, MongoDB/Redis 캐시 로드, 예외 처리 및 중단 핸들러를 캡슐화한 상위 추상 클래스입니다.
  * [IConverter.ts](file:///home/ejpark/workspace/linkedin/src/core/IConverter.ts): 메타데이터 객체를 생성하는 가공 파서와 Prettier 포맷터를 제네릭 구조로 인터페이스화하였습니다.
* **💼 링크드인 도메인 통합 (`src/sites/linkedin/`)**:
  * 채용 공고와 회사 상세 정보가 `src/sites/linkedin/` 폴더 하위로 통합되어 구조가 더 심플해지고 관리가 용이해졌습니다.

### 2. MongoDB & Redis 기반 분산 아키텍처 (New)
* **Bronze / Silver 2단계 데이터 파이프라인**:
  * **Bronze Layer**: 수집 대상의 원본(Raw) HTML을 그대로 MongoDB (`bronze.jobs`, `bronze.companies`)에 저장하여 영구 보존합니다.
  * **Silver Layer**: 정제된 핵심 메타데이터(제목, 회사명, 위치 등)만 추출 및 표준화하여 검색과 분석에 용이하게 MongoDB (`silver.jobs`, `silver.companies`)에 적재합니다.
* **실시간 추천 공고 파싱 & Redis 큐 적재 (Redis Worker)**:
  * 특정 채용공고의 상세 페이지 수집 완료 시, 페이지 내부의 추천 연관 공고들을 실시간 파싱하여 `bronze.job_urls`에 저장하고 타겟 국가 매칭 시 `jobs_queue` (Redis LIST)에 넣어 자동 꼬리물기 수집을 지원합니다.
  * **2단계 고속 중복 검사**: Redis Pipeline을 통한 completed_jobs O(1) SISMEMBER 조회와 MongoDB `$in` 타겟 쿼리를 조합하여, 대용량 테이블 풀스캔 없는 초고속 실시간 캐시 필터링을 완성했습니다.

### 3. 디폴트 비로그인(UNAUTHED) 기동 스펙
* **보안 및 수집 안전성 극대화**: 기본적으로 모든 수집 파이프라인은 로그인 세션을 주입하지 않는 **비로그인(게스트) 모드로 작동**합니다.
* **`AUTH=true` 옵션 도입**: `session.json` 토큰 정보를 이용한 로그인이 강제 필요할 때만 명시적 명령어로 `AUTH=true` 파라미터를 넘겨 작동시킵니다.
* **로그인 상태 태그 표준화**:
  * `[AUTHED]`: 로그인 세션이 유효하게 주입되어 가동 중인 상태입니다.
  * `[UNAUTHED]`: 비로그인(게스트) 모드이거나, 로그인 검증을 생략하고 안전 수집을 진행 중인 상태입니다. (비로그인 상태에서 로그인 챌린지 화면을 밟을 경우, 전체 차단 없이 해당 타겟만 스킵하고 다음 수집으로 유연하게 넘어갑니다.)
* **보안 및 경로 격리**: 로그인 세션 파일 경로를 `data/sessions/session.json`으로 격리 배치하여 도커 볼륨 마운트 시 `data/sessions`만 핀포인트로 마운트하여 컨테이너 환경의 격리 수준과 보안을 한층 더 높였습니다.

### 4. 대용량 I/O 메모리 누수(OOM) 해결 및 최적화
* 16,000개 이상의 HTML 백업본 분석 시 힙 메모리가 가득 차서 프로그램이 뻗던 **JavaScript heap out of memory** 오류를 완벽히 격파했습니다.
* 동기 `forEach`를 비동기 `for...of` 루프로 리팩토링하고 100개 파일 분석 단위마다 Node.js 이벤트 루프에 제어권(`setImmediate`)을 양보해 V8 가비지 컬렉션(GC)을 유도합니다.
* 인메모리 Set에는 쿼리가 복잡한 긴 전체 URL 주소 대신 **고유 ID 값만 최소한으로 보관**하여 메모리 풋프린트를 기존 대비 80% 이상 절감하였고, `Makefile` 기동 시 V8 힙 리밋을 최대 4GB로 명시적 확장하여 가동 안전성을 2중 보증합니다.

### 5. 다중 스크래핑(Playwright) 병렬 처리 (Parallel Control)
* `make list`, `make company` 및 `make worker` 실행 시 `PARALLEL=N` 파라미터를 인자로 넘겨주면, 복수의 Playwright 인스턴스를 동시에 가동시켜 스크래핑 속도를 향상시킬 수 있습니다. (기본값: `PARALLEL=1`)
* 수집 파이프라인의 경우 동일 타겟에 대한 병렬 중복 수집을 원천 차단하기 위해 **인메모리 선점 락(Mutex)** 로직을 내장하고 있습니다.

---

## 🏗️ 시스템 데이터 및 명령어 흐름 (System Workflow)

### 1. 데이터 흐름 다이어그램 (Data Flow Diagram)
```text
   [LinkedIn Web] ──(session.json 로그인 세션)──➜ Playwright (src/crawler.ts)
                                                      │
                                                      ▼ [링크드인 도메인]
                                               lists/urls.txt / data/compay/lists/urls.txt
                                                      │
                                                      ▼
                                            src/sites/linkedin/ (JobsPipeline & CompanyPipeline)
                                                      │
                                                      ▼
                                             [MongoDB]
                                             - bronze.jobs / bronze.companies
                                             - silver.jobs / silver.companies
```

### 2. 명령어 호출 흐름 (Command Flow)
```text
  Makefile Interface
  ├── make login ──────────────➜ npx ts-node src/crawler.ts login (1회성 로그인 세션 덤프)
  │
  ├── make list ───────────────➜ AUTH=$(AUTH) PARALLEL=$(PARALLEL) (채용 검색 결과 목록 HTML 덤프 & 자동 상세 URL 추출)
  │
  ├── make worker ─────────────➜ redis_worker.ts (Redis jobs_queue 기반 무한 분산 수집 워커 구동)
  │
  ├── make company ────────────➜ AUTH=$(AUTH) ts-node (회사정보 수집/변환 파이프라인 가동)
  │
  └── make test ───────────────➜ npx ts-node tests/url_manager.test.ts (단위 테스트 기동)
```

---

## 📂 프로젝트 디렉토리 구조 (Directory Tree)

```text
├── config/                   # 📁 타겟 설정 디렉토리
│   ├── config.json           # 수집 키워드/지역 제어 통합 JSON 설정 파일
│   └── country.json          # 표준 국가명 매핑 설정 파일
├── data/                     # 📁 수집 및 정제 데이터 저장 물리 디렉토리
│   ├── .services/            # ⚙️ 서비스 퍼시스턴스 데이터 (cronicle, redis 등)
│   ├── sessions/             # 🔑 안전하게 격리된 Playwright 로그인 세션 저장소 (session.json)
│   ├── jobs/                 # 💼 채용공고 수집 공간
│   └── compay/               # 🏢 회사 프로필 수집 공간
├── src/                      # 🌟 TypeScript 객체 지향 소스 코드
│   ├── core/                 # 🏢 도메인 독립형 핵심 프레임워크 클래스
│   │   ├── IConverter.ts     # 제네릭 변환 인터페이스 규격
│   │   └── BasePipeline.ts   # 메인 제어 흐름 및 ETR, 세션 예외처리 캡슐화 추상 클래스
│   ├── utils/                # ⚙️ 단일 책임 분리 경량 유틸리티 모듈
│   ├── sites/                # 🌐 사이트별 스크래핑/파이프라인 모듈
│   │   ├── geeknews/         # GeekNews 수집 모듈
│   │   ├── gpters/           # GPTERS 수집 모듈
│   │   ├── pytorch_kr/       # PyTorch KR 수집 모듈
│   │   └── linkedin/         # 💼 링크드인(채용공고 & 회사정보) 통합 수집 모듈
│   │       ├── jobs_pipeline.ts
│   │       ├── jobs_converter.ts
│   │       ├── company_pipeline.ts
│   │       ├── company_converter.ts
│   │       ├── url_manager.ts
│   │       ├── backfill.ts
│   │       └── fix_queue.ts
│   ├── redis_worker.ts       # 🤖 분산 수집을 위한 백그라운드 레디스 워커 프로세스
│   └── crawler.ts            # 🌐 Playwright 로그인/수집 및 CrawlerFactory
├── tests/                    # 📁 단위 테스트 폴더
├── tsconfig.json             # ⚙️ TypeScript 설정 파일
├── Makefile                  # ⚙️ 빌드 및 파이프라인 실행 제어용 메이크파일
└── README.md                 # 프로젝트 통합 설명서
```

---

## 🚀 시작하기 (Quick Start)

### 1. 환경 변수 파일 생성 (.env)
멀티 컴포즈 구동 시 경로 오작동을 방지하기 위해 프로젝트 루트 폴더에 반드시 호스트의 절대 경로를 기입해야 합니다.
```bash
# 템플릿 복사
cp .env.example .env

# 본인의 절대 경로로 수정 (.env 파일 열어서 수정)
# 예: HOST_PROJECT_PATH=/home/user/workspace/linkedin
```

### 2. 의존성 설치 & 컨테이너 구동
```bash
# Node 의존성 설치
npm install
npx playwright install chromium

# 🐳 모든 인프라 및 개발 툴 기동
make up
```

### 3. [선택] 1회성 로그인 세션 획득 (`make login`)
비로그인(게스트) 모드 수집 중 로그인 챌린지에 막히거나, `LOGIN=true` 옵션으로 안전한 세션 수집을 원할 경우 1회성으로 로그인을 진행하여 세션을 안전하게 덤프합니다.
```bash
make login
```
* 크롬 창이 뜨면 로그인을 수행해 주세요. 피드 로딩이 완료되면 세션 정보가 `config/session.json`에 영구 저장되고 창이 닫힙니다.

---

## 💼 채용공고 및 회사 프로필 수집 가동 흐름

### 1단계. 채용공고 검색 결과 목록 수집 (`make list`)
`config/config.json`의 조건에 따라 채용 정보 리스트 HTML 파일들을 다운로드합니다. (디폴트는 비로그인 가동입니다.)
* 수집 시점마다 `data/jobs/lists/html/[YYYYMMDD_HHMMSS]/` 형식의 하위 폴더가 자동으로 생성되어 수집 배치(Batch)별로 HTML 파일들이 덤프됩니다.
```bash
# 기본 비로그인 수집 (호스트 위임)
make list

# 3개 스레드 병렬 실행 및 로그인 세션 동원
make list PARALLEL=3 AUTH=true
```

### 2단계. 상세 URL 추출 및 필터링 (자동 수행)
`make list` 실행 결과 목록 HTML 파일이 다운로드 완료되면 크롤러가 내부 엔진에서 수집된 채용공고 및 회사 ID를 자동으로 정밀 분석합니다. 이미 수집된 ID는 O(1) 성능으로 정밀 대조 배제되며, 신규 타겟만 추출하여 데이터베이스(`bronze.job_urls` 및 `bronze.company_urls`)에 정밀 저장됩니다. (사용자가 수동으로 추출 명령어를 실행할 필요가 없습니다.)

### 3단계. 채용공고 수집 워커 백그라운드 자동 동작
추출된 신규 공고 URL들은 Redis 큐(`jobs_queue`)에 자동으로 대기열로 인입되며, 인프라 기동(`make up`) 시 함께 가동된 백그라운드 분산 수집 워커(`clipper-worker`) 컨테이너들이 실시간으로 큐의 일감을 소모해 상세 다운로드 및 MongoDB 적재를 진행합니다.
* 워커의 동작 상태 및 대기열 크기는 `make check-worker` 명령어로 실시간 모니터링할 수 있습니다.

### 4단계. 회사 정보 수집 파이프라인 가동 (`make company`)
```bash
# 기본 비로그인 수집
make company

# 로그인 세션을 동원하여 수집할 때
make company AUTH=true
```
* 회사 상세 정보가 수집되어 표준 영문 국가명 폴더별로 자동 정렬/아카이빙됩니다. (예: `data/compay/markdown/Germany/Roche.md`)

---

## 🧹 기타 관리 명령어 (Administrative Commands)

* **Redis 워커 및 상태 모니터링 (`make check-worker`)**:
  ```bash
  make check-worker
  ```
  현재 Redis 내 대기 중인 `jobs_queue`의 길이와 가동 중인 `clipper-worker` 컨테이너 목록의 활성 여부를 한눈에 체크합니다.
* **캐시 기반 유실 복원 및 회사 메타 갱신 (`make html2md`)**:
  ```bash
  make html2md
  ```
  로컬 채용공고 HTML 백업본과 MD 파일 구조를 스캔하여 유실된 MD 문서를 오프라인에서 무인 동기화(Double-Sync) 복원하고, 회사 HTML 캐시로부터 전체 마크다운 문서를 일괄 재생성하여 갱신합니다.
* **단위 테스트 기동 (`make test`)**:
  ```bash
  make test
  ```
  URL 메니저의 다중 페이지 매핑, 가공 규칙, Fallback 처리가 정상 작동하는지 정밀 테스트합니다.
* **임시/빌드 청소 (`make clean`)**:
  ```bash
  make clean
  ```
  `data/jobs/lists/html/` 하위의 모든 날짜별 폴더 및 임시 파일들을 청소합니다.
* **데이터 영구 초기화 (`make purge`)**:
  ```bash
  make purge
  ```
  `data/jobs/` 내부의 전체 데이터를 강제 초기화합니다. (수집된 회사 정보는 삭제되지 않고 안전하게 보존됩니다.)
* **Cronicle 스케줄러 설정 백업 및 동기화 (`make export-cron`, `make init-cron`)**:
  * **설정 내보내기 (Export)**:
    ```bash
    make export-cron
    ```
    현재 컨테이너에 등록된 모든 Cronicle 이벤트 스케줄을 `docker/cronicle/default.json`으로 내보냅니다.
  * **설정 불러오기 (Import/Restore)**:
    ```bash
    make init-cron
    ```
    새로운 컴퓨터로 환경을 이전했거나 컨테이너를 처음 구동했을 때, 백업된 `docker/cronicle/default.json` 데이터를 새롭게 기동된 Cronicle 서버 인스턴스에 일괄 임포트한 뒤 서비스를 재시작합니다.

---

## 🐳 Docker Multi-Compose & Admin Tools

본 프로젝트는 어드민/개발 도구의 효율적인 유지보수와 충돌 방지를 위해 **모듈형 도커 멀티 컴포즈 아키텍처**로 구성되어 있으며, 모든 서비스는 **Traefik 역방향 프록시**를 통해 로컬에서 자가서명 SSL(HTTPS)을 지원합니다.

### 1. 서비스 정보 및 접속 주소
`make up`으로 구동 시, 아래 각 어드민 서비스가 지정된 HTTPS 주소로 포워딩됩니다.

| 서비스 이름 | 용도 / 설명 | 접속 주소 (HTTPS) | 로그인 정보 (Default) |
| :--- | :--- | :--- | :--- |
| **Traefik** | Reverse Proxy & TLS 중앙 통제 라우터 | [route.localhost/dashboard/](https://route.127.0.0.1.nip.io/dashboard/) | 인증 없음 |
| **Mongo Express** | MongoDB 웹 관리 GUI 패널 | [me.localhost](https://me.127.0.0.1.nip.io) | `admin` / `pass` |
| **RedisInsight** | Redis 인메모리 관리/대시보드 패널 | [redis.localhost](https://redis.127.0.0.1.nip.io) | 인증 없음 |
| **Yacht** | 경량 도커 컨테이너 대시보드 | [yacht.localhost](https://yacht.127.0.0.1.nip.io) | `admin@yacht.local` / `pass` |
| **Dozzle** | 실시간 컨테이너 로그 탐색기 | [dozzle.localhost](https://dozzle.127.0.0.1.nip.io) | 인증 없음 |
| **Jupyter** | 데이터 통계 분석 & NER 스택 추출 | [jupyter.localhost](https://jupyter.127.0.0.1.nip.io) | 인증 없음 |
| **Cronicle** | 비동기 크롤러 예약 작업 스케줄러 | [cron.localhost](https://cron.127.0.0.1.nip.io) | `admin` / `admin` |
| **Kasm Workspaces**| 브라우저 기반 격리형 원격 VNC 데스크톱 | [kasm.localhost](https://kasm.127.0.0.1.nip.io) | `admin@kasm.local` / `password2026` |


