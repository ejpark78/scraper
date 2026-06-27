# 계획서: 일별 콘텐츠 현황 자동 조회 비활성화 (094-disable-auto-crawl-stats.plan.md)

## 1. 목적 및 배경
`viewer` 페이지 로딩 시 "일별 콘텐츠 현황" 통계 API가 자동으로 호출되어 불필요한 DB 쿼리가 발생하고 성능 저하를 일으킬 수 있습니다. 사용자의 요구에 따라 이 현황이 자동으로 조회되지 않게 하고, 수동으로 '조회' 버튼을 누를 때만 조회가 실행되도록 변경합니다.

## 2. 관련 파일 및 변경 부분
- **대상 파일**: [DashboardView.vue](../../apps/viewer/src/frontend/src/views/DashboardView.vue)
- **변경 사항**:
  1. `onMounted` 훅 내부에서 `fetchCrawlStats()` 호출 제거
  2. 데이터 조회 전 또는 데이터가 없을 때의 UI 문구를 "날짜 범위를 설정한 후 [조회] 버튼을 클릭해 주세요."로 명확하게 변경

## 3. 실행 단계 및 명령어 목록
1. **작업 브랜치 생성 및 전환** (사용자 쉘 승인 필요):
   ```bash
   git checkout develop && git pull && git checkout -b feature/094-disable-auto-crawl-stats
   ```
2. **코드 수정**:
   - `apps/viewer/src/frontend/src/views/DashboardView.vue` 수정
3. **정적 검증 및 빌드 테스트** (필요시 Docker 내 컴파일 검증):
   - 브랜치 변경 사항 커밋 전 `eslint` 및 빌드 확인
4. **Git 커밋**:
   - `scripts/agents/commit-changes.sh` 실행
