# Plan: AI-Assisted Coding 및 서비스 통합을 위한 문서 체계 정립 계획

기존 모노레포 개편 및 Ebook 서비스 마이그레이션이 완료됨에 따라, 전체 시스템의 개발 생명주기(SDLC)를 완성하고 AI 협업 효율성을 높이기 위해 `GOAL.md` 생성, `CHANGELOG.md` 업데이트, `docs/specs/` 내 Ebook 서비스 사양 명세화를 진행합니다.

## User Review Required
> [!NOTE]
> - `GOAL.md`에는 단기 마일스톤(Ebook 이관 및 DB 연동) 외에 LinkedIn Jobs 취합, 기술 메일링 리스트 취합, 트렌드 분석 리포팅 등 시스템의 장기 비전이 기술됩니다.
> - `CHANGELOG.md`에는 릴리즈 버전의 모노레포 개편 작업 이력이 요약되어 기록됩니다.

## Proposed Changes

### 1. 프로젝트 목표 및 로드맵 정의
- **`[MODIFY]`** `GOAL.md`: 프로젝트의 핵심 목표 및 이정표 로드맵 정의 (기존 구축 완료된 LinkedIn, 뉴스레터, Ebook 수집 단계를 '완료'로 수정하고, 검색 고도화 및 LLM 트렌드 분석 리포팅을 핵심 미래 목표로 재정립)


### 2. 프로젝트 변경 이력 관리
- **`[MODIFY]`** `CHANGELOG.md`: 기존 변경 이력에 모노레포 통합 마일스톤 완료 사항 릴리즈 내역으로 추가

### 3. Ebook 파이프라인 사양 구체화
- **`[NEW]`** `docs/specs/integrate-ebook-service.md`: `specs_template.md` 양식에 근거하여 파이썬 파서의 동작, 데이터 동기화(`sync-ebooks.ts`) 흐름, DB 적재 사양을 기록

### 4. Makefile 스크립트 실행 경로 수정
- **`[MODIFY]`** `scripts/utils/browser.mk`, `scripts/utils/meili.mk`, `scripts/utils/mongo.mk`, `scripts/utils/tests.mk`, `scripts/utils/worker.mk`: 레거시 `src/scripts` 경로를 모노레포 구조에 맞는 `apps/crawler/src/scripts`로 일괄 수정

### 5. AGENTS.md 내 자가 검증 규칙 보강
- **`[MODIFY]`** `AGENTS.md`: "Documentation Lifecycle Rules" 섹션에 코드/설정 변경 시 리뷰 문서 강제 작성 및 자가 검증 의무화 조항 명문화

### 6. Scraper/Converter Worker 데이터베이스 임포트 오류 수정
- **`[MODIFY]`** `apps/crawler/src/workers/ScraperWorker.ts`, `apps/crawler/src/workers/ConverterWorker.ts`: 레거시 상대경로 `../../database/mongo`를 모노레포 표준 패키지 별칭인 `@wiki/database`로 변경




---

## Verification Plan

### Automated Tests
- 없음 (문서 작성 작업이므로 린트 및 마크다운 깨짐 여부 수동 확인)

### Manual Verification
1. 작성 완료된 모든 마크다운 파일들의 상대 링크 작동 여부 확인 (`docs/templates/` 및 실제 생성 파일 간의 링크 정합성)
2. `scripts/agents/commit-changes.sh` 실행 시 정상적으로 문서 추가 변경 내역이 Git 커밋으로 반영되는지 확인
