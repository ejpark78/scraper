# Plan: Crawler Scripts 마이그레이션 (NPM Scripts 이관)

이 계획서는 `scripts/sites/*.mk`에 정의된 개별 사이트 크롤링 구동 스크립트를 `apps/crawler/package.json`의 npm 스크립트로 이관하고, 루트 `Makefile`을 연동하여 아키텍처 결합도를 낮추기 위한 실행 계획입니다.

## User Review Required
> [!IMPORTANT]
> - 기존 `scripts/sites/` 하위의 모든 `.mk` 파일이 영구 삭제됩니다.
> - 기존 `make yz-list` 등의 명령어 사용법은 루트 `Makefile` 래퍼 연동을 통해 그대로 유지하므로, 사용자/크론 배치 단에서의 파괴적 변경은 없습니다.

## Proposed Changes

### 1. Crawler Configuration (NPM 스크립트화)
- **`[MODIFY]`** `apps/crawler/package.json`: 
  - 각 크롤러 사이트별 scrape 명령, `gmail:sync`, 그리고 `queue:clear`, `queue:status`, `queue:dump`, `queue:fix-urls`, `log:grep-errors` 등 큐/에러 처리 스크립트 추가

### 2. Root Makefile Wrapper & Cleanups
- **`[MODIFY]`** `Makefile`:
  - `gpt-%`, `gn-%` 등 및 `gm-%`, 그리고 `clear-queue`, `grep-errors`, `dump-queue`, `fix-urls`, `get-queue-status` 타겟들을 신규 npm script 기동 방식으로 타겟 래핑
  - `rebuild`, `restart` 시스템 제어 타겟 루트 메이크파일로 통합 후, `apps/crawler/Makefile`로 최종 위임
- **`[NEW]`** `apps/crawler/Makefile`:
  - 큐/에러 처리 및 빌드/재기동 단축 타겟들을 전담 관리하는 전용 메이크파일 신규 작성
- **`[DELETE]`** `scripts/utils/worker.mk`
- **`[DELETE]`** `scripts/tools/gmail.mk`
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
