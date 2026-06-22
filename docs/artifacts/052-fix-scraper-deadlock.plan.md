# 📋 계획서: Scraper 데드락 해결 계획 (052-fix-scraper-deadlock.plan.md)

## 1. 🔍 문제 정의 및 분석
- **현상**: `scraper`가 실행 도중 주기적으로 멈추거나 데드락(deadlock) 상태에 빠지는 현상 발생.
- **원인 분석**:
  1. **Redis 커넥션 병목 및 데드락**:
     - `ScraperWorker.ts`에서 단일 `ioredis` 인스턴스를 사용하여 blocking 명령어인 `blpop`과 일반 명령어(`get`, `set`, `rpush`, `lpush` 등)를 동시에 처리함으로써 소켓 커넥션 블로킹 또는 데드락 유발.
  2. **Playwright 및 네트워크 무한 대기 (Hanging)**:
     - LinkedIn 등 Playwright 브라우저를 기반으로 수집하는 작업 혹은 네트워크 상의 `fetch` 연산이 특정한 이유(브라우저 크래시, 프록시 대기, 응답 지연 등)로 인해 완료되지 않고 무한 대기 상태에 빠질 수 있습니다.
     - `ScraperWorker` 내에서 `this.dispatcher.scrape` 호출 시 **글로벌 타임아웃 제한이 전혀 없으므로**, 내부 스크래핑 로직이 멈추면 워커 전체 루프가 영구히 블로킹(락)됩니다.

---

## 2. 🛠️ 해결 방안
1. **Redis 커넥션 이원화**:
   - `blpop` 전용 블로킹 Redis 커넥션(`this.redisBlocking`)과 일반 명령 처리용 Redis 커넥션(`this.redis`)을 이원화하여 연결 간의 경합을 완벽히 격리합니다.
2. **글로벌 스크래핑 타임아웃 (Execution Timeout Wrapper) 추가**:
   - `dispatcher.scrape` 실행 시 최대 시간제한(120초)을 설정하는 타임아웃 프로미스 래퍼(`withTimeout`)를 적용합니다.
   - 120초 이내에 수집이 완료되지 않으면 강제로 Timeout Exception을 던져 실패 처리 루틴(`handleScrapeFailure`)으로 넘어가도록 유도하고, 워커 루프가 다음 작업을 정상적으로 소비할 수 있도록 보장합니다.

---

## 📂 수정 대상 파일
- [ScraperWorker.ts](file:///home/ejpark/workspace/scraper/apps/crawler/src/workers/ScraperWorker.ts)

---

## 4. 📝 세부 변경 계획 (Draft Plan)

### `withTimeout` 헬퍼 유틸리티 구현
```typescript
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
```

### `ScraperWorker` 클래스 생성자 및 필드 변경
```typescript
class ScraperWorker {
  private redis: Redis;            // 일반 명령 처리용
  private redisBlocking: Redis;    // blpop 전용 커넥션
  // ...
  constructor() {
    this.redis = new Redis(REDIS_URL);
    this.redisBlocking = new Redis(REDIS_URL);
    // ...
  }
}
```

### `start()` 루프 수정
```typescript
        const activeQueues = this.queueManager.getActiveQueues();
        // blpop 호출 시 redisBlocking 커넥션 사용
        const res = await this.redisBlocking.blpop(...activeQueues, 5);
        if (!res) continue;
```

### `processMessage` 내 글로벌 타임아웃 적용 (120초 타임아웃)
```typescript
    try {
      await this.checkAndApplyRateLimit(site, scraperSlack);
      
      // 120초 글로벌 타임아웃 적용
      await withTimeout(
        this.dispatcher.scrape(site, url, tempHtmlPath),
        120000,
        `Scraping execution timed out after 120000ms for [${site}]`
      );

      if (!fs.existsSync(tempHtmlPath) || fs.statSync(tempHtmlPath).size === 0) {
        throw new Error('Downloaded raw HTML content is empty.');
      }
```

### 예외 및 종료 처리 수정
```typescript
    if (scrapeErr.message && (scrapeErr.message.includes('세션 만료') || scrapeErr.message.includes('Auth Wall'))) {
      Logger.error(`LinkedIn Session expired. Graceful shut down of scraper.`, scrapeErr);
      await Promise.all([
        this.redis.quit(),
        this.redisBlocking.quit()
      ]);
      process.exit(1);
    }
```

---

## 5. 🧪 검증 계획
1. 소스 코드 수정 후 컴파일 및 린트 검증 수행.
2. `docker compose` 환경에서 빌드 후 큐 메시지 소비가 정상적으로 이루어지는지 확인.
3. 임의의 딜레이를 유발시켜 글로벌 타임아웃 예외가 잡히고 실패 처리 후 다음 작업으로 정상 전이되는지 로그를 통한 시뮬레이션 테스트 진행.
