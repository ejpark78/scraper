# Summary: 012-migrate-crawler-to-npm-scripts

> Squashed from: 012-migrate-crawler-to-npm-scripts.review.md 012-migrate-crawler-to-npm-scripts.task.md 012-migrate-crawler-to-npm-scripts.walkthrough.md

---

## Review

# Review: Crawler Scripts 마이그레이션 (NPM Scripts 이관)

본 문서는 `scripts/sites` 마이그레이션 품질을 리뷰하는 문서입니다.

## 🧐 품질 다축 검토 (Multi-Axis Quality Review)

### 1. 관심사 분리 (Separation of Concerns)
- **평가:** 매우 양호합니다.
- **상세:** 크롤러 전용 태스크 명령어들이 `apps/crawler/package.json` 내부로 온전히 귀속되어 서비스 바운더리가 견고해졌습니다.

### 2. 하위 호환성 (Backward Compatibility)
- **평가:** 100% 호환됩니다.
- **상세:** 루트 Makefile의 래핑 레이어가 동일한 매개변수(`PAGE`, `LIST_SLACK`)를 감지하고 `--` 포워딩 방식으로 npm 스크립트에 값을 흘려주므로, 기존의 인프라 크론 및 CLI 타겟은 아무런 수정 없이 동일하게 가동됩니다.

### 3. 파일 유지보수 오버헤드 감소
- **평가:** 파격적으로 줄어들었습니다.
- **상세:** 이전엔 사이트가 9개 늘어나면 9개의 `.mk` 파일이 프로젝트 루트에 존재해야 했으나, 이제 단 하나의 `package.json` 안에서 선언적으로 관리되므로 변경 이력과 형상 복잡도가 극대화로 단순해졌습니다. 또한 `apps/crawler/Makefile` 신규 구축을 통해 루트 Makefile의 구조가 매우 간결해지고 크롤러 전용 관리 명령어 및 Gmail 도구 동기화의 단독 빌드가 가능해졌습니다.

### 4. run-scrape 및 매개변수 격리
- **평가:** 양호합니다.
- **상세:** `PAGE` 및 `LIST_SLACK` 변수 선언과 `run-scrape` 로직 또한 `apps/crawler/Makefile` 내부로 안전하게 이전되었으며, 루트 `Makefile`은 단순 통과 래퍼 역할만 수행하여 루트 레벨의 스파게티 설정을 전면 정리하였습니다.

---

## Task

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
- [x] 서브 Makefile(crawler, viewer, ebook) 전체 대상 GNU Make 내장함수를 활용한 `ROOT_DIR` 동적 설정 및 `--project-directory` 환경 표준화 완료







## 🟨 미진행/보류 작업 (Pending Tasks)
- 없음


---

## Walkthrough

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


---

