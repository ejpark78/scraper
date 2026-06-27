# 101-local-code-reviewer.plan.md

로컬 변경 사항에 대해 AI 기반 코드 리뷰 피드백을 생성하여, 원격 PR 생성 전에 코드 품질과 설계 규칙 부합 여부를 점검할 수 있는 유틸리티를 구축합니다.

---

## 🎯 1. 목적 (Objectives)
* 로컬의 수정 중인 코드(`git diff` 및 `git diff --cached`)에 대해 `docs/prompts/review_checklist.md` 및 프로젝트 규칙(`AGENTS.md`)의 핵심 기준 준수 여부를 자동 검토합니다.
* 커밋 수행 전(`commit-changes.sh`) 단계 또는 필요 시 수동으로 `npm run review`를 실행하여 개선 피드백을 터미널 및 파일로 출력합니다.
* 불필요하게 원격 CI/CD를 실행하기 전에 코드 결함(Strict Typing, Connection Leak, DRY 원칙)을 즉각 파악하여 빠른 리팩토링 주기를 지원합니다.

---

## 🏗️ 2. 설계 및 아키텍처 (Architecture & Design)

### A. 기술 스택 선택 및 실행 방식
* **실행 환경**: 모노레포 아키텍처를 해치지 않기 위해, 프로젝트 루트 레벨에서 가용한 **Node.js + LLM API Script** 또는 **Python + `uv run`** 스크립트로 구현합니다.
* **LLM 호출 방법**: Google Gemini API key 또는 프로젝트에 기설정된 AI 프롬프트 실행기 방식을 차용합니다. (로컬 API Key 접근 시 `process.env.GEMINI_API_KEY` 등을 안전하게 활용하고, 절대 `.env`에 직접 기록하지 않고 호스트 터미널에서 주입하거나 인프라 설정을 참고하도록 함.)

### B. 주요 파이프라인
1. **Diff 추출**: `git diff`를 통해 수정된 파일 목록 및 변경 분량을 추출합니다.
2. **리뷰 템플릿 로드**: `docs/prompts/review_checklist.md` 규칙 및 `AGENTS.md` 지침을 템플릿으로 조합합니다.
3. **AI Prompt 수행**: 추출된 diff와 체크리스트 프롬프트를 AI 모델로 전송하여 결과를 분석합니다.
4. **리뷰 피드백 리포팅**: 터미널에 보기 좋은 포맷(Markdown 요약)으로 출력하고, 추가로 임시 파일(`docs/artifacts/review-report.md` 등) 또는 `.review.md` 작업 산출물 생성 시 자동 보강용으로 활용할 수 있게 합니다.

---

## 📝 3. 작업 상세 범위 (Implementation Tasks)
* **스크립트 파일 추가**: 
  - `scripts/agents/review-changes.sh`: 변경 사항을 파악하고 AI 리뷰 스크립트를 트리거하는 진입점 셸 스크립트.
  - `scripts/agents/ai-reviewer.ts` (또는 `.py`): 실제 Gemini API를 통해 Diff를 분석하고, 체크리스트 부합 여부를 정리하여 터미널에 결과를 피드백하는 모듈.
* **npm script 추가**: 
  - `package.json`의 scripts에 `"review": "bash scripts/agents/review-changes.sh"` 등록.
* **commit-changes.sh 수정 (선택/옵션)**:
  - 사용자가 선택할 경우 커밋을 진행하기 전에 자동으로 `npm run review`를 거치게 연동하고, 리뷰 결과 통과 여부를 묻는 선택 분기를 생성.

---

## 🔍 4. 자가 검증 방법 (Verification Steps)
1. **임의의 테스트 코드 작성**: Type Error나 config.env 직접 호출, 혹은 connection close 누락 등의 냄새가 나는 코드를 추가합니다.
2. **리뷰어 실행**: `npm run review` 실행 후 터미널에 `review_checklist.md` 항목별 부적합 사항이 정상적으로 피드백되는지 검증합니다.
3. **정상 코드 리뷰**: 정상적으로 리팩토링 및 룰을 맞춘 상태에서 리뷰 결과가 깨끗하게 "통과 가능" 의견으로 보고되는지 확인합니다.
