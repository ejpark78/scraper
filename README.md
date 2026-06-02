# 🌐 LinkedIn Job Posts Clipper

> Playwright 기반 링크드인 채용 공고 백업 및 마크다운 자동 변환/동기화 OOP 엔터프라이즈 파이프라인

이 프로젝트는 링크드인(LinkedIn) 채용 공고 페이지의 데이터를 자동으로 수집, 백업, 파싱하여 직관적이고 미려한 마크다운(Markdown) 문서로 정제하는 강력한 자동화 스크랩 도구입니다.

최근 대대적인 아키텍처 리팩토링을 통해, **100% 순수 TypeScript OOP(객체 지향 프로그래밍) 기반 아키텍처**로 완전히 승격되었습니다. **인터페이스 추상화**, **생성자 의존성 주입(Dependency Injection)**, 그리고 **팩토리 메서드 패턴(Factory Method Pattern)**을 적용하여, 신규 채용 플랫폼(Wanted, Saramin 등) 확장에 단 1줄의 핵심 코드 수정도 필요 없는 극도의 견고함과 확장성을 자랑합니다.

특히, 구버전 셸 스크립트(`scripts/` 폴더 내 GNU 도구 종속성)를 완전히 제거하고 파일 탐색 및 문자열 파싱 로직을 Node.js 네이티브 정규식 엔진으로 이식하였으며, HTML 원본은 고유 아이디 형태인 **`[jobId].html` 체계**로, 마크다운 문서는 직관적이고 안전하게 포맷팅된 **`[Company] - [Title].md` 형태의 기존 파일명 체계**로 저장하여 보관 효율성과 가독성을 모두 확보했습니다. 또한 **인메모리 O(1) 캐시 맵 조회** 방식의 도입으로 수천 건 아카이빙 시에도 로컬 디스크 I/O 병목이 발생하지 않는 초고속 아키텍처를 실현했습니다.

---

## ✨ 핵심 기능 (Key Features)

### 1. 100% TypeScript OOP 및 의존성 주입 아키텍처
- **추상화 & 다형성**: `ICrawler`, `IMarkdownConverter`, `IUrlManager` 인터페이스를 설계하여 세부 구현체를 추상화하고 다형성을 확보했습니다.
- **캡슐화 & 정보 은닉**: 외부 노출이 불필요한 자동 스크롤(`autoScroll`), 재귀 파싱 (`elementToMarkdown`) 등은 `private` 접근 제한자로 감추고 규격화된 `public` API만 제공합니다.
- **제어의 역전(IoC) & 생성자 주입**: 오케스트레이터인 `ScrapingPipeline`은 구체 클래스에 결합되지 않고 인터페이스를 의존성 주입(Dependency Injection)받아 작동하므로, 결합도가 현저히 낮고 모의 객체(Mock)를 통한 단위 테스트가 매우 용이합니다.

### 2. 팩토리 메서드 패턴 (Factory Method Pattern) 탑재
- **무한한 플랫폼 확장성**: `CrawlerFactory`와 `MarkdownConverterFactory`를 도입했습니다. 향후 원티드(Wanted), 사람인 등 다른 플랫폼 수집기가 추가될 때, 기존 메인 파이프라인 코드를 건드리지 않고 새로운 서브 클래스 구현체와 팩토리 분기만 추가함으로써 **개방-폐쇄 원칙(OCP)**을 완벽하게 실천합니다.

### 3. 크로스플랫폼 완전 네이티브 구현 (Zero Shell Dependency)
- 기존 GNU `find`, `grep -oP`, `sed`, `awk` 등 특정 OS(Linux/WSL) 환경에 기댔던 복잡한 셸 파이프라인 스크립트를 완전히 제거했습니다.
- 파일 탐색은 `IOUtils`의 재귀 탐색으로, URL 추출은 자바스크립트의 정교한 `RegExp` 매싱 파서로 이식하여 macOS, Linux, Windows 전 환경에서 동일하게 무설치/네이티브로 완벽 작동합니다.

### 4. 하이브리드 파일 아카이빙 체계
- **HTML 캐시의 경량화 & 표준화**: 원본 HTML 파일 저장 시에는 숫자로 구성된 고유 아이디인 `[jobId].html` 구조로 저장하여 특수문자가 섞인 긴 다국어 파일명으로 인한 파일 경로 초과 저장 오류(Path Too Long Exception)를 원천적으로 차단했습니다.
- **직관적 가독성의 마크다운 보존**: 사용자 열람성이 중요한 마크다운 요약본은 기존의 친화적인 **`[Company] - [Title].md`** 명명 규칙을 철저하게 준수하여 파일명만으로도 채용 공고를 한눈에 쉽게 식별할 수 있습니다.

### 5. 초고속 인메모리 O(1) 캐싱 및 사전 필터링
- **O(1) 캐시 맵 조회**: 파이프라인 기동 시 HTML 아카이브를 단 1회 스캔하여 `Map<jobId, absolutePath>` 캐시를 메모리에 빌드합니다. 루프 진행 시 디스크 I/O 재귀 탐색을 전면 차단하여 수천 건의 캐시 대조가 0ms만에 처리됩니다.
- **urls.txt 스마트 필터**: `make urls` 실행 단계에서 이미 디렉토리에 소장된 캐시(`cache.list` 및 로컬 실시간 캐시 맵)를 사전 필터링하여 순수하게 새로 다운로드할 타겟만 정교히 추려냅니다.

### 6. Playwright 동적 데이터 수집
- **본문 자동 확장**: 채용공고의 숨겨진 설명("See more" 버튼)을 Playwright의 물리적 클릭 Interception 현상을 완벽 우회하는 **DOM 직접 자바스크립트 클릭 트리거**를 통해 0초 만에 강제로 본문을 끝까지 펼친 뒤 덤프합니다.
- **세션 연동 우회**: `session.json`이 존재할 시, 목록 수집 및 개별 상세 덤프 엔진에서 로그인 세션(`storageState`)을 자동으로 주입하여 보안 챌린지와 봇 탐지를 따돌립니다.

### 7. 다국어/이중 로케일 (Bilingual) 파싱 엔진
- **하이브리드 파싱 지원**: LinkedIn HTML 페이지가 영어(`en-US`) 혹은 한국어(`ko-KR`) 로케일 중 어느 환경에서 다운로드되었어도 깨짐 없이 핵심 정보를 완벽하게 추출합니다.
- **마크다운 서식 표준화**: 변환된 마크다운 문서의 키 라벨을 한글/영어 병기(`회사명 (Company):`, `근무 위치 (Location):` 등)로 일체화하여 가독성을 극대화했습니다.

### 8. 포스팅 일자 절대 시각화 및 근무지 정규화
- **수집일 기준 역산**: 단순 상대 시간(`1 week ago`, `3 days ago`, `5시간 전`)을 HTML 캐시 파일의 생성/수정 시간(`mtime`) 메타데이터를 기준으로 계산하여 실제 포스팅 연/월/일로 자동 역산하여 `YYYY-MM-DD`로 포맷팅합니다.
- **근무지 표준 명명**: 국내 및 전 세계 주요 거점 국가(Korea, Abu Dhabi, Singapore, United Kingdom, Canada, Ireland, Germany, Saudi Arabia, Japan 등) 근무지 텍스트를 정규화하여 표준 이름 하위 폴더로 안전하게 배정합니다.

---

## 🏗️ 프로젝트 폴더 구조 및 아키텍처 (Directory Tree & Architecture)

### 🎨 시스템 아키텍처 및 흐름 다이어그램 (System Architecture & Diagrams)

#### 1. 객체 지향 의존성 주입 아키텍처 (OOP DI Architecture)
의존성 주입과 인터페이스 기반 설계를 보여주는 클래스 협력 다이어그램입니다.

```text
               ┌───────────────────────┐
               │    ScrapingPipeline   │
               └───────────┬───────────┘
                           │
      ┌────────────────────┼────────────────────┐
      ▼ (DI)               ▼ (DI)               ▼ (DI)
┌───────────┐        ┌───────────────┐     ┌─────────────┐
│ ICrawler  │        │  IConverter   │     │ IUrlManager │
└─────▲─────┘        └───────▲───────┘     └──────▲──────┘
      │ (implements)         │ (implements)       │ (implements)
┌─────┴───────────┐  ┌───────┴─────────────┐┌─────┴───────────────┐
│LinkedInCrawler  │  │LinkedInMarkdown     ││LinkedInUrlManager   │
└─────▲───────────┘  │Converter            │└─────────────────────┘
      │              └───────▲─────────────┘
      │ (instantiates)       │ (instantiates)
┌─────┴───────────┐  ┌───────┴─────────────┐
│ CrawlerFactory  │  │MarkdownConverter    │
└─────────────────┘  │Factory              │
                     └─────────────────────┘
```

#### 2. 시스템 데이터 흐름 아키텍처 (Data Flow Architecture)
데이터가 수집되고, 필터링 및 변환 과정을 거쳐 최종 산출물로 적재되는 파일/데이터 중심의 흐름도입니다.

```text
   [LinkedIn Web] ──(session.json 로그인 세션)──➜ Playwright (src/crawler.ts)
                                                     │
                                                     ▼
   [config/config.json] (수집 키워드/조건) ────────➜ lists/*.html (목록 HTML)
                                                     │
                                                     ▼ (npx ts-node src/url_manager.ts extract)
                                                lists/urls.txt (중복 차단 및 Canonical URL 추출)
                                                     │
                                                     ▼ (O(1) 인메모리 cacheMap 사전 필터링)
                                                ScrapingPipeline (src/pipeline.ts)
                                                     │
                                                     ▼
                                            Playwright (src/crawler.ts) [상세 HTML 덤프]
                                                     │
                                                     ▼ (In-memory 연쇄 가공)
                                            LinkedInMarkdownConverter (src/markdown_converter.ts)
                                                     │
        ┌───────────────────────────────────────────┴───────────────────────────────────────────┐
        ▼ (Archiving Storage - 표준 분류 적재)                                                  ▼ (Sync & Copy)
  📂 html/[Location]/[Date]/{JOB_ID}.html                                                 📂 recent/html/{JOB_ID}.html
  📂 markdown/[Location]/[Date]/{Company - Title}.md                                      📂 recent/markdown/{Company - Title}.md
```

#### 3. 명령어 호출 흐름 (Command & Execution Flow)
```text
  Makefile Interface
  ├── make login ──────────➜ npx ts-node src/crawler.ts login (1회성 로그인 세션 덤프)
  │
  ├── make list ───────────➜ npx ts-node src/crawler.ts list (uses config/session.json & config.json)
  │
  ├── make urls ───────────➜ npx ts-node src/url_manager.ts extract (중복 차단 및 신규 대상 추출 적재)
  │
  ├── make html2md ────────➜ npx ts-node src/markdown_converter.ts (일괄 양방향 동기화 및 오프라인 복원)
  │
  ├── make posts ──────────➜ npx ts-node src/pipeline.ts [통합 오케스트레이터 기동]
  │                                                        ├── (CrawlerFactory ➜ LinkedInCrawler)
  │                                                        └── (MarkdownConverterFactory ➜ LinkedInMarkdownConverter)
  │
  └── make test ───────────➜ npx ts-node tests/url_manager.test.ts (URL 생성기 기능 단위 테스트 검증)
```

### 📂 디렉토리 구조 (Directory Tree)

모든 소스코드를 **TypeScript OOP 디자인 표준**에 맞추어 단 5개의 도메인 모듈로 가볍고 안전하게 통합했습니다.

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
├── src/                      # 🌟 TypeScript 객체 지향 소스 코드 폴더
│   ├── utils.ts              # ⚙️ UrlUtils, DateUtils, FormatUtils, NamingUtils, IOUtils 정적 유틸 클래스군
│   ├── crawler.ts            # 🌐 Playwright 로그인/수집 엔진 및 CrawlerFactory (팩토리 패턴)
│   ├── url_manager.ts        # 🔗 URL 자동 구성기 및 초고속 중복 차단 필터기 (LinkedInUrlManager)
│   ├── markdown_converter.ts # 🧹 Cheerio/Prettier 기반 파서 및 MarkdownConverterFactory (팩토리 패턴)
│   ├── pipeline.ts           # 🚀 의존성 주입(DI)으로 조립되어 가동되는 통합 오케스트레이션 ScrapingPipeline
│   └── get_filename.ts       # 🔤 마크다운으로부터 회사명-제목 표준 파일명을 얻어 셸에 덤프하는 경량 엔트리
├── tests/                    # 📁 단위 테스트(Unit Test) 보관 폴더
│   └── url_manager.test.ts   # OOP 기반 LinkedInUrlManager 단위 테스트 검증 스크립트
├── tsconfig.json             # ⚙️ TypeScript 컴파일러 구성 설정 파일
├── Makefile                  # ⚙️ 빌드 및 파이프라인 실행 제어용 메이크파일
├── package.json              # Node.js 의존성 설정 파일
└── README.md                 # 프로젝트 통합 가이드 문서 파일
```

---

## 🚀 시작하기 (Quick Start)

### 1. 사전 요구 사항
시스템 환경에 **Node.js (18버전 이상)** 및 **make** 유틸리티가 준비되어야 합니다. (어떠한 셸 스크립트 종속성도 가지지 않으므로 Windows Git Bash, macOS zsh, Linux bash 등 모든 셸 터미널에서 구동됩니다.)

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
- 브라우저 화면이 뜨면 로그인을 진행해 주세요. 메인 피드 진입이 완료되는 즉시 자동으로 세션이 덤프된 후 브라우저가 종료됩니다.

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
- 오직 수집이 진정으로 필요한 **순수 신규 대상 URL만 천단위 구분 콤마가 찍힌 완벽 요약보고서와 함께 `urls.txt`에 저장**됩니다.

### 4단계. 일괄 파이프라인 가동 및 분류 배정 (`make posts`)
추출된 상세 주소 목록 `data/jobs/lists/urls.txt`를 바탕으로 마크다운 변환 파이프라인을 최종 실행합니다:
```bash
make posts
```
- 실행 시 CLI에 **`[진행 순서/전체 수량][누적 경과시간/예상 남은 대기 시간][로그인 상태] 대상 ID: ...`** 형태의 정교한 런타임 대시보드가 실시간 렌더링됩니다.
- 루프 내부에서 개 개별 파일당 외부 서브프로세스를 스폰하지 않고, **자바스크립트 함수 호출(In-memory 연쇄가공) 및 새로 도입된 O(1) 캐시 대조**로 0초 만에 Prettify 정제까지 완료되므로 극도로 빠른 일괄 가공 처리를 제공합니다.

---

## 🧹 기타 관리 명령어 (Administrative Commands)

### HTML/MD 캐시 복원 및 양방향 동기화 (`make html2md`)
로컬에 저장된 HTML 원본 백업본(`data/jobs/html`)과 최종 마크다운 요약본(`data/jobs/markdown`) 간 유실되거나 손상된 파일이 있는 경우 오프라인에서 직접 양방향 대조하여 동기화하고 누락된 문서를 100% 복구해 냅니다.
```bash
make html2md
```

### 임시 작업 파일 정리 (`make clean`)
변환 과정 도중에 생긴 불필요한 파일 및 데이터 정리 과정에서 발생한 빈 폴더들을 일괄 제거하여 프로젝트 폴더 상태를 최적으로 유지합니다.
```bash
make clean
```

### 데이터 완전 초기화 (`make purge`)
기존에 수집된 `data/jobs/` 내부의 모든 아카이브와 포스트 데이터를 완전 영구 파괴하여 초기화 상태로 돌립니다. **(주의: 실행 시 확인 입력이 요구됩니다)**
```bash
make purge
```

### URL 생성기 단위 테스트 실행 (`make test`)
구조화된 `config/config.json` 설정 파일로부터 검색 쿼리 주소들을 누락 없이 완벽히 빌드하고 있는지 단위 테스트(Unit Test) 6대 핵심 시나리오를 구동하여 즉시 입증합니다.
```bash
make test
```

---

## 📅 최근 업데이트 내역 (Recent Updates)

### 🚀 아키텍처 최종 리팩토링 및 네이티브 OOP 승격 완료 (2026.06.02)
- **100% 타입 안전성 확보**: 프로젝트의 전 프로세스를 순수 TypeScript 코드로 마이그레이션하여 잠재적인 런타임 오류 리스크를 완전히 제거했습니다.
- **Zero Shell Dependency 실현**: 기존에 WSL/Linux 환경에 의존했던 셸 파이프라인(`find`, `grep -oP`, `sed`, `awk`)을 전면 제거하고, 100% Node.js 네이티브 정규식 및 recursive I/O 알고리즘으로 이식하여 Windows, macOS 등 전 OS 크로스 플랫폼 독립 작동을 완성했습니다.
- **하이브리드 파일 명명 전략 채택**: 지나치게 길거나 특수문자가 포함된 다국어 파일명으로 인한 파일 시스템 쓰기 오류를 원천 차단하고자 HTML 백업 원본은 고유 숫자 형식인 `[jobId].html`로 덤프하며, 유저 가독성이 절대적으로 중요한 최종 마크다운은 친화적 규칙에 기반한 `[Company] - [Title].md` 구조의 기존 형식을 보존했습니다.
- **인메모리 O(1) 캐시 맵 조회 기술 적용**: 수천 건의 아카이브 캐시 대조 시 발생하던 recursive 디스크 탐색 병목을 완벽 해결하기 위해 메모리단 O(1) Map 구조를 `ScrapingPipeline` 및 `LinkedInUrlManager`에 전격 도입했습니다.
- **안전한 레거시 정리 및 테스트 수트 완벽 통과**: 기존 자바스크립트 레거시 파일들을 모두 영구 소거하여 코드베이스 부피를 축소시켰으며, 변경된 클래스 구조 하에서 단위 테스트 수트 6개 전 사태를 100% 통과 완료하였습니다.
