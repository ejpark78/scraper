# Walkthrough: Crawler Scripts 마이그레이션 (NPM Scripts 이관)

본 문서는 `scripts/sites`의 스크립트들을 `apps/crawler`의 package.json으로 일괄 이관한 작업 결과 보고서입니다.

## 🛠️ 작업 수행 요약 (Execution Summary)

- **결합도 해소:** 모노레포 아키텍처 규칙에 따라 크롤러 실행 커맨드를 크롤러 앱 내부 [package.json](file:///home/ejpark/workspace/scraper/apps/crawler/package.json)으로 응집하고, [apps/crawler/Makefile](file:///home/ejpark/workspace/scraper/apps/crawler/Makefile)을 신규 생성하여 로컬 인프라/태스크 제어 구조 격리.
- **인터페이스 보존:** 루트 [Makefile](file:///home/ejpark/workspace/scraper/Makefile)의 공통 래퍼 규칙을 다듬어, 이전과 동일한 명령(`make yz-list PAGE=2`, `make clear-queue` 등)으로 도커 내부의 npm 스크립트를 올바르게 전파하여 기동하게 지원.
- **레거시 정리:** 불필요해진 `scripts/sites/` 및 `scripts/utils/worker.mk`를 완전히 삭제하여 프로젝트 형상 구조 단순화.

## 📈 품질 검증 및 변경 로그 (Changelog)

- **스크립트 표준화:** 각 사이트별 수집/복구 커맨드를 ts-node와 표준 `--` 인자 꼬리 전파 방식으로 통합 완료.
- **CLI 호환성:** 외부 스케줄러(Cronicle 등)나 인간 개발자가 치던 make 타겟 구조 변경 없이 동작이 완벽 호환됨.
- **격리 검증:** `apps/crawler/` 단독 디렉토리 내에서도 독립 빌드 및 큐 관리가 유연하게 동작함.
