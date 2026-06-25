# 081-fix-artifacts-rule-spec.review.md

이 검토서는 계획서 및 작업 아티팩트의 승인 제어 및 가독성 동시 만족을 위한 규정 보완 전과 후를 검토합니다.

## 🛠️ 변경 대비표

| 구분 | 변경 전 | 변경 후 (적용 내용) |
| :--- | :--- | :--- |
| **계획서 열람성** | 플랫폼 경로에만 계획서를 생성하여 사용자가 마크다운 상대 링크로 확인할 방법이 없음 | 계획서 제안 시 Workspace의 `docs/artifacts/`에 메타데이터를 제외한 복사본 생성을 강제하여 링크 열람 보장 |
| **승인 제어 UI** | 로컬에만 쓰려다 보니 `ArtifactMetadata` 누락 또는 경로 에러로 인해 Proceed 승인 기능이 차단됨 | 두 영역(Brain 및 Workspace) 동시 작성을 규칙화하여 승인 UI와 가독성을 동시 달성 |

## 🔍 변경점 요약 (`.agents/rules/documentation_lifecycle.md`)
```diff
 ### A. 플랫폼 아티팩트 (Gemini Brain 영역 - 사용자 검토 및 승인 제어용)
  * **대상**: 사용자와 소통하고 승인을 받기 위한 계획서(`.plan.md`), 작업 목록(`.task.md`), 결과보고서(`.walkthrough.md`) 등.
  * **경로**: `/Users/ejpark/.gemini/antigravity-cli/brain/<conversation-id>/` (Gemini Brain 디렉토리)
  * **도구 호출**: `write_to_file` 호출 시 `ArtifactMetadata` 필드를 **필수 기재**해야 합니다. (생략 시 일반 텍스트 파일로 처리되어 UI 렌더링 누락)
+ * **중요 (가독성 보장)**: 이 경로에 쓰여진 파일은 사용자가 직접 경로를 찾아 열람하기 매우 어렵습니다. 따라서 **계획서 제안이나 작업 문서 작성 시, B규칙에 맞춰 로컬 프로젝트(Workspace 영역)의 docs/artifacts/ 디렉토리에도 본 문서를 동일하게 복사 생성(Metadata 제외)해야 합니다.**
 
 ### B. 로컬 프로젝트 파일 (Workspace 영역 - 사용자 가독성 및 프로젝트 보존용)
  * **대상**: `src/` 코드, `scripts/` 스크립트, 그리고 프로젝트 저장소 내 보존용 문서(`docs/artifacts/` 하위 파일 등).
  * **경로**: `/Users/ejpark/workspace/scraper/...` (작업 공간 디렉토리)
  * **도구 호출**: `write_to_file` 호출 시 `ArtifactMetadata` 필드를 **반드시 제거(omit)**해야 합니다. (기재 시 경로가 Brain 영역이 아니라는 유효성 검사 에러 발생)
+ * **중요 (가독성 보장)**: 승인을 필요로 하는 아티팩트(예: 계획서)의 경우, 이 경로에 복사본을 함께 써두어야 사용자가 마크다운 상대 링크를 통해 내용을 검토할 수 있습니다.
```
