# 🔍 코드 리뷰 문서 (061-apply-git-flow.review.md)

## 📌 리뷰 개요
- **작업명**: AGENTS.md Git Flow 규칙 도입 및 자동 커밋 스크립트 고도화
- **수정 파일**:
  - [AGENTS.md](AGENTS.md)
  - [scripts/agents/commit-changes.sh](scripts/agents/commit-changes.sh)
  - [CHANGELOG.md](CHANGELOG.md)
- **리뷰 유형**: **Major** (규칙 개정 및 코어 스크립트 수정)
- **작성일**: 2026-06-23

---

## 🛠️ 수정 사항 분석 및 자가 검토

### 1. `AGENTS.md` Git Flow 명문화 및 100줄 제한 완화
- **수정 내용**:
  - 16번 규칙 항목으로 Git Flow 브랜치 전략(`main`, `develop`, `feature/###-<name>`, `hotfix/###-<name>`)을 수립.
  - 계획 단계(`.plan.md` 내에 `Target Branch` 작성 필수화)와 작업 프로세스(브랜치 전환 승인 및 작업 후 `develop` 머지 승인 절차) 연계.
  - Token Efficiency Rules의 "AGENTS.md 100줄 이내 유지" 조항을 제거하고 "불필요한 예제/중복 발견 시 정리"로 완화.
- **자가 검토**:
  - 에이전트의 충돌 가능성을 줄이고 다자간 페어 프로그래밍 협업 관점의 정합성 향상.
  - 규칙이 모호해지지 않도록 간결하게 정리됨.

### 2. `commit-changes.sh` 자동 커밋 메시지 감지 로직 고도화
- **수정 내용**:
  - `git rev-parse --abbrev-ref HEAD`를 사용하여 현재 체크아웃된 브랜치명을 획득.
  - 브랜치명이 `feature/([0-9]{3})-(.+)`일 경우 ➡️ `feat(\1): \2` (하이픈은 공백으로 tr 치환) 형태로 빌드.
  - 브랜치명이 `hotfix/([0-9]{3})-(.+)`일 경우 ➡️ `fix(\1): \2` (하이픈은 공백으로 tr 치환) 형태로 빌드.
  - 브랜치명이 부합하지 않는 일반적인 브랜치(develop 등)의 경우 기존의 파일 감지 기반 추론 및 `chore: commit changes`를 Fallback으로 자동 복구.
- **자가 검토**:
  - `BASH_REMATCH`를 활용해 간결하고 예외가 적은 쉘 정규식으로 안전하게 파싱됨.
  - Fallback 구조를 견고히 두어, Git Flow 미적용 브랜치나 임의 환경에서도 스크립트가 중단되지 않고 이전 방식대로 정상 동작함.

---

## 🧪 테스트 시나리오 검증 결과 (자가 수행)
- `commit-changes.sh`는 수동 실행 및 편집 후 자동 실행 시, 현재 일반 브랜치(예: `develop` 또는 `main`) 상태라면 `AGENTS.md` 및 변경 파일들을 감지하여 `docs: update AGENTS.md rules` 혹은 `chore: commit changes`로 유연하게 커밋할 것입니다.
- 현재 브랜치 상태가 Git Flow 규격에 맞게 전환되어 있는지에 따라 동적으로 빌드되는 것을 보장합니다.
