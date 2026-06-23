# 065-merge-git-flow-tech-stack-rules.plan.md

본 계획서는 사용자가 제안한 **Git Flow 및 기술 스택 규칙**을 프로젝트의 기존 [AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md) 규칙에 유기적으로 병합하고 보완하기 위해 작성되었습니다.

---

## 🎯 목표 (Objective)
기존 프로젝트 규칙 문서인 `AGENTS.md`에 새로운 Git Flow 브랜치 전략 구체화 및 Python, Vue 3, Docker Compose 개발에 대한 구체적인 엔지니어링 스택 규칙을 병합합니다.

---

## 🗺️ 변경 대상 파일 및 브랜치
- **대상 브랜치 (`Target Branch`)**: `develop` (또는 사용자 지정 작업 브랜치)
- **변경 대상 파일**:
  - [AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md)

---

## 📋 병합 설계 방안

기존 `AGENTS.md` 구조에 사용자의 피드백을 반영하여 다음과 같이 병합합니다.

1. **Git Flow 및 브랜치/커밋 전략 확장**:
   - 기존의 `16. Git Flow 브랜치 전략 및 에이전트 행동 지침` 항목을 더욱 구체화합니다.
   - `main`(배포용, 직접 커밋/수정 절대 금지 및 직접 되돌아가지 않음), `develop`(개발 통합), `feature/*`(기능 개발), `release/*`(배포 준비), `hotfix/*`(긴급 수정)의 역할을 명확히 규정합니다.
   - [Conventional Commits](https://conventionalcommits.org) 준수 요건을 명시합니다 (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).

2. **작업 및 병합(Merge) 절차 명시**:
   - 작업 및 병합 절차를 명확하게 단독 조항으로 구성합니다.
   - **작업 시작 전**: 반드시 최신 `develop` 및 `main` 브랜치 상태를 확보(`git pull`)해야 합니다.
   - **브랜치 전환 전**: 현재 브랜치의 작업 내역을 유실하거나 꼬이지 않도록 `scripts/agents/commit-changes.sh`를 실행하여 완전히 로컬 커밋을 완료하거나 `stash`한 후에 브랜치를 전환해야 합니다.
   - **머지 충돌(Merge Conflict) 처리**: 충돌 발생 시 임의의 강제 푸시(`--force`)를 금지하며 사용자에게 즉시 알려야 합니다.
   - **환경 검증**: 코드 변경 후 Docker 컨테이너 내 빌드/린트 오류 검증 수행을 필수로 지정합니다.
   - **main 직접 제어 금지**: 개발 브랜치에서 작업 도중 `main` 브랜치로 직접 되돌아가거나 직접 커밋하는 행위를 절대 금지합니다.

3. **기술 스택별 작업 규칙(Tech Stack Rules) 추가**:
   - `⚙️ 엔지니어링 및 아키텍처 규칙 (Engineering & Architecture Rules)` 섹션 하위에 언어 및 환경별 세부 규칙을 통합합니다.
   - **🐍 Python**: Python 3.11+ 문법 및 PEP 8 준수, Type Hinting 필수 적용, `uv`를 통한 의존성 관리 및 패키지 추가 시 동기화 의무화(`requirements.txt`는 배제).
   - **🔷 TypeScript & Vue 3 (Frontend)**: 기존 TypeScript 엄격 타입 규칙에 Vue 3 `<script setup>` 및 Composition API 준수, ESLint/Prettier 자동 감지 규칙을 보강합니다.
   - **🐳 Docker Compose (Infrastructure)**: 로컬 개발 환경용 설정 검증, 볼륨 마운트 확인, Docker 캐시 초기화 및 포트/볼륨 관리 규칙을 보완합니다.

---

## 🛠️ 작업 목록 (Tasks)
1. **[AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md) 수정 초안 작성**:
   - 기존 규칙 항목과의 중복을 피하면서 유기적으로 조화되도록 통합하여 수정합니다.
2. **검증 및 커밋**:
   - 수정사항을 로컬 브랜치에 반영한 후 `scripts/agents/commit-changes.sh` 스크립트를 사용하여 커밋합니다.

---

## 🗓️ 후속 문서 수명 주기 계획
계획 승인 이후 다음 아티팩트를 자율적으로 작성하되, 최종 검토 프로세스를 준수합니다:
- `065-merge-git-flow-tech-stack-rules.task.md` (할 일 목록)
- `065-merge-git-flow-tech-stack-rules.review.md` (수정 계획 검토서)
- `065-merge-git-flow-tech-stack-rules.walkthrough.md` (완료 결과보고서)

**[CRITICAL] 리뷰 및 승인 루프**:
- 후속 문서(결과보고서 및 검토서) 작성 후 반드시 사용자에게 리뷰를 요청하고 최종 승인을 받아야 합니다.
- 만약 사용자로부터 승인을 받지 못할 경우, 피드백을 바탕으로 코드 수정 혹은 규칙 보완 단계로 되돌아가서 작업을 다시 수행해야 합니다.
