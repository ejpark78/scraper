# 068-add-trigger-always-on-to-guides.plan.md

본 계획서는 각 가이드 및 스킬 문서들이 **현재 상태(상시 활성 또는 유동적 활성)**에 부합하게 동작하도록, 문서별 최상단에 적절한 `trigger` 조건을 YAML Frontmatter로 선언하기 위해 작성되었습니다.

---

## 🎯 목표 (Objective)
- 각 가이드 문서 및 워크플로우 파일 상단에 현재 성격과 동작 방식에 부합하는 `trigger` 메타데이터를 추가합니다.
- 상시 로드되어야 하는 핵심 가이드는 `always_on`으로 지정하고, 특정 기술 작업이나 명령어 입력 시에만 활성화되어야 하는 문서는 적절한 매칭 키워드를 trigger로 선언하여 토큰을 절약합니다.

---

## 🗺️ 변경 대상 파일 및 브랜치
- **대상 브랜치 (`Target Branch`)**: `develop`
- **변경 대상 파일**:
  - `.agents/rules/git_flow.md` (상시 활성화가 권장되나 유동적 활성 설정 시: `git, commit, branch, checkout, merge, push, pull`)
  - `.agents/rules/tech_stack.md` (코딩 시 활성화: `py, ts, vue, js, json, uv, eslint, prettier`)
  - `.agents/rules/docker_environment.md` (도커 시 활성화: `docker, compose, container, port, volume, traefik`)
  - `.agents/rules/documentation_lifecycle.md` (문서 작성 시 활성화: `plan, spec, review, task, walkthrough, artifact, squash`)
  - `.agents/rules/planning.md` (설계 시 활성화: `plan, adr, spec, design`)
  - `.agents/workflows/startcycle.md` (명령어 입력 시 활성화: `/startcycle`)

---

## 📋 문서별 trigger 추가 설계

1. **상시 활성 룰 (`trigger: always_on`)**:
   - `git_flow.md`, `documentation_lifecycle.md`: 에이전트가 깃 커밋이나 문서화 산출물을 만드는 것은 매 턴마다 일어날 수 있고 실수하면 안 되므로 **always_on**으로 지정하는 것이 안전합니다.
2. **동적 활성 룰 (특정 키워드/환경 trigger)**:
   - `tech_stack.md`: `trigger: code, python, typescript, vue, script, class, interface, type, py, ts, js`
   - `docker_environment.md`: `trigger: docker, compose, container, port, volume, network`
   - `planning.md`: `trigger: plan, spec, adr, design`
   - `startcycle.md`: `trigger: /startcycle`

---

## 🛠️ 작업 목록 (Tasks)
1. **대상 문서 파일들 수정**:
   - 각 파일 최상단에 위 설계에 따른 Frontmatter 삽입.
2. **검증 및 커밋**:
   - `scripts/agents/commit-changes.sh` 실행하여 커밋 자동화.

---

## 🗓️ 후속 문서 수명 주기 계획
계획 승인 이후 다음 아티팩트를 자율적으로 작성하되, 최종 검토 프로세스를 준수합니다:
- `068-add-trigger-always-on-to-guides.task.md` (할 일 목록)
- `068-add-trigger-always-on-to-guides.review.md` (수정 계획 검토서)
- `068-add-trigger-always-on-to-guides.walkthrough.md` (완료 결과보고서)

**[CRITICAL] 리뷰 및 승인 루프**:
- 후속 문서 작성 후 반드시 사용자에게 리뷰를 요청하고 최종 승인을 받아야 합니다.
- 승인을 받지 못할 경우, 피드백을 바탕으로 보완 단계로 되돌아갑니다.
