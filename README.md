# 🌐 LinkedIn Job & Company Posts Clipper

> Playwright 기반 링크드인 채용 공고 및 회사 상세 프로필 백업/마크다운 자동 변환/동기화 OOP 엔터프라이즈 파이프라인

이 프로젝트는 링크드인(LinkedIn) 채용 공고 페이지 및 회사 상세 정보 페이지(`/about/`)의 데이터를 자동으로 수집, 백업, 파싱하여 직관적이고 미려한 마크다운(Markdown) 문서로 정제하는 강력한 자동화 스크랩 도구입니다.

최근 아키텍처 리팩토링을 통해 **100% 순수 TypeScript OOP(객체 지향 프로그래밍) 기반 아키텍처**로 완전히 승격되었습니다. **인터페이스 추상화**, **생성자 의존성 주입(Dependency Injection)**, 그리고 **팩토리 메서드 패턴(Factory Method Pattern)**을 적용하여 높은 견고함과 확장성을 자랑하며, **채용 공고 도메인(`data/jobs`)**과 **회사 정보 도메인(`data/compay`)**을 깔끔하게 이중화하여 지원합니다.

---

## ✨ 핵심 기능 (Key Features)

### 1. 100% TypeScript OOP 및 의존성 주입 아키텍처
* **추상화 & 다형성**: `ICrawler`, `IMarkdownConverter`, `IUrlManager` 인터페이스를 설계하여 세부 구현체를 추상화하고 다형성을 확보했습니다.
* **캡슐화 & 정보 은닉**: 외부 노출이 불필요한 자동 스크롤(`autoScroll`), 재귀 파싱 (`elementToMarkdown`) 등은 접근 제한자로 감추고 규격화된 `public` API만 제공합니다.
* **제어의 역전(IoC) & 생성자 주입**: 파이프라인은 구체 클래스에 결합되지 않고 인터페이스를 의존성 주입(Dependency Injection)받아 작동하므로, 결합도가 현저히 낮고 테스트가 용이합니다.

### 2. 팩토리 메서드 패턴 (Factory Method Pattern) 탑재
* **무한한 플랫폼 확장성**: `CrawlerFactory`와 `MarkdownConverterFactory`를 도입했습니다. 향후 다른 플랫폼 수집기가 추가될 때, 기존 메인 파이프라인 코드를 건드리지 않고 새로운 서브 클래스 구현체와 팩토리 분기만 추가함으로써 **개방-폐쇄 원칙(OCP)**을 완벽하게 실천합니다.

### 3. 크로스플랫폼 완전 네이티브 구현 (Zero Shell Dependency)
* 셸 파이프라인 스크립트 종속성을 완전히 제거하여, macOS, Linux, Windows 전 환경에서 동일하게 무설치/네이티브로 완벽 작동합니다.

### 4. 하이브리드 파일 아카이빙 체계
* **공고 HTML 원본**: 숫자로 구성된 고유 아이디인 `[jobId].html` 구조로 저장하여 특수문자가 섞인 긴 다국어 파일명으로 인한 파일 경로 초과 저장 오류(Path Too Long)를 차단했습니다.
* **마크다운 보존**: 사용자 열람성이 중요한 마크다운 요약본은 친화적인 **`[Company] - [Title].md`** 명명 규칙을 철저하게 준수합니다.

### 5. 초고속 인메모리 O(1) 캐싱 및 사전 필터링
* **O(1) 캐시 맵 조회**: 파이프라인 기동 시 HTML 아카이브를 단 1회 스캔하여 `Map<jobId, absolutePath>` 캐시를 메모리에 빌드합니다. 루프 진행 시 디스크 I/O 재귀 탐색을 전면 차단하여 수천 건의 캐시 대조가 0ms만에 처리됩니다.

### 6. Playwright 동적 데이터 수집
* **본문 자동 확장**: 채용공고의 숨겨진 설명("See more" 버튼)을 자바스크립트 클릭 트리거를 통해 0초 만에 강제로 본문을 끝까지 펼친 뒤 덤프합니다.
* **세션 연동 우회**: `session.json`이 존재할 시, 목록 수집 및 개별 상세 덤프 엔진에서 로그인 세션(`storageState`)을 자동으로 주입하여 보안 챌린지와 봇 탐지를 따돌립니다.

### 7. 🏢 회사 프로필 (/about) 스크래퍼 및 하이브리드 파싱 엔진 (New)
* **하이브리드 정보 추출**: HTML 내의 `<code id="bpr-guid-...">` 영역 내의 `Company` JSON 데이터 모델(Voyager State)을 정규식 및 JSON.parse로 우선 추출하고, 실패하거나 필드가 누락될 시에만 Cheerio DOM 셀렉터로 Fallback하는 강력한 아키텍처를 적용했습니다.
* **디코딩된 다국어 파일명 & URL**: 회사 ID 대신 실제 회사명(Korean, English, Chinese, Japanese 등)으로 파일 이름을 안전하게 명명하며, 마크다운 내 프론트매터의 `linkedin_` 필드에 퍼센트 인코딩이 해제(URL Decode)된 주소를 저장합니다.
* **국가명 기반 자동 분류 (Full Country-Name Folder)**: 본사 주소의 국가 코드(ISO 2-letter)를 사람이 읽기 쉬운 표준 영문 국가명(예: `South Korea`, `United States`, `United Arab Emirates` 등)으로 변환하여 하위 디렉토리를 구축함으로써 파일 과다 보관 문제를 방지합니다.
* **세션 만료 감지 차단**: 스크래핑 도중 로그인 만료로 인해 로그인 창(Auth Wall)이 감지되면 수집을 강행하지 않고 즉시 파이프라인을 중단하여 리소스를 보존하고 사용자에게 재로그인(`make login`) 가이드를 제공합니다.

---

## 🏗️ 프로젝트 폴더 구조 및 아키텍처 (Directory Tree & Architecture)

### 🎨 시스템 아키텍처 및 흐름 다이어그램 (System Architecture & Diagrams)

#### 1. 시스템 데이터 흐름 아키텍처 (Data Flow Architecture)
```text
   [LinkedIn Web] ──(session.json 로그인 세션)──➜ Playwright (src/crawler.ts)
                                                      │
                                                      ├────────────────────────────────┐
                                                      ▼ [채용공고 도메인]              ▼ [회사정보 도메인]
                                                 lists/urls.txt                  lists/compay.txt
                                                      │                                │
                                                      ▼                                ▼
                                              Pipeline (src/pipeline.ts)     CompanyPipeline (src/company_pipeline.ts)
                                                      │                                │
                                                      ▼                                ▼
                                              [공고 상세 HTML/MD]             [회사 상세 HTML/MD]
                                            📂 html/[Location]/[Date]       📂 html/[FullCountryName]/
                                            📂 markdown/[Location]/[Date]   📂 markdown/[FullCountryName]/
```

#### 2. 명령어 호출 흐름 (Command & Execution Flow)
```text
  Makefile Interface
  ├── make login ──────────────➜ npx ts-node src/crawler.ts login (1회성 로그인 세션 덤프)
  │
  ├── make list ───────────────➜ npx ts-node src/crawler.ts list (채용 검색 결과 목록 덤프)
  │
  ├── make urls ───────────────➜ npx ts-node src/url_manager.ts extract (신규 채용공고 URL 추출)
  │
  ├── make posts ──────────────➜ npx ts-node src/pipeline.ts (채용공고 파이프라인 가동)
  │
  ├── make company ────────────➜ npx ts-node src/company_pipeline.ts (회사정보 파이프라인 가동)
  │
  ├── make company-reconvert ──➜ rm & reconvert (회사 캐시로부터 마크다운 일괄 재생성)
  │
  └── make test ───────────────➜ npx ts-node tests/url_manager.test.ts (단위 테스트 검증)
```

### 📂 디렉토리 구조 (Directory Tree)
```text
├── data/                     # 📁 수집 및 정제 데이터 저장 폴더
│   ├── jobs/                 # 💼 채용공고 Clipper 도메인 격리 공간
│   │   ├── html/             # 아카이빙된 공고 HTML (국가별/날짜별)
│   │   └── markdown/         # 최종 정제된 공고 마크다운 (국가별/날짜별)
│   └── compay/               # 🏢 회사 프로필 Clipper 도메인 격리 공간
│       ├── html/             # 아카이빙된 회사 HTML (표준 국가명 서브디렉토리 분류)
│       ├── markdown/         # 최종 정제된 회사 마크다운 (표준 국가명 서브디렉토리 분류)
│       └── lists/
│           ├── compay.txt    # 수집 대상 회사 URL 원본 목록 리스트
│           └── cache.list    # 로컬에 수집 완료된 회사 고유 ID 캐시 목록 인덱스
├── config/                   # 📁 설정 및 로그인 세션 저장 폴더
│   ├── config.json           # 수집 키워드/지역 제어 통합 JSON 설정 파일
│   └── session.json          # Playwright 덤프 로그인 세션 정보 파일
├── src/                      # 🌟 TypeScript 객체 지향 소스 코드 폴더
│   ├── utils.ts              # ⚙️ UrlUtils, DateUtils, NamingUtils, IOUtils 등 유틸리티 클래스
│   ├── crawler.ts            # 🌐 Playwright 로그인/수집 및 CrawlerFactory
│   ├── url_manager.ts        # 🔗 URL 자동 구성기 및 중복 차단 필터기
│   ├── markdown_converter.ts # 🧹 채용공고 Cheerio/Prettier 기반 파서 및 팩토리
│   ├── pipeline.ts           # 🚀 채용공고 통합 오케스트레이션 ScrapingPipeline
│   ├── company_converter.ts  # 🏢 회사 정보 JSON/DOM 하이브리드 파서 (CompanyMarkdownConverter)
│   ├── company_pipeline.ts   # 🚀 회사 정보 통합 오케스트레이션 CompanyScrapingPipeline
│   └── reconvert_all.ts      # ♻️ 회사 HTML 캐시로부터 마크다운을 일괄 재생성/마이그레이션하는 도구
├── tests/                    # 📁 단위 테스트(Unit Test) 폴더
├── tsconfig.json             # ⚙️ TypeScript 설정 파일
├── Makefile                  # ⚙️ 빌드 및 파이프라인 실행 제어용 메이크파일
└── README.md                 # 프로젝트 통합 가이드 문서 파일
```

---

## 🚀 시작하기 (Quick Start)

### 1. 사전 요구 사항
시스템 환경에 **Node.js (18버전 이상)** 및 **make** 유틸리티가 준비되어야 합니다.

### 2. 의존성 패키지 설치
```bash
npm install
```

### 3. Playwright 브라우저 바이너리 설치
```bash
npx playwright install chromium
```

---

## 💼 채용공고 수집 가동 방법 (Job posts Flow)

### 1단계. 1회성 로그인 세션 획득 (`make login`)
최초 실행 시 (또는 세션 만료 시), 1회성으로 수동 로그인을 진행하여 세션을 안전하게 파일로 저장합니다.
```bash
make login
```
* 브라우저 화면이 뜨면 로그인을 진행해 주세요. 메인 피드 진입이 완료되는 즉시 세션이 덤프된 후 브라우저가 자동 종료됩니다.

### 2단계. 채용 목록 무인 덤프 (`make list`)
```bash
make list
```
* `config/config.json` 설정을 참조하여 백그라운드 스크롤을 기동하여 목록 검색 HTML을 수집합니다.

### 3단계. 상세 URL 추출 및 필터링 (`make urls`)
```bash
make urls
```
* 중복 및 기수집된 대상을 제외하고 `data/jobs/lists/urls.txt`에 신규 타겟을 추출 적재합니다.

### 4단계. 일괄 파이프라인 가동 (`make posts`)
```bash
make posts
```
* 진행 시간과 ETR 대시보드 출력과 함께, 수집 및 마크다운 변환이 순차 처리됩니다.

---

## 🏢 회사 프로필 수집 가동 방법 (Company Profile Flow)

### 1단계. 수집 대상 리스트 준비
* 수집 대상 회사 URL 목록을 `data/jobs/lists/compay.txt` 파일에 한 줄에 하나씩 작성합니다.

### 2단계. 파이프라인 실행
```bash
make company
```
* Playwright가 구동되어 `session.json` 정보를 주입하여 회사 `/about` 페이지를 스크래핑합니다.
* 파이프라인 가동 중에 언제든지 `Ctrl + C`를 눌러 수집을 중단할 수 있으며, 재기동 시 성공한 회사는 건너뛰고 이어서 안전하게 수집됩니다.

### 3단계. 회사 마크다운 재생성 및 갱신 (선택 사항)
```bash
make company-reconvert
```
* 이 명령어는 기존 마크다운을 전부 삭제하고, 로컬 디스크에 백업된 HTML 캐시들을 파싱하여 표준 국가명 서브디렉토리에 마크다운 문서를 일괄 다시 써서 갱신합니다.

---

## 🧹 기타 관리 명령어 (Administrative Commands)

### 채용공고 캐시 복원 및 동기화 (`make html2md`)
```bash
make html2md
```
* 채용공고의 로컬 HTML 원본과 마크다운 요약본 간의 불일치를 동기화하여 유실된 마크다운을 복구합니다.

### 데이터 완전 초기화 (`make purge`)
```bash
make purge
```
* 수집된 모든 채용공고 데이터를 영구 삭제합니다. (회사 프로필 데이터는 삭제 대상에서 배제하여 안전하게 보호됩니다.)
