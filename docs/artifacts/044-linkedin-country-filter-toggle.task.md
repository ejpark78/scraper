# 📋 할 일 목록 (044-linkedin-country-filter-toggle.task.md)

## 1. ⚙️ 개발 설정 및 준비
- [ ] 계획 승인 받기

## 2. 🛠️ 구현 작업
- [ ] [site.config.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/sites/linkedin/jobs/site.config.ts) 수정
  - `GlobalSettings` 인터페이스에 `geo_enable?: boolean;` 프로퍼티 추가
- [ ] [List.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/sites/linkedin/jobs/List.ts) 수정
  - `extractAndPushJobs` 함수에서 `config.json`으로부터 `global_settings.geo_enable` 로드 로직 구현
  - `matchesTarget` 결정 시 `!geoEnable || targetLocations.includes(geo)` 구조 적용
- [ ] [BasePipeline.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/core/BasePipeline.ts) 수정
  - `config.json`의 `geo_enable` 값을 읽고, `!geoEnable || targetLocations.includes(job.geo)`로 필터링하도록 수정
- [ ] [config.json](file:///home/ejpark/workspace/scraper/apps/crawler/config/config.json) 수정
  - `global_settings` 내에 `"geo_enable": true` 추가

## 3. 🧪 테스트 및 검증
- [ ] `config.json`에서 `geo_enable`를 `false`로 설정한 후 테스트 실행 또는 검증
- [ ] 변경 사항 유효성 검증 후 자동 Git 커밋 수행

## 4. 📝 결과 보고
- [ ] 결과보고서(Walkthrough) 및 리뷰(Review) 문서 작성
