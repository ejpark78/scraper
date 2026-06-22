# Plan - Remove RECURSIVE_SCRAPE=true Logic

## 🎯 Goal
`RECURSIVE_SCRAPE=true` 모드로 동작하던 웹 페이지 내 링크 분석 및 재귀 큐 추가(무한 증식) 로직을 제거하고, 기존의 `RECURSIVE_SCRAPE=false` 모드(1회성 리스트 및 대상 URL 수집)를 기본 동작으로 고정합니다.

---

## 🛠️ Detailed Tasks

### 1. `apps/crawler/Makefile` 수정
- 각 사이트 타겟 및 `list`, `refresh-urls`, `refresh-silver` 등에서 `RECURSIVE_SCRAPE=true` 설정 제거.
- `test-recursive` 타겟 제거.

### 2. `scripts/environments.mk` 수정
- `ENV_COMMON`에서 `-e RECURSIVE_SCRAPE=$(RECURSIVE_SCRAPE)` 옵션 제거.

### 3. `apps/crawler/src/config/AppConfig.ts` 수정
- `RECURSIVE_SCRAPE` 정적 상수 선언 제거.

### 4. `apps/crawler/src/core/BaseListService.ts` 수정
- `payload` 객체에서 `recursive: AppConfig.RECURSIVE_SCRAPE` 설정 제거.

### 5. `apps/crawler/src/core/BaseRefreshUrls.ts` 수정
- 이 파일은 **일체 수정하지 않고 그대로 유지**합니다. (의도된 정밀 복구 및 스캔 로직 보존)

### 6. `apps/crawler/src/workers/ScraperWorker.ts` 수정
- `discoverRecursiveUrls` 메소드 구현부 제거.
- `saveRawHtmlAndQueueConvertTask` 내부에서 `payload?.recursive === true` 분기 및 `discoverRecursiveUrls` 호출 제거.

### 7. 테스트 코드 정리
- `tests/recursive/RecursiveScrape.test.ts` 파일 삭제.

---

## 📅 Schedule & Verification

1. **코드 수정**: 위 명시된 순서대로 코드 수정 적용.
2. **빌드 확인**: `make -C apps/crawler build` 또는 관련 워커 재빌드 테스트.
3. **유효성 검증**: `make -C apps/crawler get-queue-status` 등으로 큐 상태 정상 확인 및 컴파일 빌드 통과 여부 검증.
4. **Git Commit**: `scripts/agents/commit-changes.sh` 실행.
