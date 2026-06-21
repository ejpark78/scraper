# 📋 할 일 목록 (044-linkedin-country-filter-toggle.task.md)

## 1. ⚙️ 개발 설정 및 준비
- [x] 계획 승인 받기

## 2. 🛠️ 구현 작업
- [x] [site.config.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/sites/linkedin/jobs/site.config.ts) 수정 (1차)
  - `GlobalSettings` 인터페이스에 `geo_enable?: boolean;` 프로퍼티 추가
- [x] [List.ts](file:///home/ejpark/workspace/workspace/scraper/apps/crawler/src/sites/linkedin/jobs/List.ts) 수정
  - `extractAndPushJobs` 함수에서 `config.json`으로부터 `global_settings.geo_enable` 로드 로직 구현
  - `matchesTarget` 결정 시 `!geoEnable || targetLocations.includes(geo)` 구조 적용
- [x] [BasePipeline.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/core/BasePipeline.ts) 수정
  - `config.json`의 `geo_enable` 값을 읽고, `!geoEnable || targetLocations.includes(job.geo)`로 필터링하도록 수정
- [x] [config.json](file:///home/ejpark/workspace/scraper/apps/crawler/config/config.json) 수정
  - `global_settings` 내에 `"geo_enable": true` 추가
- [x] [site.config.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/sites/linkedin/jobs/site.config.ts) 수정 (2차)
  - `descriptor` 객체에 `domain: 'www.linkedin.com'` 추가
- [x] [site.config.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/sites/linkedin/jobs/site.config.ts) 수정 (3차 - 타입 에러 조치)
  - `descriptor` 루트 레벨에 잘못 들어간 `urlsCollectionName`을 삭제하고, `descriptor.scraper` 블록 내부로 이동
- [ ] [Dockerfile (scraper)](file:///home/ejpark/workspace/scraper/apps/crawler/docker/worker/scraper/Dockerfile) 수정
  - 베이스 이미지를 `mcr.microsoft.com/playwright:v1.61.0-jammy`로 업그레이드

## 3. 🧪 테스트 및 검증
- [ ] `make rebuild li-refresh-urls` 명령어 실행 결과 검증 (빌드 및 HTML 스캔 로직 동작 확인)
- [ ] 변경 사항 유효성 검증 후 자동 Git 커밋 수행

## 4. 📝 결과 보고
- [ ] 결과보고서(Walkthrough) 및 리뷰(Review) 문서 작성
