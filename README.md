# 🌐 LinkedIn Job Posts Clipper

> Playwright 기반 링크드인 채용 공고 백업 및 마크다운 자동 변환 파이프라인 도구

이 프로젝트는 링크드인(LinkedIn) 채용 공고 페이지의 데이터를 자동으로 수집, 백업, 파싱하여 직관적이고 미려한 마크다운(Markdown) 문서로 정제하는 강력한 자동화 스크랩 도구입니다.

---

## ✨ 핵심 기능 (Key Features)

### 1. 동적 데이터 수집 및 캐싱 (Playwright `en-US` 로케일 적용)
- **본문 자동 확장**: 채용공고의 숨겨진 설명("See more" 버튼)을 자동으로 감지하고 클릭하여 본문 전체를 완벽하게 로드한 뒤 저장합니다.
- **`en-US` 로케일 표준화**: Playwright 브라우저 컨텍스트의 로케일을 `en-US`로 표준 기입하여, LinkedIn 인터페이스 레이아웃을 영어 기준으로 균일하게 수집하며 수집 보안 차단을 최소화합니다.
- **스마트 재배치 및 무중단 캐싱**: 하위 디렉토리에 캐싱된 HTML 파일이 존재한다면, 네트워크 요청을 즉시 스킵하여 가속합니다. 기존 다른 디렉토리에 흩어져 있던 캐시는 정제 시점에 새 분류 체계에 맞춰 자동으로 위치를 바로잡아 정렬합니다.

### 2. 다국어/이중 로케일 (Bilingual) 파싱 엔진
- **하이브리드 파싱 지원**: LinkedIn HTML 페이지가 영어(`en-US`) 혹은 한국어(`ko-KR`) 로케일 중 어느 환경에서 다운로드되었어도 깨짐 없이 핵심 정보를 완벽하게 추출합니다.
- **마크다운 서식 정밀화**: 변환된 마크다운 문서의 키 라벨을 한글/영어 병기(`회사명 (Company):`, `근무 위치 (Location):` 등)로 표준화하여 가독성과 범용성을 동시에 극대화했습니다.

### 3. URL 청소 및 Canonical화 (`get_urls.sh`)
- **상대 경로 승격**: `/jobs`로 시작하는 링크드인 내 상대 주소를 절대 주소(`https://www.linkedin.com/jobs/...`)로 복원합니다.
- **파라미터 박멸**: 추적용 쿼리 스트링(`/?eBP=...` 등)을 깨끗이 지우고 끝에 슬래시(`/`)만 남겨 Canonical한 형태의 고유 URL로 가공합니다.

### 4. 포스팅 상대 일자를 절대 시각으로 변환 (`html2md.js`)
- **수집일 기준 역산**: 단순 상대 시간(`1 week ago`, `3 days ago`, `5시간 전`)을 HTML 캐시 파일의 생성/수정 시간(`mtime`) 메타데이터를 기준으로 계산하여 실제 포스팅 연/월/일로 자동 역산합니다.
- **유연한 절대 날짜 파싱**: 메타 설명에 적힌 `Posted March 15, 2026`과 같은 절대 포스팅 일자 또한 유효한 타임스탬프로 해독하여 정확히 매칭합니다.
- **표준화된 `YYYY-MM-DD` 포맷**: 역산되거나 획득된 날짜 정보를 프로그램 제어 및 정렬이 직관적인 **`YYYY-MM-DD`** 형태로 정제합니다.

### 5. 근무지 표준화 분류 체계 (`get_posts.sh` & `html2md.sh`)
- **위치 기반 계층 폴더**: `html/` 및 `posts/` 하위에 `[근무지]/[포스팅날짜]/` 구조로 깊게 분류합니다.
- **지리 그룹화 및 국가 정규화 규칙**:
  - `South Korea`, `Seoul`, `Korea`, `서울`, `대한민국` 등이 포함된 근무지는 일관되게 **`Korea`** 폴더에 소속됩니다.
  - `Abu Dhabi`, `Dubai`, `United Arab Emirates`, `아랍에미리트` 등은 **`Abu Dhabi`** 폴더에 정밀화합니다.
  - `Singapore` 관련 주소는 **`Singapore`** 폴더로 통합됩니다.
  - `London Area`, `United Kingdom`, `영국` 등은 **`United Kingdom`** 폴더로 표준화됩니다.
  - `Toronto`, `Canada`, `캐나다` 등은 **`Canada`** 폴더로 표준화됩니다.
  - `Dublin`, `Ireland`, `아일랜드` 등은 **`Ireland`** 폴더로 표준화됩니다.
  - `Marburg`, `Germany`, `독일` 등은 **`Germany`** 폴더로 표준화됩니다.
  - `Riyadh`, `Saudi Arabia`, `사우디` 등은 **`Saudi Arabia`** 폴더로 표준화됩니다.
  - `Shibuya-ku`, `Tokyo`, `Japan`, `일본` 등은 **`Japan`** 폴더로 표준화됩니다.

### 6. 캐시와 산출물의 양방향 동기화 (Double-Sync)
- 셸 기반 일괄 정제 스크립트 실행 시, 마크다운 결과물(`posts/inbox/`) 뿐만 아니라 **수집 원본 HTML 캐시 파일(`html/inbox/`) 또한 표준화된 국가/날짜 분류 폴더 구조 하위로 완벽하게 이동 및 자동 정렬**됩니다.
- 작업 완료 후, 비어 버린 이전 옛날 폴더(ex: `html/inbox/Tokyo, Japan`)들은 자동으로 식별되어 삭제됩니다.

---

## 🏗️ 프로젝트 폴더 구조 및 아키텍처 (Directory Tree & Architecture)

### 🎨 시스템 아키텍처 다이어그램 (ASCII Art)

```text
                      ┌─────────────────────────────────┐
                      │      🛠️  Makefile Interface     │
                      └────────────────┬────────────────┘
                                       │
                                       │ (1) make posts 실행
                                       ▼
                      ┌─────────────────────────────────┐
                      │    🐚 scripts/get_posts.sh      │
                      └────────────────┬────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │ (2) O(1) Pre-Filtering via AWK     │
                    ▼                                     ▼
        ┌───────────────────────┐             ┌───────────────────────┐
        │  📁 list/cache.list   │             │   📄 list/urls.txt    │
        │ (Completed JOB_IDs)   │             │  (Target URL List)    │
        └───────────┬───────────┘             └───────────┬───────────┘
                    │                                     │
                    │      [ Skip Matches / 0.05s ]       │
                    └──────────────────┬──────────────────┘
                                       │ (Only Non-Cached URLs)
                                       ▼
                      ┌─────────────────────────────────┐
                      │    🌐 Playwright (get_html.js)   │
                      └────────────────┬────────────────┘
                                       │
                                       │ (3) Dump Web Elements
                                       ▼
                      ┌─────────────────────────────────┐
                      │   📂 html/inbox/[Loc]/[Date]/   │
                      │        {JOB_ID}.html            │
                      └────────────────┬────────────────┘
                                       │
                                       │ (4) DOM Metadata Parse
                                       ▼
                      ┌─────────────────────────────────┐
                      │     🤖 Cheerio (html2md.js)     │
                      └────────────────┬────────────────┘
                                       │
                                       │ (5) temp_job_raw.md
                                       ▼
                      ┌─────────────────────────────────┐
                      │  📝 get_filename.js & prettify  │
                      └────────────────┬────────────────┘
                                       │
                                       │ (6) Save Pretty Markdown
                                       ▼
                      ┌─────────────────────────────────┐
                      │  📂 posts/inbox/[Loc]/[Date]/   │
                      │      {Company - Title}.md       │
                      └────────────────┬────────────────┘
                                       │
                                ┌──────┴──────┐
                                ▼             ▼
                      ┌───────────┐         ┌───────────┐
                      │ html/new/ │         │posts/new/ │
                      └───────────┘         └───────────┘
```

### 📂 디렉토리 구조 (Directory Tree)

```text
├── html/                     # 원본 HTML 캐시 백업 루트 폴더
├── html/inbox/               # 🌟 국가별/날짜별 캐시 HTML이 완벽하게 분류 정렬되는 아카이빙 폴더
├── html/new/                 # 신규 수집 HTML 복사본 임시 저장 폴더
├── posts/                    # 최종 마크다운(*.md) 결과물 루트 폴더
├── posts/inbox/              # 🌟 국가별/날짜별 표준화 분류 마크다운 폴더
├── posts/new/                # 신규 마크다운 복사본 임시 저장 폴더
├── list/
│   ├── list.html             # 추출 대상 원본 링크드인 목록 HTML
│   └── urls.txt              # 중복 제거 및 가공이 끝난 파이프라인 입력용 URL 리스트
├── src/                      # 🌟 JavaScript 핵심 소스 코드 폴더
│   ├── get_html.js           # Playwright 기반 동적 수집용 크롤링 스크립트 (en-US 설정)
│   ├── html2md.js            # 메타데이터 파싱, 마크다운 이중 라벨 변환 및 절대 날짜 역산 스크립트
│   ├── get_filename.js       # '회사명 - 공고제목' 형태의 안전 파일명 변환 스크립트 (Bilingual 대응)
│   └── prettify.js           # Prettier 구동기반 최종 마크다운 서식 다듬기 스크립트
├── scripts/                  # 📁 셸 스크립트 보관 폴더
│   ├── get_urls.sh           # 목록 HTML에서 Canonical URL 정밀 추출 및 청소 스크립트
│   ├── html2md.sh            # HTML 캐시와 posts 구조를 함께 정렬하는 배치 동기화 셸 스크립트
│   └── get_posts.sh          # 전체 수집, 캐시 검증, 국가/날짜별 양방향 정렬 핵심 셸 스크립트
├── Makefile                  # ⚙️ 빌드 및 파이프라인 실행 제어용 메이크파일
├── package.json              # Node.js 의존성 설정 파일
└── README.md                 # 본 프로젝트 문서 파일
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

프로젝트 루트에 있는 `Makefile`을 통해 전 과정이 유기적으로 자동 기동됩니다.

### 🔄 전체 파이프라인 실행 흐름 (Pipeline Flow)

```text
  ┌───────────────────────────────────────────────────────────┐
  │                 1단계. 로그인 세션 획득                    │
  │                     [make login]                          │
  │    (최초 1회 헤드풀 로그인 ➜ list/session.json 영구 확보)   │
  └──────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
  ┌───────────────────────────────────────────────────────────┐
  │                2단계. 채용 목록 무인 덤프                 │
  │                     [make list]                           │
  │(config.list 내 검색 URL 순회 ➜ list/YYYY-MM-DDTHH_mm_ss.html)│
  └──────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
  ┌───────────────────────────────────────────────────────────┐
  │                3단계. 공고 상세 URL 추출                  │
  │                     [make urls]                           │
  │     (list & html 분석 ➜ list/urls.txt에 Canonical URL 적재) │
  └──────────────────────────────┬────────────────────────────┘
                                 │
                                 ▼
  ┌───────────────────────────────────────────────────────────┐
  │               4단계. 최종 포스트 일괄 변환                │
  │                     [make posts]                          │
  │  (cache.list 대조 O(1) 초고속 스킵 ➜ posts/inbox/ 완벽 가공)│
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
- 브라우저 화면이 뜨면 로그인을 진행해 주세요. 메인 피드 진입이 완료되는 즉시 자동으로 세션이 덤프된 후 종료됩니다.

### 2단계. 채용 목록 무인 백그라운드 덤프 (`make list`)
`list/config.list`에 기재된 채용 검색 및 추천 목록 URL들로부터 전체 HTML 덤프를 완전 무인(Headless)으로 획득합니다:
```bash
make list
```
- 저장된 세션을 활용하여 로그인 벽 없이 즉시 진입한 뒤, 목록 전체를 자동 스크롤 다운하여 렌더링된 결과를 `list/<date>.html` 파일로 자동 저장합니다.

### 3단계. 링크드인 목록 파싱 및 상세 URL 추출 (`make urls`)
수집 및 덤프 완료된 목록 HTML들(`list/` 및 `html/` 하위의 모든 `.html`)에서 채용공고의 Canonical(고유) 상세 주소들을 깨끗하게 정제하여 추출합니다:
```bash
make urls
```
- 상대 주소 복원 및 추적용 파라미터가 모두 청소된 Canonical URL들이 `list/urls.txt`에 누적 및 자동 병합됩니다.

### 4단계. 일괄 파이프라인 가동 및 분류 배정 (`make posts`)
추출된 상세 주소 목록 `list/urls.txt`를 바탕으로 마크다운 변환 파이프라인을 최종 실행합니다:
```bash
make posts
```
*기본 입력 파일 외에 특정 URL 목록을 지정하고 싶은 경우 `URLS` 매개변수를 덮어써서 실행할 수 있습니다:*
```bash
make posts URLS=list/custom_urls.txt
```

---

## 🧹 기타 관리 명령어 (Administrative Commands)

### 임시 파일 정리 (`make clean`)
변환 과정 도중 생성될 수 있는 임시 작업 파일(`temp_job_raw.md`) 및 데이터 정리 과정에서 발생한 빈 하위 폴더들을 일괄 수집하여 안전하게 제거합니다.
```bash
make clean
```

### 데이터 완전 초기화 (`make purge`)
기존에 받아놓은 `html/` 및 `posts/` 전역 데이터를 완전히 일체 삭제하고 정제되지 않은 깨끗한 상태로 복원합니다. **(주의: 실행 시 확인 절차가 요구됩니다)**
```bash
make purge
```

---

## 💡 파이프라인 내부 동작 메커니즘
1. `html/` 디렉토리 전역을 재귀적으로 검색하여 `[공고ID].html` 캐시가 존재하는지 탐색합니다.
2. 이미 수집 이력이 있다면 **[스킵]**하여 불필요한 크롤링 트래픽을 아끼며 초고속으로 파싱 단계로 진입합니다.
3. 최초 수집하는 공고의 경우 Playwright 브라우저를 통해 동적 로드 후 백업합니다.
4. 캐시된 HTML 파일을 분석하여 회사명, 공고명, 근무지, 고용형태, canonical 주소를 획득합니다.
5. HTML 캐시 파일의 생성 시간(`mtime`)과 공고 내 상대일자(`3 days ago`), 정확한 meta 공고 시간/일자를 정교히 계산하여 **`YYYY-MM-DD` 포스팅 절대 날짜**를 복원해 냅니다.
6. 근무지 문자열을 읽고 확장된 지리 표준화 필터(`Korea`, `United Kingdom`, `Japan` 등)를 거쳐 폴더명을 정합니다.
7. HTML 백업 파일과 생성된 마크다운 결과물을 각각 `html/inbox/[근무지]/[포스팅날짜]/` 및 `posts/inbox/[근무지]/[포스팅날짜]/`에 안전하게 배치(필요시 자동 폴더 이동)합니다.
8. 새로 추가된 공고(신규 다운로드 건)의 경우 별도의 복사본을 `html/new/` 및 `posts/new/`에 추가 백업합니다.
9. 최종적으로 Prettier를 호출하여 문단과 마크다운 가독성 서식을 매끄럽게 보정한 최종 결과 파일을 출력합니다.

---

## 📌 마크다운 문서 요약본 최종 서식 예시

모든 문서(`posts/inbox/Japan/2026-05-25/Build+ - Fully Remote - No Japanese needed - Senior Data Engineer.md` 등)는 아래와 같이 완벽한 이중 언어(Bilingual) 표준 서식을 유지합니다:

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

## 🏢 About the Company (회사 소개)
Build+ is an innovative startup...

---

## 📝 JD (직무 기술서 / Job Description)
As a Senior Data Engineer, you will...
```
