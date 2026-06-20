# 🏁 Walkthrough: Fix Relative Import Paths in Crawler Scripts

이 문서는 크롤러 스크립트의 상대 임포트 경로 오류 해결 결과를 담고 있습니다.

## 1. 완료된 작업
- `apps/crawler/src/scripts/` 디렉터리 내 아래 스크립트 파일들의 잘못된 `../crawler/` 경로 상대 참조를 올바르게 교정했습니다.
  - `meili-manager.ts`
  - `clean_legacy_noise_ids.ts`
  - `debug_html.ts`
  - `diagnose-site.ts`
  - `extract_article.ts`
  - `migrate_uppity_ids.ts`
- 설계 및 리뷰 문서화 세트 마련

## 2. 검증 방법 안내
- 변경된 파일은 이미지 빌드 시 복사되므로, 반드시 다시 빌드한 뒤 실행해야 합니다:
  ```bash
  make rebuild ms-reindex SITE=linkedin
  ```
- 컴파일 에러 없이 `meili-manager.ts` 가 무사히 컴파일되어 정상 구동되는지 확인합니다.
