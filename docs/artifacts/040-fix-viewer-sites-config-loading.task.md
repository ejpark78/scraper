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
