# 📝 069-fix-linkedin-crawler-crash.task.md

> **Bugfix** : 이 작업은 LinkedIn 수집 오류(크래시) 현상을 복구하기 위한 버그 수정용 작업 명세입니다.

---

## 🎯 구현 태스크 목록

- [x] `apps/crawler/src/sites/linkedin/Crawler.ts` 내 `chromium.launch` 옵션에 `--no-sandbox` 및 `--disable-setuid-sandbox` 주입 완료
- [x] 변경 내역 저장을 위해 `commit-changes.sh` 실행
- [x] 콤포즈 환경 재빌드 및 재시작 완료 및 정상 작동 검증
- [x] 결과보고서(`069-fix-linkedin-crawler-crash.walkthrough.md`) 작성 완료
