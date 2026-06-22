# Changelog - Crawler Service (`apps/crawler`)

All notable changes to the crawler service will be documented in this file.

---

## [1.8.0] - 2026-06-23

### Fixed (Bugfixes)
- **Bugfix: Scraper Worker Deadlock**:
  - Redis 커넥션을 이원화하여 blocking 명령어(`blpop`)용 커넥션과 일반 명령어(`get`, `set`, `rpush`, `lpush` 등)용 커넥션 간의 소켓 경합 및 데드락 제거.
  - `ScraperWorker.ts` 내 `this.dispatcher.scrape` 호출 시 120초 글로벌 실행 타임아웃(`withTimeout`) 래퍼를 도입하여, Playwright 브라우저 대기 및 네트워크 지연 시 영구 블로킹(hanging) 상태에 빠지지 않도록 버그 수정.

## [1.7.0] - 2026-06-23

### Changed
- **AGENTS.md 격리 적용**: 루트 규칙에서 크롤러 전용 제약조건(Playwright 버전 대응, 재귀 수집 제약, 수집 관련 Skill Map 등)을 분리하여 `apps/crawler/AGENTS.md`에 단독 이식 완료.

## [1.3.0] - 2026-06-20

### Added
- **Local Markdown File Scanner**: `data/ebook/output/` 디렉터리에 추출된 도서별 챕터 마크다운 파일들을 분석하여 자동으로 도서 데이터로 조립하는 로더 모듈 구현.

## [1.2.0] - 2026-06-20

### Changed
- **Crawler Scripts Migration (NPM Scripts)**: `scripts/sites/` 하위의 사이트별 Makefile 9개와 `worker.mk`, `gmail.mk`, `tests.mk` 등을 모두 제거하고, 27개의 크롤링 커맨드 및 Gmail/Queue 관련 스크립트, 테스트 관련 스크립트를 `apps/crawler/package.json`의 npm 스크립트로 통합 완료.
- **Makefile Restructuring**: 루트 `Makefile`의 스파게티성 `run-scrape` 로직 및 `PAGE`, `LIST_SLACK` 기본값 정의, 그리고 테스트/디버깅 타겟들을 `apps/crawler/Makefile` 내부로 완벽히 이전 및 이격.

## [1.1.0] - 2026-06-19

### Added
- **Ebook Sync Pipeline**: TypeScript CLI 동기화 스크립트(`sync-ebooks.ts`)를 작성하여 MongoDB(`silver.contents`) 및 Meilisearch(`contents`) 데이터 탑재 자동화.

### Fixed (Bugfixes)
- **Bugfix: TypeScript Compilation and Module Resolution Errors**: `ScraperWorker.ts`, `ConverterWorker.ts`, `IndexerWorker.ts`, `TargetLoader.ts` 내 모듈 참조 경로 버그를 물리 경로(`../../../../packages/database/...`)로 수정.
- **Bugfix: Scripts Entrypoints in Makefiles**: 레거시 메이크파일 내 스크립트 진입점 경로를 `apps/crawler/src/scripts`로 갱신 정렬.

## [1.0.0] - 2026-06-19

### Added
- **Retroactive Noise Cleansing Script**: 수집된 MongoDB 데이터 중 오류가 포함된 legacy ID를 제거하고 재수집을 등록하는 `clean_legacy_noise_ids.ts` 추가.

### Changed
- **Redis Namespace Refactoring**: Sc scraper queues(`sites:${siteKey}:scrape:${priority}`) 및 완료 캐시(`sites:${siteKey}:completed`)와 같은 사이트 중심 네임스페이스 구조 도입.
- **Legacy Fallback Handling**: `BaseListService` 및 `BaseRefreshUrls` 내 legacy 캐시 접두사 매핑 및 업데이트 지원.

### Fixed
- **Cross-Site Cache Collision Bug**: 사이트 간 동일 Redis 완료 캐시 키 사용으로 인해 스케줄링 큐 유입 과정에서 캐시 스킵 현상이 발생하던 구조적 충돌 버그 해결.
