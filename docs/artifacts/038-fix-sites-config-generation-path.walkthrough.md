# 🏁 Walkthrough: Fix Static Sites Configuration Generation Path

이 문서는 뷰어의 Meilisearch 인덱스 404 예외 해결 과정의 최종 조치 결과를 담고 있습니다.

## 1. 완료된 작업
- `apps/crawler/src/scripts/generate-sites-config.ts` 의 출력 파일 생성 경로를 루트 `config/sites.json` 으로 변경 완료.
- 설계 및 리뷰 문서화 세트 마련.

## 2. 검증 방법 안내
- 정적 설정 파일을 재생성하기 위해 호스트(로컬)에서 아래 명령어를 수동으로 1회 실행합니다.
  ```bash
  npx ts-node apps/crawler/src/scripts/generate-sites-config.ts
  ```
- 이후 뷰어 서비스 이미지를 재빌드하여 신규로 생성된 `config/sites.json`을 컨테이너 내부에 탑재합니다.
  ```bash
  make rebuild ms-reindex SITE=linkedin
  ```
- 뷰어 웹 대시보드에서 `LinkedIn Jobs`를 클릭했을 때 Meilisearch 404 에러 없이 데이터 목록이 정상 노출되는지 확인합니다.
