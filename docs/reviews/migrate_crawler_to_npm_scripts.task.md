# Task List: Crawler Scripts 마이그레이션 (NPM Scripts 이관)

`scripts/sites` 하부 Makefile들을 크롤러 내 package.json 스크립트로 이관하는 작업 진행 관리 태스크 목록입니다.

## 🟩 완료된 작업 (Completed Tasks)
- [x] 크롤러 모듈 npm script 마이그레이션 계획서 및 ADR 작성 완료
  - ADR: [0004-move-crawler-scripts-to-npm.md](file:///home/ejpark/workspace/scraper/docs/adr/0004-move-crawler-scripts-to-npm.md)
  - Plan: [migrate_crawler_to_npm_scripts.md](file:///home/ejpark/workspace/scraper/docs/plans/migrate_crawler_to_npm_scripts.md)
- [x] 크롤러 package.json 수정 ([package.json](file:///home/ejpark/workspace/scraper/apps/crawler/package.json))
  - 9개 크롤러 대상 사이트별로 `scrape:list`, `scrape:refresh-urls`, `scrape:refresh-silver` 전용 npm 스크립트 도합 27개 구현 추가 완료
- [x] 루트 `Makefile` 수정 완료 ([Makefile](file:///home/ejpark/workspace/scraper/Makefile))
  - 개별 사이트별 mk 임포트를 걷어내고, 동적 매핑 헬퍼 타겟 `run-scrape`를 활용하여 원스톱 기동 및 이전 CLI 인터페이스 100% 호환성 확보
  - `rebuild`, `restart`, `clear-queue`, `grep-errors`, `dump-queue`, `fix-urls`, `get-queue-status` 등의 타겟들을 `apps/crawler/Makefile`로 위임 래핑 완료
  - `gm-%` (Gmail sync) 타겟 역시 `apps/crawler/Makefile` 내부의 `gmail-$*` 타겟으로 위임 포워딩 연동 완료
- [x] `apps/crawler/Makefile` 생성 및 확장 완료 ([Makefile](file:///home/ejpark/workspace/scraper/apps/crawler/Makefile))
  - 큐/에러 처리, 빌드/재기동 단축 타겟, 그리고 `gmail-sync` 타겟까지 전담 관리하는 전용 메이크파일 신규 작성 및 확장 완료
- [x] 레거시 중복 Makefile 파일 및 폴더 영구 삭제 완료 (`scripts/sites/`, `scripts/utils/worker.mk`, `scripts/tools/gmail.mk` 및 `scripts/utils/tests.mk` 삭제)

- [x] 루트 `Makefile` 내 `run-scrape` 및 `PAGE`, `LIST_SLACK` 기본값 정의 삭제 완료
- [x] `apps/crawler/Makefile` 내부로 `run-scrape` 로직 및 `PAGE`, `LIST_SLACK` 변수 선언 이관 완료
- [x] 각 개별 사이트별 타겟(`gpt-%` 등)이 `apps/crawler/Makefile`의 `run-scrape`를 직접 호출하도록 포워딩 매핑 업데이트 완료
- [x] `tests.mk` 내의 테스트 및 디버깅 유틸 타겟들을 `apps/crawler/Makefile` 및 npm script로 이전 완료
- [x] `apps/viewer/Makefile` 생성 및 `up-viewer` 타겟 이관 완료
- [x] `apps/viewer/docker/compose.yml`을 `apps/viewer/compose.yml`로 이동 및 빌드 컨텍스트, Makefile 연동 업데이트 완료
- [x] `apps/viewer/Makefile` 내 `down` 타겟 추가 및 루트 `viewer-%` (viewer-up, viewer-down) 통합 매핑 완료






## 🟨 미진행/보류 작업 (Pending Tasks)
- 없음

