# Walkthrough: relocate-agents-tooling

에이전트 인프라 도구들을 `apps/agents/` 하위로 안전하게 이관하여 모듈을 독립화하고, 발생하던 TypeScript 컴파일 장애를 해결(Bugfix)한 변경 결과 보고서입니다.

## 변경 결과 요약

### 1. 에이전트 도구 이관 및 환경 구축
- `apps/crawler/src/tools/agents/*` ➡️ [apps/agents/](file:///home/ejpark/workspace/scraper/apps/agents) 하위로 4개 파일 이동 완료.
- [apps/agents/tsconfig.json](file:///home/ejpark/workspace/scraper/apps/agents/tsconfig.json) 신규 생성 및 `"types": ["node"]` 보강 완료 (Bugfix).
- `apps/crawler/src/tools/agents/` 레거시 디렉토리 삭제 완료.

### 2. 파일 참조 및 실행 경로 정형화
- [apps/agents/rules.ts](file:///home/ejpark/workspace/scraper/apps/agents/rules.ts) 및 [apps/agents/sessions.ts](file:///home/ejpark/workspace/scraper/apps/agents/sessions.ts) 내부의 rulesDir, transcriptsDir 등 절대/상대 경로를 `../../` 기준으로 단순화 수정 완료.
- [scripts/utils/agents.mk](file:///home/ejpark/workspace/scraper/scripts/utils/agents.mk) 스크립트 실행 대상을 `apps/agents/` 하위 파일로 갱신하고 `--project` 매개변수 적용 완료 (Bugfix).

### 3. 관련 문서 작성
- [Plan](file:///home/ejpark/workspace/scraper/docs/plans/relocate-agents-tooling.md)
- [Review](file:///home/ejpark/workspace/scraper/docs/reviews/relocate-agents-tooling.md)
- [Task List](file:///home/ejpark/workspace/scraper/docs/reviews/relocate-agents-tooling.task.md)

---

## 검증 (Verification)
- `make agents-dump` 명령어를 통한 최종 덤프 및 룰 압축 동작 무결성 확인.
  - [x] 검증 명령 수행 완료 (성공)
