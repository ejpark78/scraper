# 🏁 Walkthrough: Automate Sites Configuration Generation in Viewer Makefile

이 문서는 `viewer` 서비스 빌드와 정적 설정 생성의 결합 자동화 결과를 담고 있습니다.

## 1. 완료된 작업
- `apps/viewer/Makefile`의 `build` 타겟 명령어에 정적 사이트 설정 재생성 자동화 명령을 내장시켰습니다.
- 설계 및 리뷰 문서화 세트 마련.

## 2. 검증 방법 안내
- 사용자가 다음 명령어를 입력하여 빌드를 수행해 봅니다:
  ```bash
  make viewer-build
  ```
- 빌드 콘솔 출력 최상단에 `⚙️  Generating static sites configuration...`이 출력되며 `/config/sites.json`을 새로 기록한 후 이미지를 무사히 빌드하는지 확인합니다.
