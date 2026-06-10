# 🏗️ SiteClipper: 새 사이트 구축 규칙 (Meta Prompt)

이 문서는 `linkedin` 프로젝트에 새 사이트(컨텐츠 소스)를 추가하기 위한 메타프롬프트입니다.
Agent가 새 사이트를 구축할 때 반드시 따라야 할 규칙, 패턴, 그리고 검증 절차를 정의합니다.

---

## 1. 전체 아키텍처 개요

모든 사이트는 동일한 3단계 Bronze → Silver 파이프라인을 따릅니다.

3단계 Bronze → Silver 파이프라인: ① List.ts가 URL 수집 → Redis Queue, ② ScraperWorker가 HTTP fetch → MongoDB bronze 저장, ③ TransformerWorker가 HTML→Markdown 변환 → MongoDB silver 저장.

보조 명령어 (공통 CLI: `src/crawler/core/cli-refresh-*.ts <siteKey>`):
- `cli-refresh-urls.ts`: 실패/미완료 URL 재큐잉 + 기존 HTML에서 신규 URL 스캔. `SiteDescriptor`에서 site/displayName/cacheSetKey 동적 로딩.
- `cli-refresh-transform.ts`: Bronze 문서 전체를 transform_queue에 재밀어넣기. `SiteDescriptor`에서 bronzeCollection 동적 로딩.
- `cli-refresh-silver.ts`: Bronze→Silver 전수 재변환 + 로컬 저장. `SiteDescriptor`에서 converter/silverCollection 동적 로딩. 커스텀 `getSilverFields`/`imageDownload`/`saveJson`/`extractId`는 `site.config.ts`의 `refreshSilver` 섹션으로 설정.

Redis Queue 명명 규칙: `scrape_queue:{site}:{priority}` (priority: high / medium / low)
BLPOP는 high → medium → low 순으로 소비하며, 동일 우선순위 내에서는 매 루프 셔플.

---

## 2. 생성해야 할 파일 목록

새 사이트 `{site}`를 추가하려면 아래 파일들을 생성해야 한다.

### 2.1 소스 코드 (필수)

| # | 파일 경로 | 역할 |
|---|-----------|------|
| 1 | `src/crawler/sites/{site}/site.config.ts` | SiteDescriptor 등록 (자동 발견됨) |
| 2 | `src/crawler/sites/{site}/Converter.ts` | HTML→Markdown 변환 (IConverter 구현) |
| 3 | `src/crawler/sites/{site}/List.ts` | 목록 페이지 URL 수집 (BaseListService 확장) |

### 2.2 설정 파일 (필수)

| # | 파일 경로 | 역할 |
|---|-----------|------|
| 3 | `scripts/sites/{site}.mk` | Makefile 모듈 (yz-list, yz-refresh-urls, yz-refresh-silver, yz-refresh-silver-rebuild) |

### 2.3 기존 파일 수정 (필수)

| # | 파일 | 수정 내용 |
|---|------|-----------|
| 4 | `Makefile` | `{prefix}-%` 패턴 라우팅 추가, `list:` aggregate에 추가 |
| 5 | `src/viewer/server.ts` | `silver/{site}.contents` → `bronze/{site}.html` rawHtml 스티칭 |

### 2.4 테스트 (권장)

| # | 파일 경로 | 역할 |
|---|-----------|------|
| 6 | `tests/sites/{site}/Converter.test.ts` | 컨버터 유닛 테스트 |
| 7 | `tests/sites/{site}/fixtures/list.html` | 목록 페이지 HTML fixture |
| 8 | `tests/sites/{site}/fixtures/article.html` | 아티클 페이지 HTML fixture |

### 2.5 문서 (선택)

| # | 파일 경로 | 역할 |
|---|-----------|------|
| 9 | `src/crawler/sites/{site}/README.md` | 사이트별 문서 |

---

## 3. 각 파일의 상세 규칙

### 3.1 `site.config.ts` — SiteDescriptor

`key`, `name`, `domain` 필수.

구현 참고: [`src/crawler/sites/yozm/site.config.ts`](src/crawler/sites/yozm/site.config.ts)

#### extractId 패턴 결정 규칙

- **URL에 고유 숫자 ID가 있는 경우** (예: `/detail/3791/`, `/topic/123`): 정규식으로 ID 추출
  - `url.match(/\/detail\/(\d+)\//)` → `match[1]`
  - `url.match(/\/topic\?id=(\d+)/)` → `match[1]`
- **URL에 의미있는 ID가 없는 경우** (예: `maily.so/josh/posts/abc123`): `crypto.createHash('md5').update(url).digest('hex')` 사용

#### filter 패턴

- 기본: `(id) => ({ id })`
- Discourse 기반 사이트(pytorch_kr 등): `(id) => ({ $or: [{ topicId: id }, { id: id }] })`
- Bronze 문서의 ID 필드명이 다른 경우: 해당 필드명으로 매칭

### 3.2 `Converter.ts` — IConverter 구현

구현 참고: [`src/crawler/sites/yozm/Converter.ts`](src/crawler/sites/yozm/Converter.ts)

#### Converter 제작 원칙

1. **cheerio로 HTML 구조 분석 먼저**: firecrawl로 rawHtml 수집 → cheerio로 DOM 분석 → 셀렉터 확정
2. **JSON-LD 우선**: `<script type="application/ld+json">`에서 `NewsArticle` 또는 `Article` 스키마를 파싱하면 가장 정확한 메타데이터 획득 가능
3. **본문 컨테이너 탐색 우선순위**:
   - `id` 기반: `#article-content`, `#article-detail-wrapper`, `#post-body`
   - `data-testid` 속성 기반 (Next.js 사이트)
   - 클래스 기반: `.post-content`, `.article-body`, `.entry-content`
   - 태그 기반: `article[itemprop="text"]`, `article[class*="content"]`
4. **날짜 파싱 우선순위**:
   - JSON-LD `datePublished` (ISO 8601 형식)
   - `<meta property="article:published_time">`
   - `<time datetime="...">` 속성
   - 페이지 텍스트 `YYYY.MM.DD`, `YYYY-MM-DD` 패턴
5. **타이틀 정리**: `og:title`에서 `| 사이트명` suffix 제거
6. **TurndownService 설정**: 제목은 `atx` 스타일(`#`), 불필요 태그 제거

### 3.3 `List.ts` — BaseListService 확장

구현 참고:
- 페이지네이션 패턴: [`src/crawler/sites/maily_josh/List.ts`](src/crawler/sites/maily_josh/List.ts)
- 사이트맵 패턴: [`src/crawler/sites/yozm/List.ts`](src/crawler/sites/yozm/List.ts)

#### List 패턴 분류

| 패턴 | 설명 | 예시 사이트 |
|------|------|------------|
| **페이지네이션** | `?page=N` 또는 `?page={N}` 쿼리로 페이지 이동 | maily_josh (`?page=N`) |
| **사이트맵 (Sitemap)** | 사이트맵 XML에서 전체 URL 목록 획득, CSR 목록 페이지 우회 | yozm (`/sitemap-news.xml`) |
| **RSS/JSON Feed** | RSS 피드에서 URL 목록 획득 | geeknews |
| **Playwright** | Headless 브라우저로 CSR 페이지 렌더링 후 URL 추출 | aicasebook (`chromium.launch`) |
| **Playwright (Custom)** | 자체 로그인/세션/페이지네이션 관리, 표준 Clipper 파이프라인 미사용 | linkedin (`Crawler.ts`) |
| **무한 스크롤** | API 엔드포인트 호출 (page/cursor) | — |
| **고정 목록** | 단일 페이지에서 모든 링크 추출 | uppity |

#### Playwright 패턴 상세 (CSR + 로그인 필요 페이지)

List.ts에서 직접 Playwright를 사용하여 CSR 페이지를 렌더링한 후 URL을 추출한다.  
`firecrawl` CLI로도 CSR 페이지는 스크랩 가능하지만, List.ts에서 직접 Playwright를 사용하면:
- 로그인/쿠키 세션 관리 가능
- 페이지별 동적 콘텐츠 대응
- 병렬 페이지 처리

구현 참고: [`src/crawler/sites/aicasebook/List.ts`](src/crawler/sites/aicasebook/List.ts)

주의사항:
- `chromium.launch({ headless: true })`로 브라우저 실행
- 매 실행마다 브라우저를 띄우므로 `SLACK_TIME`보다 실행 간격이 길어짐
- Docker 환경에서 Playwright 실행 시 `playwright-deps` 이미지 또는 시스템 의존성 설치 필요
- 단순 CSR 우회만 필요하면 `firecrawl scrape`로 대체 가능 (List 대신 사이트맵 패턴 우선 고려)

#### 사이트맵 패턴 상세 (CSR 목록 페이지 우회)

Next.js CSR(Client-Side Rendering) 목록 페이지는 `fetch`로 빈 HTML만 내려오므로 일반 페이지네이션 패턴으로 URL을 추출할 수 없다.
이 경우 `sitemap.xml`에서 전체 아티클 URL을 한 번에 획득하는 패턴을 사용한다.

구현 참고: [`src/crawler/sites/yozm/List.ts`](src/crawler/sites/yozm/List.ts) (요즘IT 사례)

사이트맵 패턴 적용 순서:
1. `https://{domain}/sitemap.xml` 요청 → 하위 사이트맵 목록 확인
2. 뉴스/아티클 전용 사이트맵 (예: `sitemap-news.xml`, `sitemap-posts.xml`) 식별
3. 해당 사이트맵의 `<loc>` 패턴 분석 → URL + ID 정규식 작성
4. `processItem(id, url, title)` 호출 (타이틀은 sitemap에 없으므로 placeholder 사용, Transformer에서 본문에서 추출됨)

#### ID 추출 규칙

- List.ts의 `extractId`는 반드시 `site.config.ts`의 `extractId`와 **동일한 로직**을 사용해야 함
- URL → ID 변환 후 `processItem(id, url, title)` 호출
- ID가 빈 문자열이면 `processItem` 호출 생략

### 3.4 `cli-refresh-urls.ts` — 통합 URL 재큐잉 CLI

공통 CLI: [`src/crawler/core/cli-refresh-urls.ts`](src/crawler/core/cli-refresh-urls.ts)

`SiteDescriptor`에서 `key`(site), `name`(displayName), `transformer.completedSetKey`(cacheSetKey)를 동적 로딩.
별도의 per-site `RefreshUrls.ts` 파일이 필요 없음.

사용법: `npx ts-node src/crawler/core/cli-refresh-urls.ts <siteKey>`

내부 동작:
1. `getSite(siteKey)`로 SiteDescriptor 로딩
2. `BaseRefreshUrls` 인스턴스 생성 (`site`, `displayName`, `cacheSetKey` 자동 추출)
3. `legacyQueue`는 `siteKey === 'gpters'`인 경우만 `true` (레거시 monolithic 큐 사용)

### 3.5 `cli-refresh-transform.ts` — 통합 Transform 큐잉 CLI

공통 CLI: [`src/crawler/core/cli-refresh-transform.ts`](src/crawler/core/cli-refresh-transform.ts)

`SiteDescriptor`에서 `key`(site), `scraper.collectionName`(bronzeCollection)을 동적 로딩.

사용법: `npx ts-node src/crawler/core/cli-refresh-transform.ts <siteKey>`

내부 동작:
1. `getSite(siteKey)`로 SiteDescriptor 로딩
2. `BaseRefreshTransform` 인스턴스 생성
3. `siteKey === 'gpters'`인 경우 `idExtract` + `includeUrlInPayload` 커스텀 설정

### 3.6 `cli-refresh-silver.ts` — BaseRefreshSilver (전수 재변환 + 로컬 저장)

공통 CLI: [`src/crawler/core/cli-refresh-silver.ts`](src/crawler/core/cli-refresh-silver.ts)

`SiteDescriptor`에서 `transformer.converter`, `scraper.collectionName`, `targetLoader.collectionName`을 동적 로딩.
커스텀 설정이 필요한 경우 `site.config.ts`의 `refreshSilver` 섹션에 정의:

```typescript
// site.config.ts 예시
export const descriptor: SiteDescriptor = {
  key: 'geeknews',
  // ... scraper, transformer, targetLoader ...
  refreshSilver: {
    saveJson?: boolean;                    // JSON 파일 저장 (GPters 등)
    extractId?: (doc) => string;           // 커스텀 ID 추출
    getSilverFields?: (meta) => Record;    // silver 문서 필드 커스터마이징
    imageDownload?: {
      enabled: boolean;                    // 이미지 다운로드 사용
      htmlSource?: 'rawContent' | 'shortContent';  // HTML 소스 (GPters: shortContent)
      removeFavicons?: boolean;            // favicon 제거 (PyTorchKR)
    };
  },
};
```

`cli-refresh-silver.ts`는 `refreshSilver.imageDownload.enabled`가 `true`면 자동으로 `afterConvert` 훅을 생성하여
`downloadImages()` 유틸(`src/crawler/utils/imageDownloader.ts`)로 이미지를 다운로드한다.

사용법: `npx ts-node src/crawler/core/cli-refresh-silver.ts <siteKey>`

#### BaseRefreshSilverConfig 옵션

| 옵션 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `site` | `string` | 필수 | 사이트 키 |
| `bronzeCollection` | `` bronze/${string} `` | 필수 | Bronze 컬렉션명 |
| `silverCollection` | `` silver/${string} `` | 필수 | Silver 컬렉션명 |
| `dataDir` | `string` | 필수 | 로컬 저장 디렉토리명 |
| `converter` | `IConverter` | 필수 | Html→Markdown 변환기 |
| `extractId` | `(doc) => string` | `doc.topicId \|\| doc.id` | Bronze 문서에서 ID 추출 |
| `extractRawContent` | `(doc) => string` | `doc.rawHtml \|\| doc.rawJson` | Bronze 문서에서 raw content 추출 |
| `saveJson` | `boolean` | `false` | JSON 파일도 함께 저장 (GPters 등 JSON 기반 사이트) |
| `getSilverFields` | `(meta) => Record` | id, title, url, publishedAt, content, markdown, updatedAt | Silver 문서 필드 커스터마이징 |
| `afterConvert` | `(meta, rawContent, doc) => Promise<meta>` | 없음 | 변환 후 이미지 다운로드 등 후처리 훅 |

#### 동작 순서
1. MongoDB `bronzeCollection` 전체 문서 조회
2. 각 문서를 `converter.convertHtmlToMarkdown()`으로 변환
3. `afterConvert` 훅 실행 (이미지 다운로드 등)
4. `silverCollection`에 upsert
5. `data/sites/{dataDir}/{year}/{month}/html/{id}.html` + `markdown/{id}.md` 저장
6. `saveJson: true`면 `json/{id}.json`도 저장
7. MongoDB 연결 종료 (`finally` 블록에서 `mongo.close()` 보장)

#### imageDownload config 패턴 (자동 afterConvert)

`site.config.ts`에서 `refreshSilver.imageDownload`를 설정하면 `cli-refresh-silver.ts`가 자동으로 `afterConvert` 훅을 생성한다:

- `enabled: true` → 이미지 다운로드 활성화
- `htmlSource: 'shortContent'` → GPters처럼 HTML 본문이 `meta.shortContent`에 있는 경우
- `htmlSource` 미설정 (기본) → `rawContent` (bronze raw HTML) 사용, 대부분의 사이트에 해당
- `removeFavicons: true` → 마크다운에서 favicon 이미지 제거 (PyTorchKR)

내부적으로 `src/crawler/utils/imageDownloader.ts`의 `downloadImages()`를 사용하며,
`data/sites/{siteDir}/images/{docId}/`에 저장하고 markdown URL을 로컬 경로로 치환한다.

#### getSilverFields config 패턴 (사용자 정의)

`site.config.ts`의 `refreshSilver.getSilverFields`에서 silver 문서에 저장할 필드를 정의한다:
- GPters: `author`, `shortContent`, `reactionsCount`, `repliesCount` 등 extra 메타데이터 포함
- GeekNews: `comments`, `jsonLdRaw` 포함
- 표준 사이트는 설정 불필요 (기본값: id, title, url, publishedAt, content, markdown, updatedAt)

---

## 4. Makefile 및 설정

### 4.1 `scripts/sites/{site}.mk`

구현 참고: [`scripts/sites/yozm.mk`](scripts/sites/yozm.mk)

Makefile 타겟 구성:
| 타겟 | 설명 |
|------|------|
| `list` | List.ts 실행 (URL 수집) |
| `refresh-urls` | `cli-refresh-urls.ts <siteKey>` 실행 (Docker, Redis 큐 복구) |
| `refresh-silver` | `cli-refresh-transform.ts <siteKey>` 실행 (Docker, bronze→silver 큐 재처리) |
| `refresh-silver-rebuild` | `cli-refresh-silver.ts <siteKey>` 실행 (Host, bronze→silver 전수 재변환 + 로컬 파일 저장) |

`refresh-silver` (cli-refresh-transform) vs `refresh-silver-rebuild` (cli-refresh-silver):
- `refresh-silver`: Docker 컨테이너 내부에서 실행, TransformerWorker가 Redis 큐를 소비하며 bronze→silver 변환
- `refresh-silver-rebuild`: Host에서 직접 ts-node 실행, MongoDB bronze→silver 전수 재변환 + 로컬 html/md/json 저장. `site.config.ts`의 `imageDownload` 설정이 있으면 이미지 다운로드까지 수행

표준 사이트 Makefile 예시: [`scripts/sites/yozm.mk`](scripts/sites/yozm.mk)

#### `{prefix}` 결정 규칙
- 사이트 키의 첫 두 글자를 prefix로 사용 (예: `maily_josh` → `mj`, `yozm` → `yz`)
- 단, 다른 사이트와 prefix가 겹치면 3글자 사용 (예: `geeknews` → `gn`, `pytorch_kr` → `pk`)
- Makefile에 등록된 prefix 목록 확인: `li`, `gpt`, `gn`, `ddds`, `pk`, `ab`, `up`, `mj`, `yz`

### 4.2 `Makefile` 수정

Makefile의 `list:` aggregate와 `{prefix}-%` 패턴 라우팅을 추가한다.

참고: [`Makefile`](Makefile) (25번째 줄 근처 `list:` 타겟, `mj-%` ~ `mongo-%` 사이 패턴 라우팅)

### 4.3 `src/viewer/server.ts` 수정

`server.ts`의 `GET /api/documents/:id` 핸들러 내, `rawHtml` 스티칭 블록에 사이트 추가.

참고: [`src/viewer/server.ts`](src/viewer/server.ts) (385~390번째 줄 근처 `else if` 브랜치)

---

## 5. 테스트 작성 규칙

### 5.1 fixture 수집

firecrawl로 raw HTML 수집 (사전 분석 후). `tests/sites/{site}/fixtures/`에 저장.

### 5.2 테스트 구조

구현 참고: [`tests/sites/yozm/Converter.test.ts`](tests/sites/yozm/Converter.test.ts)

#### 테스트 검증 항목

1. **목록 파싱**:
   - `articleLinks.length > 0`
   - URL이 예상 패턴과 일치
   - 각 링크에 타이틀 존재
   - 예상 개수와 일치 (예: 10개/페이지)

2. **HTML 변환**:
   - `result.id === TEST_ID`
   - `result.title`에 예상 제목 포함
   - `result.url` 일치
   - `result.publishedAt`가 null이 아니고 예상 형식과 일치
   - `result.category`가 null이 아님
   - `result.content.length > 0`, 본문 텍스트 포함
   - `result.rawContent`에 `# `, `카테고리:`, `발행일:`, `원본 링크:` 포함

### 5.3 테스트 실행

`npx ts-node tests/sites/{site}/Converter.test.ts` 또는 `make test-{site}`

---

## 6. 사이트 분석 방법론

새 사이트를 구축할 때는 다음 순서로 분석하라:

### 6.1 목록 페이지 분석

> **🚨 우선 확인:** 사이트맵(Sitemap)이 존재하는지 먼저 확인하라.
> CSR 목록 페이지를 우회하여 아티클 URL 목록을 한 번에 얻을 수 있다.
> `curl -s "https://{domain}/sitemap.xml" | head -50` 로 확인.

1. `firecrawl scrape`로 목록 페이지 스크랩 (markdown + rawHtml)
2. 페이지 URL 패턴 확인: 정적(`?page=N`) / CSR(빈 HTML) / JS API
3. cheerio로 HTML 분석하여 아티클 URL + 타이틀 셀렉터 식별
4. CSR일 경우 → 사이트맵 패턴 사용 (3.3절 참고)

### 6.2 아티클 페이지 분석

1. `firecrawl scrape`로 아티클 스크랩 (markdown + rawHtml)
2. 메타데이터 확인: `application/ld+json`, `og:title`, `canonical`, `datePublished`
3. 본문 컨테이너 ID/클래스 식별: `#article-content`, `#article-detail-wrapper` 등

### 6.3 데이터 검증

추출한 본문 컨텐츠가 예상 텍스트를 포함하는지 확인.

### 6.4 Next.js 사이트 특별 처리

#### 아티클 페이지 (SSR)
Next.js로 빌드된 사이트의 아티클 상세 페이지는 SSR(서버사이드 렌더링)으로 제공되는 경우가 많다.
raw HTML에 `__NEXT_DATA__` 스크립트나 JSON-LD에 전체 데이터가 포함되어 있다:

- `<script id="__NEXT_DATA__" type="application/json">`: 전체 페이지 데이터 (권장)
- `<script type="application/ld+json">`: 구조화된 메타데이터
- 대부분의 메타데이터(제목, 날짜, 작성자)는 `meta` 태그에도 중복되어 있으므로 meta 태그를 우선 사용

#### 아티클 페이지 (RSC SSR — 새 패턴)

Next.js App Router(RSC)로 빌드된 사이트는 SSR이지만 DOM에 실제 텍스트가 없고, **RSC(React Server Components) 포맷**으로 본문이 직렬화된다.

증상 및 진단:
- `#article-detail-wrapper` 등 본문 컨테이너는 DOM에 존재
- 하지만 `cheerio`로 `.text()` 추출 시 **빈 문자열** (`children`이 `$L37`, `$L39` 같은 RSC 참조)
- HTML에는 `self.__next_f.push(...)` RSC payload가 다수 존재
- JSON-LD `<script type="application/ld+json">` 중 `@type: "NewsArticle"`에 `articleBody` 필드로 전체 본문 포함

진단 방법:
```bash
# 1. DOM 본문 컨테이너 존재 확인
curl -s "https://example.com/detail/123/" | python3 -c "
import sys
html = sys.stdin.read()
# 컨테이너 존재 확인
print('Wrapper 존재:', 'article-detail-wrapper' in html)
# 텍스트 길이 확인 (cheerio로 추출 시 빈 문자열인지)
"

# 2. RSC payload 존재 확인
curl -s "https://example.com/detail/123/" | python3 -c "
import sys, re
html = sys.stdin.read()
rsc = re.findall(r'self\.__next_f\.push', html)
print(f'RSC payload 개수: {len(rsc)}')
# NewsArticle JSON-LD 확인
news = re.findall(r'NewsArticle', html)
print(f'NewsArticle JSON-LD: {len(news)}')
articleBody = re.findall(r'articleBody', html)
print(f'articleBody 필드: {len(articleBody)}')
"

# 3. JSON-LD articleBody 추출
curl -s "https://example.com/detail/123/" | python3 -c "
import sys, json, re
html = sys.stdin.read()
for m in re.finditer(r'<script type=\"application/ld\+json\">(.*?)</script>', html, re.DOTALL):
    try:
        data = json.loads(m.group(1))
        if data.get('@type') == 'NewsArticle' and data.get('articleBody'):
            body = data['articleBody']
            print(f'articleBody 길이: {len(body)}')
            print(body[:200])
    except: pass
"
```

해결: **Converter.ts에서 JSON-LD `articleBody` fallback** 구현
- DOM 텍스트가 50자 미만이면 RSC SSR로 간주
- `NewsArticle.articleBody`에서 본문 추출
- HTML entity(`&nbsp;`, `&lt;`, `&gt;`) 정리
- `<br>` → 개행 변환
- JSON-LD에서 `datePublished`, `articleSection`, `author`도 함께 추출
- 단, `author`는 JSON-LD가 범용명("요즘IT")인 경우 HTML DOM(`a[href*="/magazine/@"`)의 실제 작가명 우선

구현 참고: [`src/crawler/sites/yozm/Converter.ts`](src/crawler/sites/yozm/Converter.ts) — `findNewsLd()` 헬퍼, DOM text 길이 체크 후 fallback 로직

#### 목록 페이지 (CSR 문제)
Next.js 목록 페이지는 **CSR(Client-Side Rendering)** 으로 구현된 경우가 많다.
`fetch`로 가져온 HTML에는 아티클 링크가 없고 JavaScript 번들만 포함된다.

증상:
- `__NEXT_DATA__` 없음
- `/detail/`, `/post/` 등 아티클 링크 패턴이 HTML에 없음
- `<script>self.__next_f.push(...)` (RSC payload)만 존재하지만 cheerio로 파싱 불가
- `data-testid` 셀렉터로 찾은 요소가 HTML에 없음

해결: **사이트맵 패턴**으로 우회 (3.3절 참고)
1. `sitemap.xml` 에서 `<loc>` URL 직접 추출
2. `<loc>` 안에 있는 아티클 URL을 ID와 함께 큐잉
3. 아티클 상세 페이지는 SSR이므로 `scrapeHttpFetch`로 정상 수집됨

---

## 7. 규칙 및 제약사항

### 7.1 ID 중복 방지
- `BaseListService.seedCache()`가 MongoDB bronze 컬렉션에서 기존 ID를 Redis로 로딩
- `processItem()`이 Redis cache set과 중복 체크 후 큐잉
- `OVERWRITE=true` 지원 방식이 RefreshUrls와 List가 다름:
  - **RefreshUrls**: URL 상태를 `failed`/`new`로 리셋
  - **List.ts**: Redis cache set에서 `SREM` + MongoDB `pushedToRedis=false, status='new'` 리셋 (base 클래스에 구현되어 있으므로 List에서 추가 처리 불필요)

### 7.2 Rate Limiting
- `defaultSlack: 3` (3초)가 기본값
- 환경변수 `SLACK_TIME`으로 오버라이드 가능
- ScraperWorker가 초당 요청 제한 적용

### 7.3 에러 처리
- ScraperWorker: 3회 재시도 → `dead_letter_queue` 이동
- `make {prefix}-refresh-urls ERROR_RESET=true`: failed 상태만 재큐잉
- `make {prefix}-refresh-urls OVERWRITE=true`: 모든 URL 강제 재큐잉

### 7.4 TypeScript 타입 체크
- 모든 파일 생성 후 `npx tsc --noEmit` 실행하여 타입 오류 확인
- `site.config.ts`의 `IConverter<any>`는 런타임 타입 안전성을 보장하지 않으므로 Converter의 메타 인터페이스를 정확히 정의

### 7.5 viewer에 사이트 등록
- `server.ts`의 rawHtml 스티칭 블록은 하드코딩되어 있음
- 새 사이트를 추가할 때마다 반드시 `else if` 브랜치를 추가해야 viewer에서 HTML 탭이 동작함

### 7.6 연결 종료 (Connection Lifecycle)
- `List.ts`의 `close()`는 반드시 `await this.redis.quit()` + `await MongoDatabase.getInstance().close()`를 호출해야 함
- `redis.quit()`만 호출하면 MongoDB 연결이 남아 Node.js 프로세스가 hang됨 (Ctrl+C 필요)
- 모든 스크립트(List, cli-refresh-urls, cli-refresh-transform)의 finally 블록에서 `await this.close()` 호출 필수
- LinkedIn 모듈은 `process.exit(0)`를 safety net으로 사용

### 7.7 ScraperWorker 아키텍처

#### 큐 구조
```
scrape_queue:{site}:high     # 우선순위별 per-site 큐
scrape_queue:{site}:medium
scrape_queue:{site}:low
```
BLPOP는 high → medium → low 순으로 처리하며, 동일 우선순위 내에서는 매 루프마다 큐 순서를 **셔플**하여 특정 사이트 큐가 starve되는 것을 방지.

#### SITE_CONFIGS
ScraperWorker는 if-else 분기 없이 `SITE_CONFIGS` 객체로 사이트별 설정 관리:
- `collectionName`, `targetCollection`, `updateFilterKey`, `defaultSlack`, `extractId`
- 새 사이트 추가 시 `site.config.ts` 외에도 ScraperWorker의 `SITE_CONFIGS`에 등록 필요

#### SCALE 설정
`make restart SCALE=3`으로 scraper 인스턴스 N개 병렬 실행. 기본값은 3.
큐 뎁스와 rate limit에 따라 조정.

### 7.8 Make 변수 할당 주의사항
`.mk` 파일에서 target-specific 변수 override는 `:=`(immediate assignment)를 사용할 것:
```makefile
PRIORITY ?= medium       # global default
list: PRIORITY := high   # target-specific override (:= 필수!)
```
`?=`를 사용하면 global default가 이미 정의되어 있어 override가 **무시됨**.

---

## 8. 이미 구축된 사이트 참고

> **Linkedin 주의:** Linkedin은 표준 Clipper 파이프라인(List → ScraperWorker → TransformerWorker)을 따르지 않는 **유일한 사이트**.
> 자체 Crawler(`src/crawler/sites/linkedin/Crawler.ts`)가 Playwright로 로그인/세션/페이지네이션을 직접 관리하며,
> `src/crawler/sites/linkedin/jobs/` 디렉토리 아래에 별도 모듈들(`ListScraper.ts`, `ExtractUrls.ts`, `UrlManager.ts`, `RefreshTransform.ts`)로 구성됨.
> 새 사이트 구축 시 Linkedin을 템플릿으로 사용하지 말 것.

| 사이트 | key | prefix | Bronze | Silver | ID 방식 | List 패턴 |
| LinkedIn | linkedin | li | `bronze/linkedin.html` | `silver/linkedin.contents` | MD5 URL 해시 | Playwright (Custom) |
| 요즘IT | yozm | yz | `bronze/yozm.html` | `silver/yozm.contents` | 숫자 ID (`/detail/{id}/`) | 사이트맵 |
| 조쉬의 뉴스레터 | maily_josh | mj | `bronze/maily_josh.html` | `silver/maily_josh.contents` | MD5 URL 해시 | 페이지네이션 |
| GeekNews | geeknews | gn | `bronze/geeknews.html` | `silver/geeknews.contents` | 숫자 ID (`?id={id}`) | RSS |
| GPters | gpters | gpt | `bronze/gpters.html` | `silver/gpters.contents` | MD5 URL 해시 | 페이지네이션 |
| PyTorch KR | pytorch_kr | pk | `bronze/pytorch_kr.html` | `silver/pytorch_kr.contents` | 숫자 ID (`/{id}`) | 페이지네이션 |
| AI Casebook | aicasebook | ab | `bronze/aicasebook.html` | `silver/aicasebook.contents` | 숫자 ID (`/setup/{id}`) | Playwright |
| Daily Dose of DS | dailydose_ds | ddds | `bronze/dailydose_ds.html` | `silver/dailydose_ds.contents` | MD5 URL 해시 | 페이지네이션 |
| Uppity | uppity | up | `bronze/uppity.html` | `silver/uppity.contents` | MD5 URL 해시 | 고정 목록 |

---

## 9. 체크리스트 (생성 확인용)

Agent가 모든 파일을 생성한 후 반드시 확인할 것:

- [ ] `src/crawler/sites/{site}/` 디렉토리 존재
- [ ] `site.config.ts` - `extractId` 함수 정확성
- [ ] `Converter.ts` - 모든 메타데이터 필드 추출
- [ ] `List.ts` - 페이지네이션/URL 추출 정확성
- [ ] `site.config.ts`에 `transformer.completedSetKey`, `transformer.converter`, `scraper.collectionName`, `targetLoader.collectionName` 모두 정의 (CLI에서 동적 로딩)
- [ ] `scripts/sites/{site}.mk` - 타겟이 `cli-refresh-urls.ts`, `cli-refresh-transform.ts`, `cli-refresh-silver.ts`를 올바르게 참조
- [ ] `scripts/sites/{site}.mk` - prefix, 경로, 환경변수 일치
- [ ] `Makefile` - `{prefix}-%` 라우팅, `list:` aggregate
- [ ] `src/viewer/server.ts` - rawHtml 스티칭 브랜치
- [ ] `tests/sites/{site}/` - fixture + 테스트 코드
- [ ] `npx tsc --noEmit` 타입 에러 0건
- [ ] fixture HTML 파일이 비어있지 않음 (0바이트 체크)
- [ ] 모든 `{site}` placeholder가 실제 사이트 키로 치환됨
