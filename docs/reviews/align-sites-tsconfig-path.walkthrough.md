# Walkthrough: align-sites-tsconfig-path

사이트별 실행 스크립트에서 중복 선언된 CLI 컴파일 매개변수를 걷어내고 컴파일 오류를 해결(Bugfix)한 변경 결과 보고서입니다.

## 변경 결과 요약

### 1. 스크립트 실행 명령어 정형화
- `scripts/sites/` 하위의 모든 `.mk` 파일들(9개) 내 `ts-node` 호출부에서 `--project /app/tsconfig.json` 제거 완료.
- 컴파일러가 환경변수 `-e TS_NODE_PROJECT=/app/tsconfig.json`을 단독으로 안전하게 로드하도록 일원화 완료.

### 2. 관련 문서 작성
- [Plan](file:///home/ejpark/workspace/scraper/docs/plans/align-sites-tsconfig-path.md)
- [Review](file:///home/ejpark/workspace/scraper/docs/reviews/align-sites-tsconfig-path.md)
- [Task List](file:///home/ejpark/workspace/scraper/docs/reviews/align-sites-tsconfig-path.task.md)

---

## 검증 (Verification)
- `make list` 명령어를 통한 `gpters_news` 등 사이트 덤프 정상 동작 확인.
  - [x] 검증 명령 수행 완료 (성공)
