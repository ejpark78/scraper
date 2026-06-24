# 068-add-trigger-always-on-to-guides.walkthrough.md

본 문서는 프로젝트 규칙 및 가이드/워크플로우 문서 6종의 상단에 현재 상태와 의도에 맞는 `trigger` YAML Frontmatter를 추가했음을 보고하는 결과보고서입니다.

---

## 🏁 작업 완료 내용 (Completed Tasks)
1. **상시 활성 룰 (`trigger: always_on`) 추가**:
   - [git_flow.md](file:///Users/ejpark/workspace/scraper/.agents/rules/git_flow.md)
   - [documentation_lifecycle.md](file:///Users/ejpark/workspace/scraper/.agents/rules/documentation_lifecycle.md)
   - 매 턴마다 기본적으로 활성화되어 에이전트의 안전한 Git 변경 관리 및 문서화 산출물 수명 주기를 강제합니다.

2. **동적 활성 룰 (맥락 트리거) 추가**:
   - [tech_stack.md](file:///Users/ejpark/workspace/scraper/.agents/rules/tech_stack.md): `trigger: code, python, typescript, vue, py, ts, js, uv` (코딩/의존성 변경 시에만 활성화)
   - [docker_environment.md](file:///Users/ejpark/workspace/scraper/.agents/rules/docker_environment.md): `trigger: docker, compose, container, port, volume, network` (Docker 진단 시에만 활성화)
   - [planning.md](file:///Users/ejpark/workspace/scraper/.agents/rules/planning.md): `trigger: plan, spec, adr, design` (기획 설계 계획 수립 요구 시에만 활성화)

3. **워크플로우 명령어 트리거 추가**:
   - [startcycle.md](file:///Users/ejpark/workspace/scraper/.agents/workflows/startcycle.md): `trigger: /startcycle` (사용자가 슬래시 명령어를 주었을 때만 개발 사이클이 활성화됨)

4. **아티팩트 수명 주기**:
   - `068-add-trigger-always-on-to-guides.plan.md` (수정 계획서) 작성 및 보완
   - `068-add-trigger-always-on-to-guides.task.md` (할 일 목록) 작성
   - `068-add-trigger-always-on-to-guides.review.md` (수정 계획 검토서) 작성
   - `068-add-trigger-always-on-to-guides.walkthrough.md` (결과보고서) 작성

---

## 🧪 자가 검증 결과 (Self-Verification)
- 각 문서에 맞춤형 트리거 키워드를 배정하여, 불필요할 때(예: git 작업 시 코딩 스타일 룰 비활성화) 메모리 낭비를 줄이고 필요한 때에만 연동되도록 최적화 상태를 완료했습니다.
- 모든 Frontmatter 문법(`---`로 구분된 YAML 영역)이 깨짐 없이 온전히 기재되었음을 확인했습니다.

---

## 🗂️ 아티팩트 목록
- [068-add-trigger-always-on-to-guides.plan.md](file:///Users/ejpark/workspace/scraper/docs/artifacts/068-add-trigger-always-on-to-guides.plan.md)
- [068-add-trigger-always-on-to-guides.task.md](file:///Users/ejpark/workspace/scraper/docs/artifacts/068-add-trigger-always-on-to-guides.task.md)
- [068-add-trigger-always-on-to-guides.review.md](file:///Users/ejpark/workspace/scraper/docs/artifacts/068-add-trigger-always-on-to-guides.review.md)
- [068-add-trigger-always-on-to-guides.walkthrough.md](file:///Users/ejpark/workspace/scraper/docs/artifacts/068-add-trigger-always-on-to-guides.walkthrough.md)
