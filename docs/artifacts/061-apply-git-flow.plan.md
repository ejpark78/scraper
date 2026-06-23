# 📋 계획서: AGENTS.md Git Flow 적용 및 규칙 갱신 계획 (061-apply-git-flow.plan.md)

## 1. 🔍 문제 정의 및 분석
- **현상**:
  - 현재 프로젝트에는 에이전트의 자율 커밋 규칙(`commit-changes.sh`)은 있으나, 다중 협업을 위한 Git Flow 브랜치 운용 규칙이 명문화되어 있지 않습니다.
  - `scripts/agents/commit-changes.sh`가 정적 파일명 위주로 커밋 메시지를 매칭하여 브랜치 맥락을 잘 반영하지 못합니다.
  - `AGENTS.md` 내에 "AGENTS.md는 100줄 이내 유지" 규칙이 실질적으로 상세한 Docker 및 DB 관련 제약을 포함하기에 너무 타이트하므로 완화가 필요합니다.
- **목적**:
  - `AGENTS.md`에 Git Flow 브랜치 라이프사이클과 에이전트의 행동 지침을 정의합니다.
  - 사용자의 요청에 따라 `AGENTS.md` 100줄 이내 유지 조항을 "불필요한 예제/중복 발견 시 정리"로 수정합니다.
  - `scripts/agents/commit-changes.sh`가 브랜치 이름의 번호 및 타입을 감지하여 커밋 메시지를 생성하도록 자동화 성능을 고도화합니다.

---

## 🛠️ 해결 방안

### 1. `AGENTS.md` 규칙 보완 및 수정
- **Git Flow 브랜치 규격 선언**:
  - `main`: 제품 배포 (직접 커밋 금지)
  - `develop`: 메인 통합 개발 브랜치 (에이전트의 기본 작업 대상)
  - `feature/###-<name>`: 기능 개발용 (아티팩트 순차 번호 필수 포함)
  - `hotfix/###-<name>`: 긴급 버그 수정용
- **에이전트 행동 지침 명문화**:
  - `.plan.md` 작성 시 상단에 대상 브랜치(`Target Branch`) 기재 의무화.
  - 계획서 승인 후 작업을 개시하기 전에 사용자에게 브랜치 생성 및 전환 명령을 제안하여 승인을 받아 전환.
  - 작업 완료 후 `.walkthrough.md`를 제출하고 사용자에게 `develop`으로의 병합(Merge) 명령을 제안하여 최종 통합.
- **제약 완화 반영**:
  - 107라인 부근의 `2. AGENTS.md 유지보수: AGENTS.md는 100줄 이내 유지. 불필요한 예제/중복 발견 시 정리` 문구를 `2. AGENTS.md 유지보수: AGENTS.md는 불필요한 예제/중복 발견 시 정리`로 수정.

### 2. `scripts/agents/commit-changes.sh` 스크립트 보완
- 현재 체크아웃된 브랜치명을 분석하는 로직 추가:
  - 브랜치명이 `feature/([0-9]{3})-(.+)`인 경우 ➡️ `feat(\1): \2` 형식의 커밋 메시지 기본값 지정.
  - 브랜치명이 `hotfix/([0-9]{3})-(.+)`인 경우 ➡️ `fix(\1): \2` 형식의 커밋 메시지 기본값 지정.
  - 일반적인 `develop`이나 `main`에서는 기존 파일 추론 방식을 Fallback으로 유지.

---

## 📂 수정 대상 파일 목록
1. [AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md) (Git Flow 규칙 정의 및 100줄 제한 완화)
2. [commit-changes.sh](file:///Users/ejpark/workspace/scraper/scripts/agents/commit-changes.sh) (브랜치명 감지 기반 자동 커밋 메시지 동적 빌드 추가)

---

## 🧪 검증 계획
1. `commit-changes.sh` 수정 후, 로컬에서 임의의 테스트 브랜치 `feature/999-git-flow-test`를 만들어 변경사항이 생겼을 때 자동 생성되는 커밋 메시지가 `feat(999): git flow test` 형태가 되는지 드라이런 또는 테스트 수행.
2. `AGENTS.md` 변경 사항이 린터나 다른 에이전트 구동에 문제가 없는지 구조 확인.
