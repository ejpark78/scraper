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
- [x] 레거시 중복 Makefile 파일 및 폴더 영구 삭제 완료 (`scripts/sites/` 디렉토리 삭제)

## 🟨 미진행/보류 작업 (Pending Tasks)
- 없음
