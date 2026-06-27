# 101-local-code-reviewer.review.md

로컬 변경 사항에 대한 AI 코드 리뷰 유틸리티 추가 작업에 대한 자체 검토 보고서입니다.

---

## 🎯 1. 변경 전/후 대비 (Before/After Comparison)
* **변경 전**:
  - 로컬 커밋 전에 코드의 냄새나 정밀 룰(Strict Typing, Connection Leak 등) 검사가 정적으로(Eslint/Type check)만 진행됨.
  - 논리적인 검토나 설계 구조 위반 판단을 하려면 매번 LLM 어시스턴트에게 물어봐야 함.
* **변경 후**:
  - `npm run review` 또는 `scripts/agents/review-changes.sh` 스크립트를 통해 현재 로컬의 수정 변경 사항(Diff)을 한 번에 추출.
  - 추출된 Diff를 `docs/prompts/review_checklist.md` 및 `AGENTS.md` 파일에 정의된 세부 룰들과 결합하여 Gemini API에 전송 및 검증 피드백 출력.
  - `commit-changes.sh` 커밋 파이프라인에 통합되어 커밋하기 직전에 자동으로 코드 리뷰가 수행됨.

---

## 🔍 2. 자가 검증 결과
* **스크립트 작동 검증**:
  - `review-changes.sh`가 로컬 프로젝트 루트에서 `git diff` 상태를 모니터링하고 임시 파일로 디프를 추출하여 `ai-reviewer.ts`로 파이프하는 흐름 검증 완료.
  - `GEMINI_API_KEY` 환경 변수가 유효하지 않을 때는 경고 메시지만 출력하고 비정상 종료(exit 1)하여 기존 커밋 흐름을 방해하지 않고 우아하게 건너뛰도록 처리함.
* **통합 검증**:
  - `package.json`의 `"review"` 스크립트 연결 확인.
  - `commit-changes.sh` 스크립트 내 AI Code Review Check 전처리 단계 추가 완료.
