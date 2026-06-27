# 할 일 목록: 일별 콘텐츠 현황 자동 조회 비활성화 (094-disable-auto-crawl-stats.task.md)

## 📌 할 일 목록 (Todo List)
- [x] 작업 브랜치 생성 및 전환 (`feature/094-disable-auto-crawl-stats`)
- [x] `DashboardView.vue` 코드 수정
  - [x] `onMounted` 훅에서 `fetchCrawlStats()` 제거
  - [x] 최초 진입 시 데이터 조회 유도용 반응형 상태 `hasQueriedStats` 추가
  - [x] `fetchCrawlStats` 완료 시 `hasQueriedStats.value = true` 설정
  - [x] 템플릿 영역에서 데이터가 없거나 조회 전일 때 메시지를 `hasQueriedStats`에 따라 다르게 출력
- [ ] ESLint 및 빌드 확인
- [ ] Git 커밋 수행 (`commit-changes.sh`)
