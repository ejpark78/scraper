# 📝 [Plan] 테스트 컴파일 분석서 작성 및 크롤러 규칙 갱신 계획서

본 계획서는 테스트 코드 실행 시의 모듈 및 의존성 격리 실패 문제의 세부 원인 분석서(.issue.md)를 작성하고, 향후 유사한 개발 환경 격리 에러 예방을 위해 크롤러 전용 제약 사항(apps/crawler/AGENTS.md)을 업데이트하는 계획을 정의합니다.

---

## 📅 1. 작업 범위 및 대상 파일

1. **장애 분석서(Issue Report) 신설**
   - 대상: `docs/artifacts/085-test-compilation-issue.issue.md` (신규 작성)
   - 내용: `cheerio`, `turndown` 모듈 및 상대 경로 컴파일 에러의 세부 원인, 모노레포 격리 불균형에 대한 원인 분석 기술.

2. **크롤러 규칙 문서 업데이트**
   - 대상: [apps/crawler/AGENTS.md](file:///Users/ejpark/workspace/scraper/apps/crawler/AGENTS.md)
   - 내용: `3. 테스트 실행 및 로컬 의존성 관리 수칙` 규칙 추가.
     - 테스트 코드 실행 시 반드시 `-P tsconfig.json` 명시 및 로컬 컴파일러 컨텍스트 주입 규정.
     - 로컬 패키지 의존성 격리에 따른 `npm run` 호출 조건 및 의존성 싱크 수칙 명시.

---

## 🛠️ 2. 이행 절차

1. **장애 분석서 작성**: 발생했던 `TSError` 에러 로그 분석, 경로 매핑 충돌 원인 작성.
2. **크롤러 AGENTS.md 수정**: 룰 15번에 부합하도록 `apps/crawler/AGENTS.md`에 크롤러 전용 테스트 환경 매뉴얼 명문화.
3. **자동 커밋**: 변경사항 저장 후 `commit-changes.sh` 실행.
