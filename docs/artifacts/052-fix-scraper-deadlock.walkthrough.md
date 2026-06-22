# 🏁 결과보고서 (052-fix-scraper-deadlock.walkthrough.md)

## 📌 작업 개요
- **작업명**: Scraper의 Redis blocking 커넥션 및 무제한 대기(hanging) 문제로 인한 데드락 해결
- **릴리즈 버전**: `[1.8.0]`
- **상태**: **완료**

---

## 🛠️ 변경 및 적용 사항 요약

### 1. [ScraperWorker.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/workers/ScraperWorker.ts) 수정
- **Redis 커넥션 분리**:
  - `this.redisBlocking`을 `blpop` 전용으로 사용.
  - `this.redis`는 일반 처리용(`get`, `set`, `rpush`, `lpush`)으로 활용.
- **실행 타임아웃 래퍼 적용**:
  - `withTimeout` 헬퍼 함수를 추가.
  - `this.dispatcher.scrape` 호출 시 **120초(120000ms)** 글로벌 타임아웃을 적용하여 무한 대기 시 강제 종료 후 예외 복구되도록 처리.
- **안전한 프로세스 종료**:
  - 세션 만료 시 `redis` 및 `redisBlocking` 모두 `quit()`를 보장한 뒤 종료.

### 2. Changelog 반영
- [apps/crawler/CHANGELOG.md](file:///home/ejpark/workspace/scraper/apps/crawler/CHANGELOG.md)에 `[1.8.0]` 마일스톤 생성 및 버그 수정(Bugfix) 등록 완료.
- [CHANGELOG.md (Master)](file:///home/ejpark/workspace/scraper/CHANGELOG.md)에 릴리즈 요약 추가 완료.

---

## 📈 개선 효과
- Redis 블로킹 큐 점유 중에도 비동기 큐 푸시 및 캐시 확인이 즉각 처리되어 **동시성 제어로 인한 데드락이 완전 차단**됩니다.
- Playwright 브라우저 먹통 현상이나 네트워크 응답 지연으로 인한 스크래퍼 전체의 영구적인 멈춤 현상(hanging)이 방지되고, **120초 후 자동으로 다음 큐 작업으로 전이**됩니다.
