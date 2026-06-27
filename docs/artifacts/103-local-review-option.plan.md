# 103-local-review-option.plan.md

`npm run review`를 완전히 로컬 정적 검사 모드(ESLint, tsc 기반 수정 범위 검사)로 고정하고, 기존의 Gemini API 연동 코드 리뷰 기능을 Antigravity 글로벌 스킬로 이관하는 구조적 개선을 진행합니다.

---

## 🎯 1. 목적 (Objectives)
* **Zero-Dependency 로컬 파이프라인**: `scripts/agents/review-changes.sh`에서 외부 API 호출을 완전히 배제하고, 수정된 영역 내의 정적 린트/컴파일 위반 검출 및 레포트 자동 생성(오프라인)만 전담하게 만듭니다.
* **AI 리뷰의 스킬 독립**: Antigravity의 강점인 글로벌 스킬(`skills/ai_code_reviewer`)로 AI 분석 코드를 이관하여, 필요한 시점에 에이전트 스킬로써 호출 및 분석되도록 구성합니다.

---

## 🏗️ 2. 설계 및 아키텍처 (Architecture & Design)

### A. 로컬 정적 리뷰어 개편 (`scripts/agents/review-changes.sh`)
* `git diff`에서 식별된 변경 파일 목록(예: `*.ts`, `*.py`)을 필터링합니다.
* 변경된 TypeScript 파일에 대해 컨테이너 내부(또는 로컬)에서 ESLint 및 `tsc --noEmit` 검사를 해당 파일에만 집중적으로 돌립니다.
* 에러 로그가 발견될 시, 이를 마크다운 형식으로 포맷팅하여 `docs/artifacts/review-report.md` 파일에 기록하고 터미널에 요약 출력합니다.

### B. AI 코드 리뷰어 글로벌 스킬 구축
* Antigravity 글로벌 설정 루트(`/Users/ejpark/.gemini/config/`) 아래에 신규 스킬 `skills/ai_code_reviewer/`를 개설합니다.
* `SKILL.md` 문서에 git diff와 규칙들을 해석하는 규칙과 실행 가이드를 기술하여 Antigravity가 언제든지 호출하여 분석할 수 있게 등록합니다.

---

## 📝 3. 작업 상세 범위 (Implementation Tasks)
* **`scripts/agents/review-changes.sh` 개편**:
  - Gemini API 호출 연결 제거 및 오프라인 전용 정적 에러 라인 파서 구현.
* **`scripts/agents/ai-reviewer.ts` 제거**:
  - 프로젝트 내 불필요해진 API 스크립트 삭제.
* **글로벌 스킬 생성**:
  - `/Users/ejpark/.gemini/config/skills/ai_code_reviewer/SKILL.md` 작성.
* **`AGENTS.md` 보완**:
  - 로컬 `review` 라이프사이클의 오프라인 린트 위주의 변경 사항에 맞춰 가이드를 보정합니다.

---

## 🔍 4. 자가 검증 방법 (Verification Steps)
1. **오프라인 린터 모드 테스트**: 수정 파일을 임의 생성하고 문법 위반 유발 후 `npm run review`를 실행하여 `review-report.md`가 깔끔하게 잘 생성되는지 검증합니다.
2. **글로벌 스킬 로딩 검증**: Antigravity 스킬 스캔을 위해 등록된 SKILL.md 명세를 확인합니다.
