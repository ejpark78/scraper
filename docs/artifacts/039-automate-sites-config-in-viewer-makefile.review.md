# 🔍 Code Review: Automate Sites Configuration Generation in Viewer Makefile

## 1. 개요
- **목적**: `make viewer-build` 실행 과정에서 정적 설정 파일인 `config/sites.json`을 자동으로 갱신하도록 빌드 선행 조건을 의존성 내장
- **유형**: Minor (기능 개선)

## 2. 변경 내용 및 자가 진입점 평가
- [apps/viewer/Makefile](file:///home/ejpark/workspace/scraper/apps/viewer/Makefile#L11-L15)에 `docker compose run`을 사용해 `generate-sites-config.ts`를 실행하고 볼륨 마운트로 호스트에 기록하는 로직을 추가했습니다.
- 이를 통해 뷰어 이미지를 빌드하기 직전에 최신 사이트 정보 설정이 항상 반영됩니다.

## 3. 평가
- **올바름(Correctness)**: 수동으로 실행해 줘야 했던 스크립트 실행이 자동화되어 누락 실수를 방지할 수 있습니다.
- **가독성(Readability)**: Makefile 지시어가 간결하게 추가되어 흐름 파악에 무리가 없습니다.
- **아키텍처(Architecture)**: 도커 빌드 파이프라인과 로컬 호스트 볼륨 마운트의 유기적 작동 방식을 유지하며 빌드 라이프사이클의 안전성을 높였습니다.
