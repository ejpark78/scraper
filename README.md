# 🌐 LinkedIn Job & Company Clipper

> Playwright 기반 링크드인 채용 공고 및 회사 상세 프로필 백업, 마크다운 자동 변환, 동기화를 지원하는 TypeScript 엔터프라이즈 OOP 파이프라인

이 프로젝트는 링크드인(LinkedIn)의 채용 공고(Jobs) 및 회사 상세 정보(Company About) 페이지를 자동 수집하고 가공하여, 사람이 읽기 쉬운 표준 마크다운(Markdown) 문서로 정제해 저장해 주는 강력한 자동화 도구입니다.

최근 클린 아키텍처 리팩토링을 거쳐 **100% TypeScript 객체 지향 프로그래밍(OOP)** 기반 구조로 전면 개편되었습니다. **템플릿 메서드 패턴(Template Method Pattern)**을 이용해 메인 루프를 추상화하였고, **제네릭 규격 인터페이스(IConverter<T>)** 적용, 그리고 **채용공고 도메인(`src/jobs`)**과 **회사 정보 도메인(`src/company`)**을 물리적으로 완전히 격리하여 탄탄한 유지보수성을 제공합니다.

---

## ✨ 핵심 리팩토링 및 기능 (Key Features)

### 1. 클린 아키텍처 및 도메인 격리
* **🏢 코어 레이어 구축 (`src/core/`)**:
  * [BasePipeline.ts](file:///home/ejpark/workspace/linkedin/src/core/BasePipeline.ts): 시간 경과 로그, 수집 속도 기반 ETR(남은 시간) 계산, 캐싱 검증(`cache.list`), 예외 처리 및 중단 핸들러를 캡슐화한 상위 추상 클래스입니다.
  * [IConverter.ts](file:///home/ejpark/workspace/linkedin/src/core/IConverter.ts): 메타데이터 객체를 생성하는 가공 파서와 Prettier 포맷터를 제네릭 구조로 인터페이스화하였습니다.
* **💼 도메인 격리 (`src/jobs/`, `src/company/`)**:
  * 채용 공고와 회사 상세 정보가 각자의 도메인 폴더 하위로 완전히 격리되어 결합도가 줄어들고 가독성이 대폭 향상되었습니다.

### 2. Monolithic 유틸 구조 해체 (`src/utils/`)
* 단일 파일에 뒤엉켜 있던 6대 관심사 유틸리티들을 단일 책임 원칙(SRP)에 따라 각각 개별 모듈([io.ts](file:///home/ejpark/workspace/linkedin/src/utils/io.ts), [url.ts](file:///home/ejpark/workspace/linkedin/src/utils/url.ts), [date.ts](file:///home/ejpark/workspace/linkedin/src/utils/date.ts), [format.ts](file:///home/ejpark/workspace/linkedin/src/utils/format.ts), [naming.ts](file:///home/ejpark/workspace/linkedin/src/utils/naming.ts), [html_minifier.ts](file:///home/ejpark/workspace/linkedin/src/utils/html_minifier.ts))로 해체하였습니다. 이들은 배럴(Barrel) 파일인 [index.ts](file:///home/ejpark/workspace/linkedin/src/utils/index.ts)를 통해 편리하게 내보내 집니다.

### 3. 디폴트 비로그인(UNAUTHED) 기동 스펙 (New)
* **보안 및 수집 안전성 극대화**: 기본적으로 모든 수집 파이프라인은 로그인 세션을 주입하지 않는 **비로그인(게스트) 모드로 작동**합니다.
* **`AUTH=true` 옵션 도입**: `session.json` 토큰 정보를 이용한 로그인이 강제 필요할 때만 명시적 명령어로 `AUTH=true` 파라미터를 넘겨 작동시킵니다.
* **로그인 상태 태그 표준화**:
  * `[AUTHED]`: 로그인 세션이 유효하게 주입되어 가동 중인 상태입니다.
  * `[UNAUTHED]`: 비로그인(게스트) 모드이거나, 로그인 검증을 생략하고 안전 수집을 진행 중인 상태입니다. (비로그인 상태에서 로그인 챌린지 화면을 밟을 경우, 전체 차단 없이 해당 타겟만 스킵하고 다음 수집으로 유연하게 넘어갑니다.)

### 4. 대용량 I/O 메모리 누수(OOM) 해결 및 최적화 (New)
* 16,000개 이상의 HTML 백업본 분석 시 힙 메모리가 가득 차서 프로그램이 뻗던 **JavaScript heap out of memory** 오류를 완벽히 격파했습니다.
* 동기 `forEach`를 비동기 `for...of` 루프로 리팩토링하고 100개 파일 분석 단위마다 Node.js 이벤트 루프에 제어권(`setImmediate`)을 양보해 V8 가비지 컬렉션(GC)을 유도합니다.
* 인메모리 Set에는 쿼리가 복잡한 긴 전체 URL 주소 대신 **고유 ID 값만 최소한으로 보관**하여 메모리 풋프린트를 기존 대비 80% 이상 절감하였고, `Makefile` 기동 시 V8 힙 리밋을 최대 4GB로 명시적 확장하여 가동 안전성을 2중 보증합니다.

### 5. 다중 스크래핑(Playwright) 병렬 처리 (Parallel Control) (New)
* `make list` 및 `make jobs` 실행 시 `PARALLEL=N` 파라미터를 인자로 넘겨주면, 복수의 Playwright 인스턴스를 동시에 가동시켜 스크래핑 속도를 향상시킬 수 있습니다. (기본값: `PARALLEL=1`)
* `make jobs` 파이프라인의 경우 동일 타겟에 대한 병렬 중복 수집을 원천 차단하기 위해 **인메모리 선점 락(Mutex)** 로직을 내장하고 있습니다.

---

## 🏗️ 시스템 데이터 및 명령어 흐름 (System Workflow)

### 1. 데이터 흐름 다이어그램 (Data Flow Diagram)
```text
   [LinkedIn Web] ──(session.json 로그인 세션)──➜ Playwright (src/crawler.ts)
                                                      │
                                                      ├────────────────────────────────┐
                                                      ▼ [채용공고 도메인]              ▼ [회사정보 도메인]
                                               lists/urls.txt                  data/compay/lists/urls.txt
                                                      │                                │
                                                      ▼                                ▼
                                             JobsPipeline (src/jobs/)        CompanyPipeline (src/company/)
                                                      │                                │
                                                      ▼                                ▼
                                             [공고 상세 HTML/MD]             [회사 상세 HTML/MD]
                                           📂 html/[Location]/[Date]       📂 html/[FullCountryName]/
                                           📂 markdown/[Location]/[Date]   📂 markdown/[FullCountryName]/
```

### 2. 명령어 호출 흐름 (Command Flow)
```text
  Makefile Interface
  ├── make login ──────────────➜ npx ts-node src/crawler.ts login (1회성 로그인 세션 덤프)
  │
  ├── make list ───────────────➜ AUTH=$(AUTH) PARALLEL=$(PARALLEL) (채용 검색 결과 목록 HTML 덤프)
  │
  ├── make urls ───────────────➜ node --max-old-space-size=4096 (신규 채용공고 URL & 회사 URL 추출)
  │
  ├── make jobs ───────────────➜ AUTH=$(AUTH) PARALLEL=$(PARALLEL) (채용공고 수집/마크다운 변환 파이프라인 가동)
  │
  ├── make company ────────────➜ AUTH=$(AUTH) ts-node (회사정보 수집/변환 파이프라인 가동)
  │
  ├── make html2md ────────────➜ jobs_converter.ts & reconvert_all.ts (유실 복원 및 마크다운 일괄 재생성)
  │
  └── make test ───────────────➜ npx ts-node tests/url_manager.test.ts (단위 테스트 기동)
```

---

## 📂 프로젝트 디렉토리 구조 (Directory Tree)

```text
├── data/                     # 📁 수집 및 정제 데이터 저장 물리 디렉토리
│   ├── .services/            # ⚙️ 서비스 퍼시스턴스 데이터 (cronicle, redis 등)
│   │   ├── cronicle/         # Cronicle 서비스 데이터
│   │   └── redis/            # Redis 퍼시스턴스 데이터
│   ├── jobs/                 # 💼 채용공고 수집 공간
│   │   ├── html/             # 아카이빙된 공고 HTML (근무지역/포스팅날짜 분류)
│   │   ├── markdown/         # 정제 완료된 공고 마크다운 (근무지역/포스팅날짜 분류)
│   │   └── lists/
│   │       ├── urls.txt      # 신규 수집 대상 채용공고 URL 목록
│   │       └── cache.list    # 로컬에 수집 완료된 채용공고 고유 ID 캐시 인덱스
│   └── compay/               # 🏢 회사 프로필 수집 공간 (기존 jobs 하위에서 격리 이관)
│       ├── html/             # 아카이빙된 회사 HTML (표준 영문 국가명 서브디렉토리 분류)
│       ├── markdown/         # 정제 완료된 회사 마크다운 (표준 영문 국가명 서브디렉토리 분류)
│       └── lists/
│           ├── urls.txt      # 신규 수집 대상 회사 URL 목록 (기존 jobs/lists/compay.txt에서 이관)
│           └── cache.list    # 로컬에 수집 완료된 회사 고유 ID 캐시 인덱스
├── config/                   # 📁 인증 세션 및 타겟 설정 디렉토리
│   ├── config.json           # 수집 키워드/지역 제어 통합 JSON 설정 파일
│   └── session.json          # Playwright 덤프 로그인 세션 정보 파일
├── src/                      # 🌟 TypeScript 객체 지향 클린 소스 코드
│   ├── core/                 # 🏢 도메인 독립형 핵심 프레임워크 클래스
│   │   ├── IConverter.ts     # 제네릭 변환 인터페이스 규격
│   │   └── BasePipeline.ts   # 메인 제어 흐름 및 ETR, 세션 예외처리 캡슐화 추상 클래스
│   ├── utils/                # ⚙️ 단일 책임 분리 경량 유틸리티 모듈
│   │   ├── date.ts           # 상대 시간 파싱 및 ETR 포맷팅
│   │   ├── format.ts         # 숫자 및 천 단위 구분자 포맷팅
│   │   ├── html_minifier.ts  # Cheerio/Prettier 기반 HTML 용량 다이어트 유틸
│   │   ├── io.ts             # 재귀적 디렉토리 파일 I/O
│   │   ├── naming.ts         # 특수문자 정제 및 파일명 안전 빌더
│   │   ├── url.ts            # URL ID 디코드 및 표준 위치 매핑 바인더
│   │   └── index.ts          # 유틸리티 통합 배럴 내보내기 파일
│   ├── jobs/                 # 💼 채용공고 도메인 수집/가공 바인딩 공간
│   │   ├── jobs_pipeline.ts  # BasePipeline 상속 채용공고 파이프라인
│   │   ├── jobs_converter.ts # IConverter 구현 채용공고 HTML ➡️ MD 변환기
│   │   ├── url_manager.ts    # 검색 URL 빌더, 메모리 최적화 링크/ID 추출 매니저
│   │   └── migrate_locations.ts # 채용공고 표준 폴더 정렬용 마이그레이션 엔진
│   ├── company/              # 🏢 회사정보 도메인 수집/가공 바인딩 공간
│   │   ├── company_pipeline.ts # BasePipeline 상속 회사 정보 파이프라인
│   │   ├── company_converter.ts # IConverter 구현 회사 HTML(JSON+DOM) ➡️ MD 변환기
│   │   └── reconvert_all.ts  # 회사 HTML 캐시로부터 마크다운을 일괄 마이그레이션/재생성하는 도구
│   └── crawler.ts            # 🌐 Playwright 로그인/수집 및 CrawlerFactory
├── tests/                    # 📁 단위 테스트 폴더
├── tsconfig.json             # ⚙️ TypeScript 설정 파일
├── Makefile                  # ⚙️ 빌드 및 파이프라인 실행 제어용 메이크파일
└── README.md                 # 프로젝트 통합 설명서
```

---

## 🚀 시작하기 (Quick Start)

### 1. 의존성 설치
**Node.js (18버전 이상)** 및 **make** 유틸리티가 설치된 환경에서 패키지를 설치합니다.
```bash
npm install
npx playwright install chromium
```

### 2. [선택] 1회성 로그인 세션 획득 (`make login`)
비로그인(게스트) 모드 수집 중 로그인 챌린지에 막히거나, `LOGIN=true` 옵션으로 안전한 세션 수집을 원할 경우 1회성으로 로그인을 진행하여 세션을 안전하게 덤프합니다.
```bash
make login
```
* 크롬 창이 뜨면 로그인을 수행해 주세요. 피드 로딩이 완료되면 세션 정보가 `config/session.json`에 영구 저장되고 창이 닫힙니다.

---

## 💼 채용공고 수집 가동 흐름 (Job posts Flow)

### 1단계. 채용공고 검색 결과 목록 수집 (`make list`)
`config/config.json`의 조건에 따라 채용 정보 리스트 HTML 파일들을 다운로드합니다. (디폴트는 비로그인 가동입니다.)
* 수집 시점마다 `data/jobs/lists/html/[YYYYMMDD_HHMMSS]/` 형식의 하위 폴더가 자동으로 생성되어 수집 배치(Batch)별로 HTML 파일들이 덤프됩니다.

```bash
# 기본 비로그인 수집
make list

# 3개 스레드 병렬 실행 및 로그인 세션 동원
make list PARALLEL=3 AUTH=true
```

### 2단계. 상세 URL 추출 및 필터링 (`make urls`)
목록 HTML 파일들을 분석하여 이미 수집된 ID를 O(1) 성능으로 정밀 대조 배제하고, 신규 타겟을 `data/jobs/lists/urls.txt`에 저장하며 수집된 회사 URL들은 `data/compay/lists/urls.txt`에 별도로 적재합니다. (대용량 메모리 OOM 방지 및 4GB Heap 옵션이 적용되어 있습니다.)
```bash
make urls
```

### 3단계. 일괄 채용공고 다운로드 및 변환 (`make jobs`)
추출된 신규 공고 URL에 순차적으로 접근하여 상세 정보 스크랩 및 프리티어 마크다운 변환을 일괄 수행합니다. (수집 성공 시 `data/jobs/recent` 하위에 신규 복사본을 유지합니다.)
```bash
# 기본 비로그인 수집
make jobs

# 5개 스레드 병렬 실행 및 로그인 세션 동원 (세션 풀릴 시 자동 안내 및 수집 안전 중단 지원)
make jobs PARALLEL=5 AUTH=true
```

---

## 🏢 회사 프로필 수집 가동 흐름 (Company Profile Flow)

### 1단계. 회사 리스트 준비
* 이전 `make urls` 수행 결과로 자동 생성된 **`data/compay/lists/urls.txt`**를 그대로 사용하거나, 수집하고 싶은 회사 주소를 한 줄에 하나씩 작성합니다.

### 2단계. 파이프라인 가동 (`make company`)
```bash
# 기본 비로그인 수집
make company

# 로그인 세션을 동원하여 수집할 때
make company AUTH=true
```
* 회사 상세 정보가 수집되어 표준 영문 국가명 폴더별로 자동 정렬/아카이빙됩니다. (예: `data/compay/markdown/Germany/Roche.md`)

---

## 🧹 기타 관리 명령어 (Administrative Commands)

* **캐시 기반 유실 복원 및 회사 메타 갱신 (`make html2md`)**:
  ```bash
  make html2md
  ```
  * 로컬 채용공고 HTML 백업본과 MD 파일 구조를 스캔하여 유실된 MD 문서를 오프라인에서 무인 동기화(Double-Sync) 복원하고, 회사 HTML 캐시로부터 전체 마크다운 문서를 일괄 다시 써서 갱신합니다.
* **단위 테스트 기동 (`make test`)**:
  ```bash
  make test
  ```
  * URL 메니저의 다중 페이지 매핑, 가공 규칙, Fallback 처리가 정상 작동하는지 정밀 테스트합니다.
* **임시/빌드 청소 (`make clean`)**:
  ```bash
  make clean
  ```
  * `data/jobs/lists/html/` 하위의 모든 날짜별 폴더 및 임시 파일들을 청소합니다.
* **데이터 영구 초기화 (`make purge`)**:
  ```bash
  make purge
  ```
  * `data/jobs/` 내부의 전체 데이터를 강제 초기화합니다. (수집된 회사 정보는 삭제되지 않고 안전하게 보존됩니다.)
* **Cronicle 스케줄러 설정 백업 및 동기화 (`make export-cron`, `make init-cron`)**:
  * **설정 내보내기 (Export)**:
    ```bash
    make export-cron
    ```
    현재 컨테이너에 등록된 모든 Cronicle 이벤트 스케줄, 사용자 및 플러그인 설정을 `docker/cronicle/default.json`으로 내보냅니다. (이전 환경의 IP 주소는 빈 문자열 `""`로 자동 치환되어 새로운 환경에서도 매끄럽게 호환되도록 구성됩니다.)
  * **설정 불러오기 (Import/Restore)**:
    ```bash
    make init-cron
    ```
    새로운 컴퓨터로 환경을 이전했거나 컨테이너를 처음 구동했을 때, 백업된 `docker/cronicle/default.json` 데이터를 새롭게 기동된 Cronicle 서버 인스턴스에 일괄 임포트한 뒤 서비스를 재시작합니다.


---

## 🐳 Kasm VDI 개발 환경 가이드 (Kasm Development Guide)

본 프로젝트는 Kasm VDI 컨테이너를 이용한 독립적이고 완성도 높은 원격 웹 브라우저 개발 및 디버깅 환경을 기본 지원합니다.

### 1. 주요 특징 및 구성
* **동일한 셀 환경 (Zsh + Oh My Zsh)**: 호스트의 Zsh 설정(`.zshrc`, `.gitconfig`) 및 주요 플러그인(`zsh-autosuggestions`, `zsh-syntax-highlighting`, `fzf-tab`), 시스템 의존성(`fzf`, `eza`)이 Docker 이미지 빌드 시 자동으로 반영됩니다.
* **호스트 경로 호환성 보장**: `.zshrc` 내부에 호스트 홈 디렉토리 경로(`/home/ejpark`)가 하드코딩되어 있어도, 컨테이너 내부에 `/home/ejpark` -> `/home/kasm-user` 심볼릭 링크가 자동 생성되어 모든 설정과 에일리어스(alias)가 정상 동작합니다.
* **무인 GUI 웹 접속**: `http://kasm.localhost`에 브라우저로 접속하여 GUI 가상 데스크톱 터미널을 확인하고 Playwright 수집 과정을 직접 시각적으로 관찰 및 제어할 수 있습니다.

### 2. 가동 및 접속 방법
1. **컨테이너 빌드 & 실행**:
   ```bash
   make build
   docker compose up -d
   ```
2. **Kasm 내부 Zsh 쉘로 터미널 진입**:
   ```bash
   make kasm
   ```
   * 이 명령을 실행하면 즉시 Kasm 컨테이너 내부에서 로그인되어 호스트와 동일한 쉘 환경(Zsh)에서 개발 및 Playwright CLI 제어가 가능합니다.
3. **가상 GUI 데스크톱 접속**:
   * 브라우저에서 `http://kasm.localhost`로 접속합니다.
   * 기본 비밀번호: `password2026` (변경 가능: `docker-compose.yml` 내 `VNC_PW` 참고)

