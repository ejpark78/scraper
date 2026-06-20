# 📋 Plan: Fix Relative Import Paths in Crawler Scripts

이 계획은 `make ms-reindex` 실행 시 TypeScript 컴파일 과정에서 `meili-manager.ts` 등의 스크립트 파일이 `SiteRegistry` 모듈을 찾지 못하던 현상(Bugfix)을 수정하기 위한 계획입니다.

## 1. 문제 분석
- `apps/crawler/src/scripts/meili-manager.ts` 등 여러 스크립트 파일에서 `SiteRegistry`를 가져올 때 `../crawler/core/SiteRegistry` 로 참조하고 있습니다.
- 그러나 실제 `SiteRegistry.ts`의 위치는 `apps/crawler/src/core/SiteRegistry.ts` 입니다.
- 스크립트 파일들의 위치가 `apps/crawler/src/scripts/` 이므로, 올바른 상대 경로는 `../core/SiteRegistry`가 되어야 합니다.
- 호스트 환경에서는 모노레포 컴파일러 설정 등으로 인해 해당 오류가 감춰져 있었을 수 있으나, 빌드된 컨테이너 내부 런타임 환경에서는 잘못된 상대 경로로 인해 `MODULE_NOT_FOUND` 예외를 야기합니다.

## 2. 해결 방안
- `apps/crawler/src/scripts/` 하위에 위치한 스크립트들 중 `../crawler/core/SiteRegistry`로 상대 경로를 참조하는 소스 코드들을 `../core/SiteRegistry`로 정밀 변경합니다.

## 3. 작업 계획

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/crawler/src/scripts/meili-manager.ts` | Modify | 임포트 경로 `../crawler/core/SiteRegistry` ➡️ `../core/SiteRegistry` 로 변경 |
| `apps/crawler/src/scripts/clean_legacy_noise_ids.ts` | Modify | 임포트 경로 `../crawler/core/SiteRegistry` ➡️ `../core/SiteRegistry` 로 변경 |
| `apps/crawler/src/scripts/debug_html.ts` | Modify | 임포트 경로 `../crawler/core/SiteRegistry` ➡️ `../core/SiteRegistry` 로 변경 |
| `apps/crawler/src/scripts/diagnose-site.ts` | Modify | 임포트 경로 `../crawler/core/SiteRegistry` ➡️ `../core/SiteRegistry` 로 변경 |
| `apps/crawler/src/scripts/extract_article.ts` | Modify | 임포트 경로 `../crawler/core/SiteRegistry` ➡️ `../core/SiteRegistry` 로 변경 |
| `apps/crawler/src/scripts/migrate_uppity_ids.ts` | Modify | 임포트 경로 `../crawler/core/SiteRegistry` ➡️ `../core/SiteRegistry` 로 변경 |
