# 067-move-guides-to-agents-rules.review.md

본 검토서는 가이드 문서 4종의 `.agents/rules/` 하위 이동 작업에 대한 위치 설계 및 기존 규정 구조 변화를 검토합니다.

---

## 🔍 수정 전/후 대비 (Before vs After)

### 1. 가이드 문서 파일 위치 및 명명법 변경
* **[수정 전]**: 
  - `docs/guides/git-flow.md`
  - `docs/guides/tech-stack.md`
  - `docs/guides/docker-environment.md`
  - `docs/guides/documentation-lifecycle.md`
* **[수정 후]**: 
  - `.agents/rules/git_flow.md`
  - `.agents/rules/tech_stack.md`
  - `.agents/rules/docker_environment.md`
  - `.agents/rules/documentation_lifecycle.md`
  - AI 에이전트의 구체적 실패 규칙 및 가이드를 일관되게 한곳(`.agents/rules/`)에서 관리하도록 단일화하고, 파일명 형식을 기존 규칙(`.agents/rules/db_diagnostic.md` 등)과 정렬하기 위해 Snake Case로 변경.

---

## ⚠️ 잠재적 영향도 및 위험 분석
* **가장 큰 위험**: `AGENTS.md` 내에 기재된 링크 경로가 오타로 인해 잘못 갱신될 경우, 에이전트가 해당 가이드 문서를 찾지 못하는 링크 유실(Link Broken) 현상이 발생할 수 있습니다.
* **위험 완화 전략**: 수정 후 `AGENTS.md`에 기재된 링크가 새 경로(`.agents/rules/...`)와 일치하는지 최종 철저히 교차 검증합니다.
