# 할 일 목록: 영구 오류 수집 차단을 위한 failed_permanent 상태 도입 (095-integrate-failed-permanent-status.task.md)

## 📌 할 일 목록 (Todo List)
- [x] 작업 브랜치 생성 및 전환 (`feature/095-integrate-failed-permanent-status`)
- [x] `ScraperWorker.ts` 수정
  - [x] `handleScrapeFailure` 내에서 `isPermanentError` 발생 시 `status: 'failed_permanent'`로 마킹
- [x] `BaseRefreshUrls.ts` 수정
  - [x] `run()` 메서드 내 수집 대상 쿼리에서 `status: { $nin: ['failed', 'failed_permanent'] }`로 필터 강화
- [x] Docker 환경 내 빌드 검증 (`docker compose build worker scraper`)
- [x] Git 커밋 수행 (`commit-changes.sh`)
