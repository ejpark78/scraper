# 104-make-agents-review.plan.md

`make agents-code-review` 명령어를 생성하여, Docker 환경 없이 Antigravity CLI(`agy`)의 `.agents/skills/code_review.md` 스킬을 활용해 `docs/artifacts/###-ai-code-review.md`로 AI 정밀 분석 리포트를 남기는 구조를 구현합니다.

---

## 🎯 1. 목적 (Objectives)
* **`make agents-code-review` 명령어 지원**: 터미널에서 `make agents-code-review`를 호출하면, 현재 변경 내역(`git diff`)과 프로젝트 규칙들을 바탕으로 AI 정밀 코드 리뷰를 진행합니다.
* **단일 스킬 파일 정립**: 복잡한 스킬 폴더 구조 대신 `.agents/skills/code_review.md` 파일에 분석 지침을 단일화하여 인지 복잡도를 낮춥니다.
* **번호가 지정된 아티팩트 보존**: AI 리뷰 결과 보고서 파일명을 `docs/artifacts/###-ai-code-review.md` 형식으로 기록하여, 작업 아티팩트 생명주기 및 Squash 대상에 통합합니다.

---

## 🏗️ 2. 설계 및 아키텍처 (Architecture & Design)

### A. 단일 스킬 정의 (`.agents/skills/code_review.md`)
* YAML frontmatter에 `name: code_review` 및 `description`을 명시합니다.
* 에이전트가 실행 시 `git diff`를 수집하고, `docs/prompts/review_checklist.md`, `AGENTS.md` 지침을 기반으로 개선 포인트를 분석하여 3자리 접두사가 붙은 결과보고서(`docs/artifacts/###-ai-code-review.md`)를 작성 및 `docs/artifacts/INDEX.md`에 추가 기록하도록 인스트럭션을 제공합니다.

### B. Makefile 타겟 추가 (`scripts/agents/agents.mk`)
* `agents-code-review` (또는 `agents-review`) 타겟을 추가합니다.
* 내부적으로 `npx ts-node` 또는 Antigravity 스킬 세션을 트리거하는 호출 흐름을 확보합니다. (실제 에이전트 CLI 구동 시, 사용자에게 질문 혹은 지침 코멘트를 제공하여 코드 리뷰 프로세스가 개시되도록 연동합니다.)

---

## 📝 3. 작업 상세 범위 (Implementation Tasks)
* **`.agents/skills/code_review.md` 생성**: AI 코드 리뷰 스킬 가이드 작성.
* **`/Users/ejpark/.gemini/config/skills/ai_code_reviewer/` 제거**: 이전 임시 글로벌 폴더 삭제.
* **`scripts/agents/agents.mk` 수정**: `review` 및 `code-review` 타겟 추가.
* **`Makefile` 수정**: `agents-code-review`가 바르게 중계되도록 연동.

---

## 🔍 4. 자가 검증 방법 (Verification Steps)
1. **명령어 구동**: `make agents-code-review` 실행 시, 에이전트 스킬 세션이 안정적으로 연동 작동하는지 확인합니다.
