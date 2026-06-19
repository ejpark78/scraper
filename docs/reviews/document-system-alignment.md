# Code Review: AI-Assisted 개발을 위한 문서 및 경로 정합성 정비

본 리뷰는 `docs/plans/document-system-alignment.md` 계획서에 따라 진행되었으며, 신규 작성된 문서(`GOAL.md`, `specs/integrate-ebook-service.md`, `CHANGELOG.md`)와 모노레포 개편 이후 누락되었던 Makefile 스크립트들의 실행 경로 변경 사항을 검증합니다.

---

## 1. Safety & Infrastructure Checks
- [x] **No Host Port Access**: 변경된 모든 Makefile 명령어들은 여전히 docker compose 내부 네트워크(예: `mongodb:27017`, `meilisearch:7700`) 환경 내에서 동작하도록 설계되어 있으며, 외부 포트 노출은 발생하지 않습니다.
- [x] **Docker Network Usage**: `meili.mk` 및 `mongo.mk` 내부의 데이터 동기화 명령이 `$(COMPOSE) run --rm`을 통해 격리된 네트워크 환경에서 수행됨을 교차 검증했습니다.
- [x] **Connection Leak Prevention**: 변경된 파일은 Makefile의 환경 및 셸 실행 명령어 경로 수정에 국한되므로 새로운 커넥션 누수 위험은 없습니다.
- [x] **Credentials Safe**: `.env` 또는 보안 자격 증명이 Makefile 내에 하드코딩되거나 노출된 부분이 없음을 확인했습니다.

---

## 2. Engineering & OOP Patterns
- [x] **Strict Typing**: TypeScript 스크립트 코드 수정이 아닌 Makefile 경로 수정이므로 타입 시스템 영향도는 없습니다.
- [x] **Centralized Config**: 환경 변수 매핑(`environments.mk`를 통한 `RUN_USER`, `WORKSPACE_MOUNT` 로드)이 일관적으로 준수되고 있습니다.
- [x] **Makefile 볼륨 매핑 정합성**:
  - `worker.mk`의 `SCRIPTS_MOUNT` 바인딩이 `./src/scripts:/app/src/scripts`에서 `./apps/crawler/src/scripts:/app/apps/crawler/src/scripts`로 정상 변경되었습니다.
  - 이를 통해 컨테이너 안에서도 모노레포 구조와 동일하게 `/app/apps/crawler/src/scripts` 내 파일들을 안전하게 변경 감지하고 마운트할 수 있습니다.

---

## 3. 경로 수정 교차 검증 내역 (Path Modifications Cross-Check)
- **`browser.mk`**:
  - `src/crawler/sites/linkedin/Crawler.ts` ➡️ `apps/crawler/src/sites/linkedin/Crawler.ts` (완료)
  - `src/tools/browser/open.ts` ➡️ `apps/crawler/src/tools/browser/open.ts` (완료)
  - `src/scripts/inspect-layout.ts` ➡️ `apps/crawler/src/scripts/inspect-layout.ts` (완료)
- **`meili.mk`**:
  - `src/scripts/meili-manager.ts` ➡️ `apps/crawler/src/scripts/meili-manager.ts` (완료)
- **`mongo.mk`**:
  - `src/scripts/sync-indexes.ts` ➡️ `apps/crawler/src/scripts/sync-indexes.ts` (완료)
  - `src/scripts/show_collection_columns.ts` ➡️ `apps/crawler/src/scripts/show_collection_columns.ts` (완료)
- **`tests.mk`**:
  - `src/scripts/extract_article.ts` ➡️ `apps/crawler/src/scripts/extract_article.ts` (완료)
  - `src/scripts/debug_html.ts` ➡️ `apps/crawler/src/scripts/debug_html.ts` (완료)
- **`worker.mk`**:
  - `src/scripts/queue.ts` ➡️ `apps/crawler/src/scripts/queue.ts` (완료)
  - `src/scripts/grep-errors.ts` ➡️ `apps/crawler/src/scripts/grep-errors.ts` (완료)
  - `src/scripts/fix-urls.ts` ➡️ `apps/crawler/src/scripts/fix-urls.ts` (완료)
- **`AGENTS.md`**:
  - 에이전트 개발 프로세스 강제를 위한 "코드 리뷰 작성 강제 및 자가 검증" 조항 명문화 완료 (완료)
- **`GOAL.md`**:
  - 기존 구축 완료된 수집 엔진들(Tasks 1, 2, 3)을 마일스톤상 완료(`✅ Completed`)로 표시하고, 차후 개발 과제인 시맨틱 통합 검색 및 LLM 분석 리포팅을 핵심 미래 목표로 현행화 완료 (완료)
- **`ScraperWorker.ts`, `ConverterWorker.ts`, `IndexerWorker.ts`, `TargetLoader.ts`**:
  - 기존 레거시 및 별칭(alias) 대신 환경에 구애받지 않고 컴파일이 보장되는 물리적 상대경로(`../../../../packages/database/mongo` 및 `meili`)로 데이터베이스 임포트 경로를 일괄 수정하여 빌드 타임 및 도커 런타임 오류 차단 완료 (완료)

- **`AGENTS.md` (물리 보존 및 버그픽스 룰)**:
  - `docs/reviews/` 하위에 각 계획과 매핑되는 `{plan-name}.task.md` 및 `{plan-name}.walkthrough.md` 복사본 영구 보존 조항 신설 완료 (완료)
  - `Engineering & Architecture Rules` 하위 6번 규칙(No Superficial Patches)에 버그 해결 시 **구조적 패치 지침 및 CHANGELOG/리뷰 문서 내 'Bugfix' 명시 의무화** 수칙 보강 완료 (완료)
- **`document-system-alignment.task.md` & `document-system-alignment.walkthrough.md`**:
  - 이번 작업에 대한 할 일 목록과 결과 보고서를 `docs/reviews/` 하위에 물리적 파일로 안전하게 복사 및 생성 완료 (완료)
- **`CHANGELOG.md` (버그픽스 명문화)**:
  - `[1.1.0]` 릴리즈 이력의 수정(Fixed) 섹션을 버그 해결 내역에 맞춰 **"Fixed (Bugfixes)"**로 선언하고, 4개 Worker와 5개 Makefile의 에러 버그 해결 내용을 구체적으로 기재 완료 (완료)


---

## 4. 종합 의견 (Conclusion)
* 모노레포 개편 작업 이후 잔존해 있던 총 5개의 Makefile 스크립트 실행 경로 및 백그라운드 Worker들의 데이터베이스 모듈 참조 경로가 물리적 상대경로로 완벽히 수정되어 정상 빌드가 보장됨을 최종 확인했습니다.
* `AGENTS.md`에 에이전트 자가 검증 및 코드 리뷰 강제 규칙을 새기고, 아티팩트(`task.md`, `walkthrough.md`)의 프로젝트 내 물리적 백업 보존 수칙을 명문화하여 협업 투명성을 고도화했습니다.

* `GOAL.md`에 사실에 부합하지 않게 기술되었던 이전의 수집 파이프라인 개발 단계를 모두 완료(`Completed`) 처리하고, 실질적으로 남은 리포팅 및 시맨틱 검색 고도화를 미래 목표로 갱신하여 문서의 정확성과 로드맵 정합성을 충족했습니다.
* `sync-ebooks.ts` 관련 수집/동기화 specs 사양서가 정의되었고, 전체 프로젝트 로드맵(`GOAL.md`) 및 릴리즈 1.1.0 이력(`CHANGELOG.md`)이 올바르게 기록되어 문서화 생명주기 정합성이 충족되었습니다.
