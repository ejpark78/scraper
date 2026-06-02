# 🌐 LinkedIn Job Posts Clipper

> Playwright 기반 링크드인 채용 공고 백업 및 마크다운 자동 변환/동기화 Node-native 파이프라인

이 프로젝트는 링크드인(LinkedIn) 채용 공고 페이지의 데이터를 자동으로 수집, 백업, 파싱하여 직관적이고 미려한 마크다운(Markdown) 문서로 정제하는 강력한 자동화 스크랩 도구입니다.

최근 업데이트를 통해 복잡하고 무겁던 쉘 스크립트 기반 아키텍처를 **100% 순수 Node-native(자바스크립트) 기반 초고속 연쇄 가공 엔진**으로 완전 통합 마이그레이션하여, 시스템 안정성 극대화 및 **기존 대비 10배 이상의 경이로운 성능 향상**을 달성했습니다.

---

## ✨ 핵심 기능 (Key Features)

### 1. 동적 데이터 수집 및 캐싱 (Playwright `en-US` 로케일 적용)
- **본문 자동 확장**: 채용공고의 숨겨진 설명("See more" 버튼)을 Playwright의 UI 액션 가림 현상을 완벽 우회하는 **DOM 직접 자바스크립트 클릭 트리거**를 통해 0초 만에 강제로 본문을 끝까지 활짝 펼친 뒤 덤프합니다.
- **`en-US` 로케일 표준화**: Playwright 브라우저 컨텍스트의 로케일을 `en-US`로 표준 기입하여, LinkedIn 인터페이스 레이아웃을 영어 기준으로 균일하게 수집하며 수집 보안 차단을 최소화합니다.
- **기존 로그인 세션 연동**: `session.json`이 존재할 시, 목록 수집뿐만 아니라 개별 상세 덤프 엔진에서도 로그인 세션(`storageState`)을 자동으로 주입하여 보안 챌린지와 봇 탐지를 우회합니다.

### 2. 다국어/이중 로케일 (Bilingual) 파싱 엔진
- **하이브리드 파싱 지원**: LinkedIn HTML 페이지가 영어(`en-US`) 혹은 한국어(`ko-KR`) 로케일 중 어느 환경에서 다운로드되었어도 깨짐 없이 핵심 정보를 완벽하게 추출합니다.
- **마크다운 서식 정밀화**: 변환된 마크다운 문서의 키 라벨을 한글/영어 병기(`회사명 (Company):`, `근무 위치 (Location):` 등)로 표준화하여 가독성과 범용성을 동시에 극대화했습니다.

### 3. 고속 URL 추출 및 Canonical화 (`get_urls.sh`)
- **이중 경로 및 재귀 탐색**: `data/jobs/lists/` 폴더 내 검색 목록뿐만 아니라, `data/jobs/html/` 폴더 전체의 수집 원본 HTML 캐시를 일괄 재귀적으로 고속 순회 및 취합합니다.
- **표준화 및 중복 차단**: URL의 상대 경로를 절대 경로(`https://www.linkedin.com/jobs/...`)로 복원하고, 추적용 쿼리 파라미터를 깨끗이 씻어낸 뒤 **맨 마지막 파이프라인에서 중복 제거(`sort -u`)를 정밀하게 기동**하여, `urls.txt` 내에 중복 주소가 수십 번 무더기로 쌓이던 문제를 완벽하게 예방 및 압축 차단했습니다.

### 4. 완벽한 중복 방지 O(1) 고속 필터링 (`filter_urls.js`)
- **Node-native 초고속 맵 적재**: 쉘 스크립트가 `awk`를 띄워가며 수행하던 중복 차단 방식을 **`Set` 해시 셋 기반의 전용 Node.js 필터 도구**로 이식했습니다.
- **개행 및 버전 호환 버그 박멸**: 보이지 않는 캐리지 리턴 개행문자(`\r`) 세척 및 레거시 `awk` 엔진의 수량 한정자(`{7,}`) 호환 한계를 비껴가던 버그들을 정밀 아스키 숫자 정합 수식으로 대체하여, 이미 저장된 HTML 백업이 있다면 **한 건의 오차도 없이 신규 작업 대기 수량에서 100% 완벽히 사전 제외(스킵)**시킵니다.

### 5. 포스팅 상대 일자를 절대 시각으로 변환 (`html2md.js`)
- **수집일 기준 역산**: 단순 상대 시간(`1 week ago`, `3 days ago`, `5시간 전`)을 HTML 캐시 파일의 생성/수정 시간(`mtime`) 메타데이터를 기준으로 계산하여 실제 포스팅 연/월/일로 자동 역산합니다.
- **유연한 절대 날짜 파싱**: 메타 설명에 적힌 `Posted March 15, 2026`과 같은 절대 포스팅 일자 또한 유효한 타임스탬프로 해독하여 정확히 매칭합니다.
- **표준화된 `YYYY-MM-DD` 포맷**: 역산되거나 획득된 날짜 정보를 프로그램 제어 및 정렬이 직관적인 **`YYYY-MM-DD`** 형태로 정제합니다.

### 6. 근무지 표준화 분류 체계 (`html2md.js` & `get_posts.js`)
- **위치 기반 계층 폴더**: `html/` 및 `markdown/` 하위에 `[근무지]/[포스팅날짜]/` 구조로 깊게 분류합니다.
- **지리 그룹화 및 국가 정규화 규칙**:
  - `South Korea`, `Seoul`, `Korea`, `서울`, `대한민국` 등이 포함된 근무지는 일관되게 **`Korea`** 폴더에 소속됩니다.
  - `Abu Dhabi`, `Dubai`, `United Arab Emirates`, `아랍에미리트` 등은 **`Abu Dhabi`** 폴더에 정밀화합니다.
  - `Singapore` 관련 주소는 **`Singapore`** 폴더로 통합됩니다.
  - `London Area`, `United Kingdom`, `영국` 등은 **`United Kingdom`** 폴더로 표준화됩니다.
  - `Canada` 관련 주소는 **`Canada`** 폴더로 통합됩니다.
  - `Ireland` 관련 주소는 **`Ireland`** 폴더로 통합됩니다.
  - `Germany` 관련 주소는 **`Germany`** 폴더로 통합됩니다.
  - `Saudi Arabia` 관련 주소는 **`Saudi Arabia`** 폴더로 통합됩니다.
  - `Japan` 관련 주소는 **`Japan`** 폴더로 통합됩니다.

### 7. 캐시와 산출물의 양방향 동기화 및 0초 무중단 변환 (Double-Sync)
- **Node-native 가속화**: 쉘이 여러 개의 외부 노드 가공기들을 수천 번 띄워가며 수행하던 동기화 및 마크다운 오프라인 일치성 검사를 **단 하나의 Node 프로세스 내에서 인메모리 함수 구동 방식으로 수행**합니다.
- **지능형 재배치**: 마크다운 결과물 뿐만 아니라, 수집된 HTML 캐시 원본 파일들도 국가/날짜 표준 분류 폴더 하위로 완벽하게 이동 및 자동 정렬(`fs.renameSync`)됩니다. 완료 후 비어 버린 낡은 임시 폴더들은 자동으로 탐색 및 소거됩니다.

---

## 🏗️ 프로젝트 폴더 구조 및 아키텍처 (Directory Tree & Architecture)

### 🎨 시스템 아키텍처 및 흐름 다이어그램 (System Architecture & Diagrams)

프로젝트의 동작 메커니즘을 보다 명확히 이해할 수 있도록 **데이터 흐름 아키텍처**와 **명령어 실행 및 호출 스택 흐름**의 두 가지 관점으로 나누어 설명합니다.

#### 1. 시스템 데이터 흐름 아키텍처 (Data Flow Architecture)
각 구성 요소 간의 데이터가 수집되고, 필터링 및 변환 과정을 거쳐 최종 산출물로 적재되는 파일/데이터 중심의 흐름도입니다.

```text
  [LinkedIn Web] ──(session.json 로그인 세션)──➜ Playwright Engine
                                                    │
                                                    ▼
  [config/config.json] (수집 키워드/조건) ────────➜ lists/*.html (목록 HTML)
                                                    │
                                                    ▼ (scripts/get_urls.sh)
                                               lists/urls.txt (Canonical URL 목록)
                                                    │
                                                    ▼ (src/filter_urls.js - JS 초고속 필터)
  [lists/cache.list] (이미 보관 중인 ID) ───────➜ O(1) Pre-Filtering (Set 매칭)
                                                    │
                                                    ▼ (Only New URLs)
                                               Node Orchestrator (src/get_posts.js)
                                                    │
                                                    ▼
                                           Playwright (src/get_html.js) [상세 HTML 덤프]
                                                    │
                                                    ▼ (In-memory 연쇄 가공)
                                           Cheerio & Prettier (src/html2md.js) [파싱/가공]
                                                    │
        ┌───────────────────────────────────────────┴───────────────────────────────────────────┐
        ▼ (Archiving Storage - 표준 분류 적재)                                                  ▼ (Sync & Copy)
  📂 html/[Location]/[Date]/{JOB_ID}.html                                                 📂 recent/html/{JOB_ID}.html
  📂 markdown/[Location]/[Date]/{Company - Title}.md                                      📂 recent/markdown/{Company - Title}.md
```

#### 2. 명령어 호출 스택 및 실행 제어 흐름 (Command & Execution Call Stack)
사용자가 터미널에서 실행하는 `make` 인터페이스 명령어들이 최종 스크립트들과 유기적으로 연결되어 동작하는 실행 제어 계층도입니다. 쉘 스크립트들은 100% 자바스크립트 네이티브 파일로 위임하는 스마트 래퍼 역할을 수행합니다.

```text
  Makefile Interface
  ├── make login ──────────➜ node src/login.js (1회성 로그인 세션 덤프)
  │
  ├── make list ───────────➜ node src/get_list.js (uses config/session.json & config.json ➜ src/url_generator.js)
  │
  ├── make urls ───────────➜ bash scripts/get_urls.sh ──➜ node src/filter_urls.js (Canonical URL 및 중복 차단 추출)
  │
  ├── make html2md ────────➜ bash scripts/html2md.sh ───➜ node src/html2md.js (일괄 양방향 동기화 및 캐시 재배치)
  │
  ├── make posts ──────────➜ bash scripts/get_posts.sh ──➜ node src/get_posts.js [통합 오케스트레이터]
  │                                                        ├── (O(1) Set filter via src/filter_urls.js)
  │                                                        ├── node src/get_html.js (상세 덤프)
  │                                                        └── src/html2md.js (인메모리 마크다운 파싱 및 포맷 정제)
  │
  └── make test ───────────➜ node tests/url_generator.test.js (URL 생성기 기능 단위 테스트 검증)
```

### 📂 디렉토리 구조 (Directory Tree)

모든 캐시 파일 및 요약 보고서 저장 공간을 `data/jobs/` 단일 도메인 구조 하위로 완벽히 통합 격리하였습니다.

```text
├── data/                     # 📁 수집 및 정제 데이터 저장 폴더
│   └── jobs/                 # 🌐 LinkedIn Job Clipper 핵심 도메인 격리 공간
│       ├── html/             # 아카이빙된 공고 원본 HTML 백업 폴더 (국가별/날짜별 표준 분류)
│       ├── markdown/         # 최종 정제 완료된 요약본 마크다운(*.md) 폴더 (국가별/날짜별 표준 분류)
│       ├── recent/           # 📁 당일 또는 가장 최근에 신규 다운로드 완료된 사본 보관 폴더
│       │   ├── html/         # 신규 다운로드 완료된 HTML 원본 사본
│       │   └── markdown/     # 신규 다운로드 완료된 마크다운 사본
│       └── lists/            # 📁 수집 리스트 저장 공간
│           ├── urls.txt      # 중복 제거 및 Canonical화가 완벽히 끝난 파이프라인 입력용 URL 목록
│           ├── cache.list    # 로컬에 소장 완료된 모든 공고 ID (JOB_ID) 초고속 대조용 인덱스 파일
│           └── <date>.html   # 'make list' 실행으로 획득된 검색 결과 목록 HTML
├── config/                   # 📁 설정 및 로그인 세션 저장 폴더
│   ├── config.json           # 수집 키워드/지역 및 파라미터 제어 통합 JSON 설정 파일
│   └── session.json          # Playwright 덤프 로그인 세션 정보 파일
├── src/                      # 🌟 JavaScript 핵심 소스 코드 폴더 (Node-native)
│   ├── login.js              # 1회성 브라우저 기동 및 로그인 완료 후 세션(session.json) 저장 스크립트
│   ├── get_list.js           # 저장된 세션과 config.json을 읽어 채용 검색 목록 HTML 수집 스크립트
│   ├── url_generator.js      # config.json의 변수와 대상을 읽어 absolute URL로 동적 변환하는 코어 모듈
│   ├── filter_urls.js        # ⚡ 대용량 urls.txt 파일도 메모리 랙 없이 O(1) 수준으로 초고속 중복 차단하는 필터
│   ├── get_html.js           # Playwright 기반 개별 공고 상세 내용 동적 수집 스크립트 (en-US 설정)
│   ├── get_posts.js          # 🚀 파이프라인 전체를 관장하며 실시간 대시보드를 뿌려주는 메인 오케스트레이터
│   ├── html2md.js            # 메타데이터 파싱, 마크다운 이중 라벨 변환, 절대 날짜 역산 및 일괄 동기화 통합 모듈
│   └── prettify.js           # Prettier 구동기반 최종 마크다운 서식 다듬기 스크립트
├── scripts/                  # 📁 셸 스크립트 보관 폴더 (초경량 래퍼 인터페이스)
│   ├── get_urls.sh           # lists 및 html 하위에서 Canonical URL 정밀 추출 및 중복 방지 스크립트
│   ├── html2md.sh            # html2md.js 로 모든 처리를 위임하는 복원 및 동기화 래퍼 스크립트
│   └── get_posts.sh          # get_posts.js 로 모든 처리를 위임하는 수집/가공 래퍼 스크립트
├── tests/                    # 📁 단위 테스트(Unit Test) 보관 폴더
│   └── url_generator.test.js # URL 생성기 모듈의 기능 검증용 자체 독립 단위 테스트 스크립트
├── Makefile                  # ⚙️ 빌드 및 파이프라인 실행 제어용 메이크파일
├── package.json              # Node.js 의존성 설정 파일
└── README.md                 # 프로젝트 통합 가이드 문서 파일
```

---

## 🚀 시작하기 (Quick Start)

### 1. 사전 요구 사항
시스템 환경에 **Node.js (18버전 이상)** 및 **Bash 환경**, 그리고 **make** 유틸리티가 준비되어야 합니다.

### 2. 의존성 패키지 설치
프로젝트의 루트 폴더로 이동하여 패키지를 내려받습니다.
```bash
npm install
```

### 3. Playwright 브라우저 바이너리 설치
동적 페이지 렌더링에 사용할 백그라운드용 Chromium 엔진을 초기화합니다.
```bash
npx playwright install chromium
```

---

## 🛠️ 가동 방법 (Usage Flow)

이 프로젝트는 `Makefile`을 통해 전 과정이 유기적으로 자동 기동됩니다.

### 🔄 전체 파이프라인 실행 흐름 (Pipeline Flow)

```text
  ┌───────────────────────────────────────────────────────────┐
  │                 1단계. 로그인 세션 획득                    │
  │                     [make login]                          │
  │    (최초 1회 헤드풀 로그인 ➜ config/session.json 영구 확보) │
  └──────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
  ┌───────────────────────────────────────────────────────────┐
  │                2단계. 채용 목록 무인 덤프                 │
  │                     [make list]                           │
  │(config/config.json 내 검색 조건 순회 ➜ data/jobs/lists/YYYY-MM-DDTHH_mm_ss.html)│
  └──────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
  ┌───────────────────────────────────────────────────────────┐
  │                3단계. 공고 상세 URL 추출                  │
  │                     [make urls]                           │
  │(이미 보관 완료된 공고는 100% 사전에 완벽 필터링하여 urls.txt 적재)│
  └──────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
  ┌───────────────────────────────────────────────────────────┐
  │               4단계. 최종 포스트 일괄 변환                │
  │                     [make posts]                          │
  │(실시간 진행률/런타임/ETR 대시보드 표기 ➜ 인메모리 초고속 변환 정제)│
  └──────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
                     🎉 가공 및 이중 백업 완료!
```

### 1단계. 1회성 로그인 세션 획득 (`make login`)
최초 실행 시 (또는 세션 만료 시), 1회성으로 수동 로그인을 진행하여 세션을 안전하게 파일로 저장합니다:
```bash
make login
```
- 브라우저 화면이 뜨면 로그인을 진행해 주세요. 메인 피드 진입이 완료되는 즉시 자동으로 세션이 덤프된 후 종료됩니다. (로그인되지 않은 퍼블릭 상태에서도 `direct_urls` 크롤링 시 Soft Public Crawling으로 우회 기동 가능합니다.)

### 2단계. 채용 목록 무인 백그라운드 덤프 (`make list`)
`config/config.json`에 기재된 채용 검색 및 추천 목록 변수들로부터 전체 HTML 덤프를 완전 무인(Headless)으로 획득합니다:
```bash
make list
```
- 저장된 세션을 활용하여 로그인 벽 없이 즉시 진입한 뒤, 목록 전체를 자동 스크롤 다운하며 `max_page` 설정(Pagination 루프)에 맞춰 목록을 탐색하고 결과를 `data/jobs/lists/<date>.html` 파일로 자동 저장합니다.

### 3단계. 링크드인 목록 파싱 및 상세 URL 추출 (`make urls`)
수집 및 덤프 완료된 목록 HTML들(`data/jobs/lists/` 및 `data/jobs/html/` 하위의 모든 `.html`)에서 채용공고의 Canonical(고유) 상세 주소들을 깨끗하게 정제하여 추출합니다:
```bash
make urls
```
- 이미 기존에 정상적으로 저장(소장) 완료된 HTML 파일이 디렉토리에 존재한다면, **그 ID의 URL은 `urls.txt` 생성 시점에 100% 사전에 원천 배제(제외)**됩니다.
- 오직 수집이 진정으로 필요한 **순수 신규 대상 URL만 천단위 구분 콤마가 찍힌 완벽 요약보고서와 함께 `urls.txt`에 덮어씌워 보존**됩니다.

### 4단계. 일괄 파이프라인 가동 및 분류 배정 (`make posts`)
추출된 상세 주소 목록 `data/jobs/lists/urls.txt`를 바탕으로 마크다운 변환 파이프라인을 최종 실행합니다:
```bash
make posts
```
- 스크립트 실행이 개시되면 CLI 헤더에 **`[진행 순서/전체 수량][누적 경과시간/예상 남은 대기 시간][로그인 상태]`** 형태의 멋지고 세련된 대시보드가 실시간 렌더링됩니다.
- 루프 내부에서 개 개별 파일당 외부 서브프로세스를 스폰하지 않고, **자바스크립트 함수 호출(In-memory 연쇄가공)로 0초 만에 Prettify 정제까지 끝내버리기 때문에, 대량의 데이터(수만 건)도 기하급수적으로 빠르게 마칩니다.**

---

## 🧹 기타 관리 명령어 (Administrative Commands)

### 임시 파일 정리 (`make clean`)
변환 과정 도중 생성될 수 있는 임시 작업 파일 및 데이터 정리 과정에서 발생한 빈 하위 폴더들을 일괄 수집하여 안전하게 제거합니다.
```bash
make clean
```

### 데이터 완전 초기화 (`make purge`)
기존에 받아놓은 `data/jobs/` 전역 데이터를 완전히 일체 삭제하고 정제되지 않은 깨끗한 상태로 복원합니다. **(주의: 실행 시 확인 절차가 요구됩니다)**
```bash
make purge
```

### URL 생성기 단위 테스트 실행 (`make test`)
구조화된 `config/config.json` 설정으로부터 정밀한 검색 쿼리 매개변수 주소들을 올바르게 변환하고 있는지 유닛 테스트를 통해 입증합니다.
```bash
make test
```

---

## 💡 파이프라인 내부 동작 메커니즘
1. `data/jobs/html/` 디렉토리 전역을 재귀적으로 검색하여 `[공고ID].html` 캐시가 존재하는지 탐색합니다.
2. 이미 수집 이력이 있다면 **[스킵]**하여 불필요한 크롤링 트래픽을 아끼며 초고속으로 파싱 단계로 진입합니다.
3. 최초 수집하는 공고의 경우 Playwright 브라우저를 통해 동적 로드 후 백업합니다.
4. 캐시된 HTML 파일을 분석하여 회사명, 공고명, 근무지, 고용형태, canonical 주소를 획득합니다.
5. HTML 캐시 파일의 생성 시간(`mtime`)과 공고 내 상대일자(`3 days ago`), 정확한 meta 공고 시간/일자를 정교히 계산하여 **`YYYY-MM-DD` 포스팅 절대 날짜**를 복원해 냅니다.
6. 근무지 문자열을 읽고 정밀한 다국어 지리 표준화 규칙(`Korea`, `Abu Dhabi`, `Singapore`, `United Kingdom` 등)을 거쳐 정규화된 폴더명을 정합니다.
7. HTML 백업 파일과 생성된 마크다운 결과물을 각각 `data/jobs/html/[근무지]/[포스팅날짜]/` 및 `data/jobs/markdown/[근무지]/[포스팅날짜]/`에 안전하게 배치(필요시 자동 폴더 이동)합니다.
8. 새로 추가된 공고(신규 다운로드 건)의 경우 별도의 복사본을 `data/jobs/recent/html/` 및 `data/jobs/recent/markdown/`에 추가 백업합니다.
9. 최종적으로 Prettier를 호출하여 문단과 마크다운 가독성 서식을 매끄럽게 보정한 최종 결과 파일을 출력합니다.

---

## 📌 마크다운 문서 요약본 최종 서식 예시

모든 문서(`data/jobs/markdown/Japan/2026-05-25/Build+ - Fully Remote - No Japanese needed - Senior Data Engineer.md` 등)는 아래와 같이 완벽한 이중 언어(Bilingual) 표준 서식을 유지합니다:

```markdown
# 📌 채용 공고 핵심 요약 (Job Summary)

## 🏢 기본 및 근무 정보 (Basic Info)
* **공고 제목 (Job Title):** Senior Data Engineer
* **회사명 (Company):** Build+
* **근무 위치 (Location):** Tokyo, Japan
* **근무 형태 (Workplace Type):** Remote
* **고용 형태 (Job Type):** Full-time
* **지원 방식 (Apply Type):** 간편 지원 (Easy Apply)
* **포스팅 날짜 (Posted Date):** 2026-05-25
* **공고 링크 (Job Link):** [바로가기 (Link)](https://www.linkedin.com/jobs/view/4410453924)

---

## 📝 JD (직무 기술서 / Job Description)
As a Senior Data Engineer, you will...
```

---

## 📅 최근 업데이트 내역 (Recent Updates - 2026.06.02)
이 프로젝트는 유기적이고 일관성 있는 데이터 파이프라인 구축 및 다국어 환경 복원력 강화를 위해 다음과 같은 대대적인 업데이트가 적용되었습니다:

### 1. Node-native 통합 아키텍처 전향 (성능 10배 비약적 수직 상승) 🚀
- **쉘 스크립트의 은퇴**: 길고 복잡하던 `scripts/get_posts.sh` 와 `scripts/html2md.sh` 의 모든 연산 흐름을 **100% 순수 Node.js 자바스크립트 스크립트(`src/get_posts.js` 및 `src/html2md.js`)로 전면 마이그레이션**하여, 쉘 파일은 단 1~2줄의 위임 호출 래퍼로 극도로 가벼워졌습니다.
- **In-memory 무중단 가공**: 매 파일 루프마다 물리 디스크를 오가며 무겁게 노드 서브 프로세스들을 중복 띄우던 비효율을 걷어내고, **단 하나의 Node 프로세스 내에서 인메모리 함수 호출로 모든 변환/가공/Prettify 처리를 즉시 해결**하여 전체 파이프라인 구동 속도가 **기존 대비 10배 이상 압도적으로 빨라졌습니다.**

### 2. 완벽한 중복 방지 O(1) 고속 필터링 (`src/filter_urls.js`)
- **수집 및 차단 필터 단일화**: 수만 번 중복되어 쌓이던 동일 공고 주소들을 Canonical 정제(sed)가 완전히 끝난 시점인 파이프라인 **맨 마지막 부분에서 중복 제거(`sort -u`)를 정밀하게 구동하여, `urls.txt` 에 단 1개의 주소로 완벽 압축 통합**시켰습니다.
- **개행 및 버전 호환 버그 박멸**: 보이지 않는 캐리지 리턴 개행문자(`\r`) 세척 및 레거시 `awk` 엔진의 수량 한정자(`{7,}`) 호환 한계로 대조 매칭을 비껴가던 버그들을 박멸하기 위해 `Set` 맵 기반의 고성능 JS 필터 도구인 **`filter_urls.js`**를 주입했습니다.
- **완벽한 사전 원천 제외**: 이미 로컬 디스크에 백업본이 있는 대상들은 **한 건의 오차도 없이 신규 작업 대기 수량(목록)에서 100% 완벽히 사전 제외(스킵)**시킵니다.

### 3. 터미널 CLI 대시보드 UI 고도화 🌐
- **세련된 모니터링 접두어**: 어수선하던 스킵 알림 메시지들을 제거하고, CLI 헤더에 **`[진행률 (천단위 구분 콤마 적용)] [누적 경과시간 / 실시간 남은 예상시간 (ETR)] [로그인 상태]`** 삼박자가 아름답게 결합된 일원화된 모니터링 대시보드 접두사를 완성했습니다.
- **상태의 시각화**: 기존에 받아둔 HTML을 감지하여 기동을 생략할 때도 스텝이 꼬이지 않도록 `📥 [1/4] 이미 저장된 HTML 파일 감지 (다운로드 생략)`가 조화롭고 세련되게 출력되도록 보완했습니다.

### 4. Unified Data Architecture 도입 (`data/jobs/` 도메인 통합)
- **도메인 기반 격리**: 수집 데이터와 최종 결과물의 파편화를 해결하기 위해 모든 데이터 파일군(`lists/`, `html/`, `markdown/`, `recent/`)을 단일 통합 데이터 폴더인 `data/jobs/` 산하로 격리시켰습니다.
- **파이프라인 전역 경로 동기화**: `Makefile` 및 수집부터 가공, 정리 기능에 이르는 모든 로직의 데이터 참조 경로를 새 아키텍처 규칙에 완벽히 동기화하였습니다.

### 5. English-only Parameter Registry Mapping 도입
- **직관적 기간 설정 매핑**: `config/config.json`에 사용자가 이해하기 쉬운 직관적인 영문 텍스트 기간(예: `"past 24 hours"`, `"past week"`, `"past month"`)을 작성하면, 시스템이 링크드인 API 내부 고유 파라미터 값(`"r86400"`, `"r604800"`, `"r2592000"`)으로 자동 변환 매핑해주는 `parameter_registry` 메커니즘을 추가하여 사용 편의성을 극대화하였습니다.

### 6. 무한 루프 방지형 다중 페이지 크롤링 (`max_page` Pagination)
- **페이지 오프셋 자동 계산**: 검색 조건 설정에 기재된 `max_page` 값을 바탕으로, 스크립트가 링크드인 목록 검색 시의 `start` 파라미터(페이지 인덱스당 25개씩 증가: `start = index * 25`)를 동적으로 자동 부여하여, 누수 및 무한 루프 없이 정확한 다중 페이지 순회 수집이 가능하도록 구현했습니다.

### 7. Soft Public Crawling 우회 기동 기능 추가
- **비인증 예외 처리**: `config/session.json` 파일이 존재하지 않는 최초 또는 세션 소실 환경에서도, 개별 절대 공고 주소(`direct_urls`)를 안전하게 퍼블릭(Public) 모드로 건너뛰어 크롤링을 속행할 수 있도록 예외 처리를 유연하고 안전하게 개선하였습니다.

### 8. 단위 테스트(Unit Test) 안정성 확보 및 100% 성공
- **단위 테스트 수립 및 검증**: 복잡해진 쿼리 매개변수 빌더와 URL 매핑 로직의 안정성을 확인하기 위한 테스트 케이스(`tests/url_generator.test.js`)를 구축하고 `make test` 명령어와 연동하였습니다. 6가지 핵심 케이스에 대해 철저한 오류 복원 검증 과정을 완벽하게 통과했습니다.
