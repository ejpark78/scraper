# Plan: Crawler Scripts 마이그레이션 (NPM Scripts 이관)

이 계획서는 `scripts/sites/*.mk`에 정의된 개별 사이트 크롤링 구동 스크립트를 `apps/crawler/package.json`의 npm 스크립트로 이관하고, 루트 `Makefile`을 연동하여 아키텍처 결합도를 낮추기 위한 실행 계획입니다.

## User Review Required
> [!IMPORTANT]
> - 기존 `scripts/sites/` 하위의 모든 `.mk` 파일이 영구 삭제됩니다.
> - 기존 `make yz-list` 등의 명령어 사용법은 루트 `Makefile` 래퍼 연동을 통해 그대로 유지하므로, 사용자/크론 배치 단에서의 파괴적 변경은 없습니다.

## Proposed Changes

### 1. Crawler Configuration (NPM 스크립트화)
- **`[MODIFY]`** `apps/crawler/package.json`: 
  - 각 크롤러 사이트(`gpters`, `geeknews`, `dailydoseofds`, `pytorch_kr`, `aicasebook`, `uppity`, `maily_josh`, `yozm`, `linkedin`) 별로 `scrape:list`, `scrape:refresh-urls`, `scrape:refresh-silver` 등을 정의하여 추가

### 2. Root Makefile Wrapper & Cleanups
- **`[MODIFY]`** `Makefile`:
  - `gpt-%`, `gn-%` 등으로 각각 분산 로딩되던 포함 파일들을 정리하고, 신규 npm script 기동 방식으로 타겟 래핑
- **`[DELETE]`** `scripts/sites/gpters.mk`
- **`[DELETE]`** `scripts/sites/geeknews.mk`
- **`[DELETE]`** `scripts/sites/dailydoseofds.mk`
- **`[DELETE]`** `scripts/sites/pytorch_kr.mk`
- **`[DELETE]`** `scripts/sites/aicasebook.mk`
- **`[DELETE]`** `scripts/sites/uppity.mk`
- **`[DELETE]`** `scripts/sites/maily_josh.mk`
- **`[DELETE]`** `scripts/sites/yozm.mk`
- **`[DELETE]`** `scripts/sites/linkedin.mk`

---

## Verification Plan

### Manual Verification (Docker-Centric)
1. **특정 사이트 수집 테스트:**
   ```bash
   make yz-list PAGE=2
   ```
   *(내부적으로 `docker compose run --rm worker npm run scrape:yozm:list -- --page 2` 형태로 원활히 매핑되어 작동하는지 로그 확인)*
2. **Redis 큐 복구 테스트:**
   ```bash
   make yz-refresh-urls
   ```
3. **실버 레이어 재가공 테스트:**
   ```bash
   make yz-refresh-silver
   ```
