# 081-fix-artifacts-rule-spec.plan.md

이 계획서는 플랫폼 아티팩트의 승인 제어 기능과 사용자의 문서 열람 가독성을 동시에 만족시키기 위해 아티팩트 작성 규칙(동시 복제)을 보완하는 작업을 다룹니다.

## 1. 목적 및 요구사항
* **승인 및 가독성 문제 해결**: 계획서 제안 시 사용자가 직접 마크다운 링크로 접근하여 내용을 검토할 수 있도록 하고, 동시에 플랫폼의 아티팩트 승인 UI(Proceed 버튼 등)가 온전히 기능하도록 두 영역에 동시 작성을 강제합니다.
* **지식 가이드 갱신**: 보완된 내용을 `.agents/rules/documentation_lifecycle.md` 가이드에 정교하게 반영합니다.

## 2. 변경 대상 파일 및 범위

### 수정 파일
* **`.agents/rules/documentation_lifecycle.md`**:
  * "5. 도구 사용 및 경로 구분 규칙"에 플랫폼 아티팩트 생성 시 Workspace 동시 복제 의무 가이드를 추가합니다.

---

## 3. 상세 규칙 내용 설계

### `.agents/rules/documentation_lifecycle.md` 수정안
```markdown
## 5. 🛠️ 도구 사용 및 경로 구분 규칙 (Gemini Brain vs Workspace)

에이전트는 아티팩트와 소스 코드를 생성/수정할 때 경로에 따라 도구 사용 방식을 명확히 구분해야 합니다.

### A. 플랫폼 아티팩트 (Gemini Brain 영역 - 사용자 검토 및 승인 제어용)
* **대상**: 사용자와 소통하고 승인을 받기 위한 계획서(`.plan.md`), 작업 목록(`.task.md`), 결과보고서(`.walkthrough.md`) 등.
* **경로**: `/Users/ejpark/.gemini/antigravity-cli/brain/<conversation-id>/` (Gemini Brain 디렉토리)
* **도구 호출**: `write_to_file` 호출 시 `ArtifactMetadata` 필드를 **필수 기재**해야 합니다. (생략 시 일반 텍스트 파일로 처리되어 UI 렌더링 누락)
* **중요 (가독성 보장)**: 이 경로에 쓰여진 파일은 사용자가 직접 경로를 찾아 열람하기 매우 어렵습니다. 따라서 **계획서 제안이나 작업 문서 작성 시, B규칙에 맞춰 로컬 프로젝트(Workspace 영역)의 docs/artifacts/ 디렉토리에도 본 문서를 동일하게 복사 생성(Metadata 제외)해야 합니다.**

### B. 로컬 프로젝트 파일 (Workspace 영역 - 사용자 가독성 및 프로젝트 보존용)
* **대상**: `src/` 코드, `scripts/` 스크립트, 그리고 프로젝트 저장소 내 보존용 문서(`docs/artifacts/` 하위 파일 등).
* **경로**: `/Users/ejpark/workspace/scraper/...` (작업 공간 디렉토리)
* **도구 호출**: `write_to_file` 호출 시 `ArtifactMetadata` 필드를 **반드시 제거(omit)**해야 합니다. (기재 시 경로가 Brain 영역이 아니라는 유효성 검사 에러 발생)
* **중요 (가독성 보장)**: 승인을 필요로 하는 아티팩트(예: 계획서)의 경우, 이 경로에 복사본을 함께 써두어야 사용자가 마크다운 상대 링크를 통해 내용을 검토할 수 있습니다.
```

---

## 4. 진행 단계 계획

### 1단계: 규칙 파일 보완
* `.agents/rules/documentation_lifecycle.md` 가이드에 규칙 상세 보완 및 수정.

### 2단계: 사후 문서화 및 검증
* `081-fix-artifacts-rule-spec.task.md`, `081-fix-artifacts-rule-spec.review.md` 작성.
* 최종 결과보고서 `081-fix-artifacts-rule-spec.walkthrough.md` 작성.
* (각 아티팩트는 Brain과 Workspace 경로에 동시 생성합니다.)
* `INDEX.md` 인덱싱 반영.
* 자동 커밋 스크립트 실행으로 작업 마무리.
