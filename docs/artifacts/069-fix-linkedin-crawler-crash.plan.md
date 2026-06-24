# 📋 069-fix-linkedin-crawler-crash.plan.md

이 계획서는 Docker 컨테이너 내에서 LinkedIn 수집기(Playwright Chromium) 기동 시 `SIGTRAP` 강제 종료 및 `Target page, context or browser has been closed` 예외로 인해 수집 큐가 줄어들지 않고 크롤러가 `unhealthy` 상태에 빠지는 현상을 해결하기 위한 작업 설계입니다.

---

## 🎯 개선 목표
- `apps/crawler/src/sites/linkedin/Crawler.ts`의 `chromium.launch` 호출 부에 Docker 환경 대응을 위한 브라우저 인자(`--no-sandbox`, `--disable-setuid-sandbox`)를 추가합니다.
- 수집 워커가 정상적으로 페이지를 수집하고 MongoDB에 적재함으로써 Redis 큐가 해소되는 것을 보장합니다.

---

## 🛠️ 수정 계획

### 1. `apps/crawler/src/sites/linkedin/Crawler.ts` 파일 수정
Playwright의 `chromium.launch` 옵션을 수정하여 `--no-sandbox`와 `--disable-setuid-sandbox` 인자를 전달합니다.

- **대상 메서드**: `login()`, `scrapeJob()`, `scrapeCompanyAbout()`
- **수정 상세**:
  ```typescript
  // AS-IS
  const browser: Browser = await chromium.launch({
      headless: isHeadless,
      args: ['--disable-blink-features=AutomationControlled']
  });

  // TO-BE
  const browser: Browser = await chromium.launch({
      headless: isHeadless,
      args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-blink-features=AutomationControlled'
      ]
  });
  ```

---

## 📋 검증 및 후속 작업 계획
1. 소스 코드를 수정한 뒤, 프로젝트에 적용(커밋)합니다.
2. 수집기 컨테이너가 정상적으로 실행되는지 점검하고, 필요한 경우 컨테이너를 재시작하여 큐 소비 및 로그를 모니터링합니다. (컨테이너 재시작 등은 사용자에게 위임하여 조작을 진행합니다)

---

## 📝 할 일 목록 (Task List)
- [ ] `apps/crawler/src/sites/linkedin/Crawler.ts` 수정
- [ ] 편집 완료 직후 `scripts/agents/commit-changes.sh` 실행
- [ ] 컨테이너 재빌드/재시작을 위한 가이드 제시 및 모니터링
