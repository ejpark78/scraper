# 🔍 Code Review: Fix Static Sites Configuration Generation Path

## 1. 개요
- **목적**: 뷰어가 사이트 메타데이터 및 올바른 Meilisearch 인덱스명을 인지할 수 있도록 프로젝트 루트 `config/sites.json`에 빌드 타임 설정 파일이 제대로 생성되도록 경로 수정
- **유형**: Bugfix (버그 수정)

## 2. 변경 내용 및 자가 진입점 평가
- [generate-sites-config.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/scripts/generate-sites-config.ts#L41)에서 `configDir`의 상대 경로 분석 단계가 잘못 설정되어 `apps/crawler/config`로 가던 오류를 `..`을 추가하여 프로젝트 루트의 `config`로 수정했습니다.
- 이에 따라 스크립트 실행 결과로 생성된 `sites.json`을 `viewer-api` 및 `viewer-fe` 빌드 컨텍스트에서 정상 인식할 수 있게 됩니다.

## 3. 평가
- **올바름(Correctness)**: 생성 경로가 `/home/ejpark/workspace/scraper/config/sites.json`으로 올바르게 정렬되었으며, 뷰어가 인덱스 이름 매핑 정보를 정상 로드할 수 있게 됩니다.
- **가독성(Readability)**: 기존 resolve 인자 구조를 깨지 않고 디렉터리 수준만 한 단계 상위로 조정한 안전한 리팩토링입니다.
- **아키텍처(Architecture)**: 뷰어와 크롤러의 빌드 타임 공유 메타데이터가 단일 통합 경로(`config/sites.json`)에서 올바르게 동기화되는 아키텍처 일관성을 회복했습니다.
