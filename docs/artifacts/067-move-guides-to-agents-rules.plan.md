# 067-move-guides-to-agents-rules.plan.md

본 계획서는 방금 생성한 개발 가이드 문서 4종의 물리적 경로를 `docs/guides/`에서 에이전트 규칙 관리 폴더인 `.agents/rules/`로 이동하고, 기존의 규칙 파일 명명 패턴(Snake Case)에 일치하도록 정비하기 위해 작성되었습니다.

---

## 🎯 목표 (Objective)
- 가이드 문서들의 위치를 AI 제어 설정용 폴더인 `.agents/rules/` 하위로 이동하여 에이전트 규칙들을 단일 폴더에서 일관성 있게 관리합니다.
- 아티팩트 문서(`docs/artifacts/`)는 프로젝트 공식 개발 히스토리이므로 그대로 유지합니다.
- `AGENTS.md` 내에 기재된 링크들을 새로 바뀐 파일 경로로 갱신합니다.

---

## 🗺️ 변경 대상 파일 및 브랜치
- **대상 브랜치 (`Target Branch`)**: `develop`
- **삭제할 파일**:
  - `docs/guides/git-flow.md`
  - `docs/guides/tech-stack.md`
  - `docs/guides/docker-environment.md`
  - `docs/guides/documentation-lifecycle.md`
- **새로 생성/이동할 파일**:
  - `.agents/rules/git_flow.md`
  - `.agents/rules/tech_stack.md`
  - `.agents/rules/docker_environment.md`
  - `.agents/rules/documentation_lifecycle.md`
- **수정할 파일**:
  - [AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md)

---

## 📋 이동 및 링크 정비 방안

1. **`.agents/rules/` 하위로 파일 작성 (Snake Case 명명법)**:
   - `docs/guides/` 내 가이드 문서들의 텍스트를 복사하여 `.agents/rules/` 폴더 내에 Snake Case 파일명으로 새로 생성합니다.
2. **`AGENTS.md` 내 가이드 링크 업데이트**:
   - `AGENTS.md`에 반영된 4종의 가이드 링크 경로를 새로 생성된 `.agents/rules/...` 절대 경로로 매핑합니다.
3. **구 가이드 파일 삭제**:
   - `docs/guides/` 내의 파일들을 정리합니다.

---

## 🛠️ 작업 목록 (Tasks)
1. **신규 위치로 가이드 문서 복사 생성**:
   - `.agents/rules/git_flow.md`
   - `.agents/rules/tech_stack.md`
   - `.agents/rules/docker_environment.md`
   - `.agents/rules/documentation_lifecycle.md`
2. **[AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md) 링크 수정**:
   - 파일 이동에 따른 `AGENTS.md` 내 마크다운 링크 교체.
3. **기존 가이드 파일 삭제 및 커밋**:
   - 쉘 명령어나 파일 삭제 툴을 사용하여 구 파일들을 정리하고 `commit-changes.sh` 실행.

---

## 🗓️ 후속 문서 수명 주기 계획
계획 승인 이후 다음 아티팩트를 자율적으로 작성하되, 최종 검토 프로세스를 준수합니다:
- `067-move-guides-to-agents-rules.task.md` (할 일 목록)
- `067-move-guides-to-agents-rules.review.md` (수정 계획 검토서)
- `067-move-guides-to-agents-rules.walkthrough.md` (완료 결과보고서)

**[CRITICAL] 리뷰 및 승인 루프**:
- 후속 문서 작성 후 반드시 사용자에게 리뷰를 요청하고 최종 승인을 받아야 합니다.
- 승인을 받지 못할 경우, 피드백을 바탕으로 보완 단계로 되돌아갑니다.
