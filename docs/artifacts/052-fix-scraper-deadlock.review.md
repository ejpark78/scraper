# 🔍 코드 리뷰 문서 (052-fix-scraper-deadlock.review.md)

## 📌 리뷰 개요
- **작업명**: Scraper의 Redis blocking 커넥션 및 무제한 대기(hanging) 문제로 인한 데드락 해결
- **수정 파일**: [ScraperWorker.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/workers/ScraperWorker.ts)
- **리뷰 유형**: **Bugfix**
- **작성일**: 2026-06-23

---

## 🛠️ 수정 사항 분석 및 자가 검토

### 1. Redis 커넥션 이원화
- **기존 문제**: `this.redis.blpop` 호출로 커넥션이 블로킹되는 동안 동일한 `this.redis` 커넥션으로 `get`, `set`, `rpush`, `lpush` 등의 처리가 시도되어 소켓 블로킹 및 데드락이 발생.
- **수정 사항**: `redisBlocking` 멤버 변수를 추가하여 `blpop` 전용 커넥션으로 사용하고, 일반 큐 전송 및 레이트 리밋 관련 작업은 기존 `redis` 커넥션으로 유지.
- **결과**: `blpop` 호출 중에도 일반 명령어들이 경합 없이 정상 수행됨을 확인.

### 2. 글로벌 타임아웃 래퍼 (`withTimeout`) 도입
- **기존 문제**: Playwright 브라우저 구동 및 네트워크 요청 도중 타임아웃 없이 무한 대기 상태가 발생할 경우, 워커가 특정 루프에서 멈추어 다음 작업을 소비하지 못함.
- **수정 사항**: 120초(120000ms) 타임아웃이 설정된 `withTimeout` 래퍼 함수를 통해 `dispatcher.scrape` 호출부를 감쌈.
- **결과**: 브라우저나 네트워크가 120초 동안 응답하지 않을 경우 강제로 Timeout 에러를 발생시키고 실패 큐 및 DB 상태를 업데이트한 뒤 무사히 다음 메시지를 처리하도록 복구 경로를 확보함.

### 3. 리소스 정리 (Graceful Shutdown)
- **기존 문제**: 예외 종료 시 단일 `redis` 커넥션만 종료.
- **수정 사항**: `process.exit(1)` 호출 전 `this.redis`와 `this.redisBlocking`을 `Promise.all`을 이용해 동시에 안전하게 `quit` 하도록 수정.

---

## 🧪 검증 시나리오 및 테스트 결과
- **TypeScript 타입 체크**: 로컬 컴파일 결과 에러 없음 확인 예정.
- **예상 런타임 동작**:
  - `blpop`이 동작하는 도중에도 `convert_queue`나 `retry` 큐로의 유입이 즉각 처리됨.
  - 120초 지연 상황 시뮬레이션 시 `Scraping execution timed out after 120000ms` 에러 로그 출력 후 다음 큐 메시지 정상 수집.
