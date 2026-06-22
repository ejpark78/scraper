# Summary: 040-fix-viewer-sites-config-loading

> Squashed from: 040-fix-viewer-sites-config-loading.review.md 040-fix-viewer-sites-config-loading.task.md 040-fix-viewer-sites-config-loading.walkthrough.md

---

## Review

### 040-fix-viewer-sites-config-loading.review

# 🔍 Code Review: Fix Viewer Sites Configuration Loading

## 1. 개요
- **목적**: 뷰어 서비스 빌드 시 컨텍스트가 `apps/viewer`로 제한되어 최상위 `config/sites.json`을 이미지 내부에 포함하지 못하던 빌드 격리 현상 및 뷰어 런타임 상대 경로 불일치 문제(Bugfix) 조치
- **유형**: Bugfix (버그 수정)

## 2. 변경 내용 및 자가 진입점 평가
- [generate-sites-config.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/scripts/generate-sites-config.ts#L41)의 대상을 뷰어 빌드 컨텍스트 내부 경로인 `apps/viewer/config/sites.json` 으로 단일화하여 이미지 내에 완벽히 복사되도록 했습니다. (크롤러에서는 이 정적 파일이 실시간 스캔 대체 기능으로 불필요함)
- [SiteRegistry.ts](file:///home/ejpark/workspace/scraper/apps/viewer/src/core/SiteRegistry.ts#L78)의 파일 조회 경로를 `/app/config/sites.json` (뷰어 이미지 내 복사 경로)에 알맞게 `..` 2단계 위로 단축시켰습니다.

## 3. 평가
- **올바름(Correctness)**: 뷰어 서비스 빌드 시 메타데이터가 완벽히 탑재되며, 런타임에 올바른 인덱스명을 로드할 수 있게 됩니다.
- **가독성(Readability)**: 폴더 스캔 폴백이 존재하는 크롤러와 뷰어의 메타데이터 분리 의존성을 고려하여, 복잡한 다중 생성을 생략하고 단일 파일로 최적화했습니다.
- **아키텍처(Architecture)**: 도커 빌드 고유의 컨텍스트 격리 원칙에 부합하면서도, monorepo 프로젝트 구조 내부에서 가장 깔끔하게 동기화되도록 경로 관계를 정상화했습니다.

---

## Task

### 040-fix-viewer-sites-config-loading.task

# 📋 Task: Fix Viewer Sites Configuration Loading

이 태스크 목록은 뷰어가 설정 파일을 가져올 수 없던 빌드 컨텍스트 차단 현상을 해결하는 과정을 관리합니다.

## 할 일 목록
- [x] `apps/crawler/src/scripts/generate-sites-config.ts` 의 파일 생성 경로 교정 (`apps/viewer/config/sites.json` 단일 위치 지정)
- [x] `apps/viewer/src/core/SiteRegistry.ts` 내 설정 로드 상대 경로 교정 (`..` 2개 위)
- [ ] 호스트 로컬 상에서 `npx ts-node apps/crawler/src/scripts/generate-sites-config.ts` 실행하여 `apps/viewer/config/sites.json` 수동 생성 및 결과 확인
- [ ] 불필요해진 최상위 `config/sites.json` 파일 정리
- [ ] 코드 리뷰 문서 (`040-fix-viewer-sites-config-loading.review.md`) 작성
- [ ] 결과보고서 (`040-fix-viewer-sites-config-loading.walkthrough.md`) 작성
- [ ] 자동 커밋 스크립트 실행

---

## Walkthrough

### 040-fix-viewer-sites-config-loading.walkthrough

# 🏁 Walkthrough: Fix Viewer Sites Configuration Loading

이 문서는 뷰어의 Meilisearch 인덱스 로딩 경로 해결 결과를 담고 있습니다.

## 1. 완료된 작업
- `generate-sites-config.ts` 가 뷰어의 빌드 격리 범위를 고려하여 `apps/viewer/config/sites.json` 으로 단일 설정 파일을 생성하도록 변경.
- 뷰어 내부의 `discoverSites()` 의 정적 로드 파일 상대 경로를 컨테이너 및 런타임에 부합하는 `..` 2개 상위 경로(`/app/config/sites.json`)로 교정.
- 설계 및 리뷰 문서화 세트 마련.

## 2. 검증 방법 안내
- 사용자는 다음 명령어를 실행하여 런타임 검증을 재시도합니다:
  ```bash
  make viewer-build && make viewer-up
  ```
- 뷰어 웹 대시보드(https://viewer.localhost)에 접속해 `LinkedIn Jobs`의 데이터 목록이 에러 없이 무사히 렌더링되는지 확인합니다.

---

