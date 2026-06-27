# 103-local-review-option.review.md

기존 AI API 기반 코드 리뷰어를 완전 오프라인 로컬 정적 검사기(`npm run review`)로 정착시키고, Gemini 연동 AI 리뷰 기능을 Antigravity 글로벌 사용자 스킬로 격리 이관한 작업에 대한 리뷰 보고서입니다.

---

## 🎯 1. 변경 전/후 대비 (Before/After Comparison)
* **변경 전**:
  - `npm run review`가 외부 API 키(`GEMINI_API_KEY`)를 필요로 하여, 로컬 개발 라이프사이클에 외부 네트워크 호출 및 과금 의존성이 얽혀 있었습니다.
* **변경 후**:
  - `npm run review`는 순수 오프라인 정적 도구(ESLint 및 `tsc --noEmit`)만을 활용해 현재 변경된 파일 영역에 대해서만 빠른 문법 및 타입 체크 진단을 수행하고 레포트(`docs/artifacts/review-report.md`)를 작성합니다.
  - 정밀 설계 진단용 AI 코드 리뷰어 로직은 Antigravity 글로벌 스킬 경로(`/Users/ejpark/.gemini/config/skills/ai_code_reviewer/SKILL.md`)로 완전히 격리 이전되어, 필요할 때 `agy` 또는 에이전트 CLI 컨텍스트 내에서 스킬로써 호출할 수 있도록 분리되었습니다.
  - `AGENTS.md` 제약사항 문구가 개정되어 변경된 아키텍처 가이드와 일치시켰습니다.

---

## 🔍 2. 자가 검증 결과
* **결합 및 작동**: API 키 제거 상태에서도 `scripts/agents/review-changes.sh`가 오프라인으로 modified 파일 린트 및 tsc 진단 정보를 정확히 파싱해 보고서를 발행하는 것을 확인했습니다.
* **스킬 로드**: Antigravity 글로벌 폴더에 올바른 frontmatter를 포함한 `SKILL.md` 문서가 안착되었음을 확인했습니다.
