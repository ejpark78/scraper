# Walkthrough: Crawler Scripts 마이그레이션 (NPM Scripts 이관)

본 문서는 `scripts/sites`의 스크립트들을 `apps/crawler`의 package.json으로 일괄 이관한 작업 결과 보고서입니다.

## 🛠️ 작업 수행 요약 (Execution Summary)

- **결합도 해소:** 모노레포 아키텍처 규칙에 따라 크롤러 실행 커맨드를 크롤러 앱 내부 [package.json](file:///home/ejpark/workspace/scraper/apps/crawler/package.json)으로 응집하고, [apps/crawler/Makefile](file:///home/ejpark/workspace/scraper/apps/crawler/Makefile)을 신규 생성하여 로컬 인프라/태스크 및 **Gmail 연동 제어 구조 격리**.
- **인터페이스 보존:** 루트 [Makefile](file:///home/ejpark/workspace/scraper/Makefile)의 공통 래퍼 규칙을 다듬어, 이전과 동일한 명령(`make yz-list PAGE=2`, `make clear-queue`, `make gm-sync` 등)으로 도커 내부의 npm 스크립트를 올바르게 전파하여 기동하게 지원.
- **레거시 정리:** 불필요해진 `scripts/sites/`, `scripts/utils/worker.mk`, `scripts/tools/gmail.mk` 및 `scripts/utils/tests.mk`를 완전히 삭제하여 프로젝트 형상 구조 단순화.

- **로직 이관 및 루트 단순화:** 루트 `Makefile` 내에 정의되어 있던 `run-scrape` 로직과 `PAGE`, `LIST_SLACK` 기본값 정의 또한 `apps/crawler/Makefile` 내부로 이관 완료하였으며, 루트 Makefile의 각 사이트별 타겟은 전달받은 파라미터를 그대로 포함하여 `apps/crawler/Makefile`의 `run-scrape` 타겟을 직접 호출하도록 정비하였습니다. 또한 `test-%`, `extract`, `debug` 등의 테스트 유틸 타겟도 `apps/crawler/Makefile`을 통해 npm 스크립트를 전향적으로 실행하도록 위임하였습니다. 뷰어(viewer) 제어 타겟은 루트 Makefile에서 `viewer-%` (viewer-up, viewer-down) 와일드카드 타겟 형태로 명명 규칙을 통일하고 `apps/viewer/Makefile`을 호출하여 위임하도록 구현했습니다. 추가로, `apps/viewer/docker/compose.yml`을 `apps/viewer/compose.yml`로 이동하고 내부 빌드 컨텍스트를 `.`(현재 경로)로 수정하여 설정의 무결성을 보장했습니다. 또한 하위 모든 Makefile(`crawler`, `viewer`, `ebook`)을 대상으로 GNU Make의 내장 함수를 활용해 `ROOT_DIR`을 동적으로 계산하도록 단일 표준화하고, Docker Compose 실행 시 `--project-directory` 옵션을 매핑하여 경로 무결성을 확보했습니다.






## 📈 품질 검증 및 변경 로그 (Changelog)

- **스크립트 표준화:** 각 사이트별 수집/복구 커맨드를 ts-node와 표준 `--` 인자 꼬리 전파 방식으로 통합 완료.
- **CLI 호환성:** 외부 스케줄러(Cronicle 등)나 인간 개발자가 치던 make 타겟 구조 변경 없이 동작이 완벽 호환됨.
- **격리 검증:** `apps/crawler/` 단독 디렉토리 내에서도 독립 빌드 및 큐 관리가 유연하게 동작함.
- **루트 간소화:** 불필요한 공통 변수 및 조건문 빌드 분기를 내부 메이크파일로 위임하여 루트 `Makefile`을 극도로 슬림화하였습니다.

