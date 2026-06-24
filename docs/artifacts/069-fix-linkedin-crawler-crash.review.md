# 📝 069-fix-linkedin-crawler-crash.review.md

> **Bugfix** : 이 문서의 변경 사항은 LinkedIn 크롤러의 Docker 구동 시의 SIGTRAP 브라우저 크래시를 해결하기 위한 버그 수정 항목입니다.

---

## 🔍 코드 리뷰 대상
- **수정 파일**: `apps/crawler/src/sites/linkedin/Crawler.ts`
- **목적**: Playwright 브라우저 실행 인자에 `--no-sandbox` 및 `--disable-setuid-sandbox` 옵션 주입

---

## 💻 코드 변경점 대비 (Diff Summary)

```diff
         const browser: Browser = await chromium.launch({
             headless: false,
-            args: ['--disable-blink-features=AutomationControlled']
+            args: [
+                '--no-sandbox',
+                '--disable-setuid-sandbox',
+                '--disable-blink-features=AutomationControlled'
+            ]
         });
```

- **영향도 검토**:
  - 로컬 환경(데스크톱 브라우저 기동 등) 및 헤드리스 백그라운드 환경 둘 다 샌드박스가 비활성화되어 동작하지만, Docker 내부 구동에는 이 옵션이 필수적입니다.
  - 보안 샌드박스 비활성화 외의 크롤링 본문 파싱, API 획득 구조에는 영향이 없으므로 안전한 리스크 제어입니다.
