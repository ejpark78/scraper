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
