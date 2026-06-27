# 계획서: 영구 오류 수집 차단을 위한 failed_permanent 상태 도입 (095-integrate-failed-permanent-status.plan.md)

## 1. 목적 및 배경
`HTTP 404 (Not Found)`와 같은 복구 불가능한 영구 오류가 발생한 URL들이 수집 실패 이후에도 `status: 'failed'` 상태로 분류되어, 정기 수집 스케줄링 및 리프레시(`refresh-urls`) 로직에 의해 무한히 재수집 시도되는 현상이 존재합니다. 이로 인해 Redis의 `dead_letter_queue`에 수십만 건의 불필요한 데드레터가 쌓이고 있습니다.

이를 해결하기 위해 복구 불가능한 실패 건은 `failed_permanent`라는 전용 상태를 정의하여 DB에 기록하고, 수집 및 리프레시 대상 선정 시 이를 원천적으로 제외하도록 보장합니다.

## 2. 관련 파일 및 변경 부분
- **[ScraperWorker.ts](../../apps/crawler/src/workers/ScraperWorker.ts)**:
  - `handleScrapeFailure` 내에서 `isPermanentError` (예: 404)에 해당하는 경우, `*.urls` 컬렉션의 `status` 필드를 `failed_permanent`로 저장하도록 수정합니다.
- **[BaseRefreshUrls.ts](../../apps/crawler/src/core/BaseRefreshUrls.ts)**:
  - 리프레시 타겟 조회 쿼리([L123-L129](../../apps/crawler/src/core/BaseRefreshUrls.ts#L123-L129))에서 `failed_permanent` 상태를 가진 URL은 수집 대상에서 명시적으로 배제하도록 필터를 수정합니다.
    - 일반 쿼리: `status: { $nin: ['failed', 'failed_permanent'] }`

## 3. 실행 단계 및 명령어 목록
1. **코드 수정**:
   - `ScraperWorker.ts` 및 `BaseRefreshUrls.ts` 내용 수정
2. **정적 검증 및 빌드 테스트** (Docker 환경 내 빌드 검증):
   - `docker compose build crawler` 또는 `docker compose build viewer-fe`를 통한 모노레포 무결성 검증
3. **Git 커밋**:
   - `scripts/agents/commit-changes.sh` 실행
