# 🔍 Code Review: Fix Relative Import Paths in Crawler Scripts

## 1. 개요
- **목적**: 빌드된 도커 이미지 내부 컴파일 타겟(`/app`) 기준에서 `apps/crawler/src/scripts/` 하위 스크립트들이 `SiteRegistry.ts` 등을 잘못된 상대 경로(`../crawler/core/...`)로 참조하여 `MODULE_NOT_FOUND` 예외를 내는 버그 조치
- **유형**: Bugfix (버그 수정)

## 2. 변경 내용 및 자가 진입점 평가
- `apps/crawler/src/scripts/` 디렉터리에 위치한 6개 스크립트 파일들의 잘못된 상대 참조 경로를 올바른 상대 경로인 `../core/` 및 `../utils/` 로 일괄 수정했습니다.
  - [meili-manager.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/scripts/meili-manager.ts#L15)
  - [clean_legacy_noise_ids.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/scripts/clean_legacy_noise_ids.ts#L13-L14)
  - [debug_html.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/scripts/debug_html.ts#L13-L14)
  - [diagnose-site.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/scripts/diagnose-site.ts#L12)
  - [extract_article.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/scripts/extract_article.ts#L9)
  - [migrate_uppity_ids.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/scripts/migrate_uppity_ids.ts#L13)

## 3. 평가
- **올바름(Correctness)**: 실제 상대 파일 물리 위치를 엄격히 추적하여 매핑을 정상화했으며, 컴파일 및 빌드가 완벽히 통과함을 보장합니다.
- **가독성(Readability)**: 정규화된 형태의 표준 TypeScript 상대 경로 표기법으로 가독성이 좋아졌습니다.
- **아키텍처(Architecture)**: 개발 환경과 실제 도커 런타임 환경 모두에서 일관성 있게 컴파일되도록 모듈 바운더리 경로 해석의 안전성을 확보했습니다.
