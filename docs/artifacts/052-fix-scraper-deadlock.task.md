# 📋 할 일 목록 (052-fix-scraper-deadlock.task.md)

## 📌 개요
- **목적**: Scraper의 Redis blocking 커넥션 및 무제한 대기(hanging) 문제로 인한 데드락을 해결하기 위해, `ScraperWorker.ts` 파일의 커넥션 분리 및 120초 글로벌 실행 타임아웃 래퍼 적용.
- **등급**: **Major (Bugfix)**

---

## 🛠️ 작업 목록

### 1단계: 소스 코드 수정
- [x] `apps/crawler/src/workers/ScraperWorker.ts` 파일에 `withTimeout` 헬퍼 함수 구현.
- [x] `ScraperWorker` 클래스 내 `redisBlocking` 멤버 변수 추가 및 생성자에서 연결 분리 초기화.
- [x] `start()` 함수 내 `blpop` 호출 시 `redisBlocking`을 사용하도록 변경.
- [x] `processMessage()` 내 `this.dispatcher.scrape` 호출 시 `withTimeout`을 활용하여 120초(120000ms) 글로벌 타임아웃 제한 적용.
- [x] LinkedIn 세션 만료 등으로 인한 종료(`process.exit`) 처리 시 `redis` 및 `redisBlocking` 두 커넥션 모두 안전하게 `quit()` 처리하도록 수정.

### 2단계: 문서 갱신 및 검토
- [x] `CHANGELOG.md` 파일에 버그 수정 사항 기록 (Bugfix 명시).
- [x] `.review.md` 작성 및 변경사항 코드 리뷰 자가 수행.
- [x] `.walkthrough.md` 작성 및 최종 변경 이력 정리.
- [x] `scripts/agents/commit-changes.sh`를 실행하여 깃 커밋 자동화.
