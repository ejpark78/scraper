# 079-fix-tool-path-rules.review.md

이 검토서는 `documentation_lifecycle.md` 가이드에 "Gemini Brain vs Workspace" 경로 구분에 따른 도구 사용법이 규정되기 전/후를 비교합니다.

## 🛠️ 변경 대비표

| 구분 | 변경 전 | 변경 후 (적용 내용) |
| :--- | :--- | :--- |
| **`write_to_file` 도구 활용** | 대상 경로에 따라 `ArtifactMetadata` 포함 여부를 명시하지 않아 에이전트 오동작(invalid_args) 유발 가능성 존재 | `Gemini Brain` 경로에서는 필수 기재, `Workspace` 경로에서는 무조건 생략하도록 표준화 명문화 |
| **장애 방지 체계** | 에이전트의 경로 입력 실수 방지가 개인의 메모리에만 의존함 | 가이드 문서에 기술하여 모든 세션에서 에이전트가 본 수칙을 사전에 상시 로드하여 자동 감지하도록 유도 |

## 🔍 변경점 요약 (`.agents/rules/documentation_lifecycle.md`)
```diff
+ ## 5. 🛠️ 도구 사용 및 경로 구분 규칙 (Gemini Brain vs Workspace)
+ 
+ 에이전트는 아티팩트와 소스 코드를 생성/수정할 때 경로에 따라 도구 사용 방식을 명확히 구분해야 합니다.
+ 
+ ### A. 플랫폼 아티팩트 (Gemini Brain 영역)
+ * **대상**: 사용자와 소통하고 승인을 받기 위한 계획서(`.plan.md`), 작업 목록(`.task.md`), 결과보고서(`.walkthrough.md`) 등.
+ * **경로**: `/Users/ejpark/.gemini/antigravity-cli/brain/<conversation-id>/` (Gemini Brain 디렉토리)
+ * **도구 호출**: `write_to_file` 호출 시 `ArtifactMetadata` 필드를 **필수 기재**해야 합니다. (생략 시 일반 텍스트 파일로 처리되어 UI 렌더링 누락)
+ 
+ ### B. 로컬 프로젝트 파일 (Workspace 영역)
+ * **대상**: `src/` 코드, `scripts/` 스크립트, 그리고 프로젝트 저장소 내 보존용 문서(`docs/artifacts/` 하위 파일 등).
+ * **경로**: `/Users/ejpark/workspace/scraper/...` (작업 공간 디렉토리)
+ * **도구 호출**: `write_to_file` 호출 시 `ArtifactMetadata` 필드를 **반드시 제거(omit)**해야 합니다. (기재 시 경로가 Brain 영역이 아니라는 유효성 검사 에러 발생)
```
