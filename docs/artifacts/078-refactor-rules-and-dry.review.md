# 078-refactor-rules-and-dry.review.md

이 검토서는 `AGENTS.md`의 크기를 축소하고 규칙 파일을 효율적으로 계층화하기 전과 후를 검토합니다.

## 🛠️ 변경 대비표

| 항목 | 변경 전 | 변경 후 (적용 내용) |
| :--- | :--- | :--- |
| **`AGENTS.md` 규칙 크기** | 약 75줄 (엔지니어링 세부 가이드 포함) | 약 65줄 (세부 룰은 전용 파일로 링크 참조 대체) |
| **DRY 규칙 수준** | 명시적인 코딩 규칙 정의 없음 (에이전트 역할 설명에 단어만 포함됨) | `.agents/rules/engineering_architecture.md`에 공식 규칙 추가 및 4가지 수칙 명시 |
| **규칙 파일 관리** | 루트에 규칙 및 제약이 집중됨 | 기술 규칙은 `.agents/rules/` 폴더 아래로 이관 및 격리 |
| **자동 커밋** | `AGENTS.md`만 감지하여 커밋 메시지 변경 | `AGENTS.md` 및 `.agents/rules/*`가 변경되면 자동 메시지 지정 |

## 🔍 변경점 주요 요약

### 1. `AGENTS.md`
```diff
- ## ⚙️ 엔지니어링 및 아키텍처 규칙 (Engineering & Architecture Rules)
- 
- 1. **Strict OOP Patterns**: 클래스, 인터페이스, SOLID 원칙을 사용합니다...
- ...
+ ## ⚙️ 엔지니어링 및 아키텍처 규칙 (Engineering & Architecture Rules)
+ * **공통 규칙 및 DRY 원칙 준수**: 모든 개발 및 리팩터링 작업 시 strict typing, OOP 설계, 에러 처리, 그리고 **DRY(Don't Repeat Yourself) 규칙**을 상시 준수해야 합니다. 구체적인 설계 요구사항은 [Engineering & Architecture Guide](.agents/rules/engineering_architecture.md) 규칙 파일을 반드시 상시 로드하여 이행하세요.
```

### 2. `scripts/agents/commit-changes.sh`
```diff
-    if echo "$STAGED_FILES" | grep -q "AGENTS.md"; then
-      MSG="docs: update AGENTS.md rules"
+    if echo "$STAGED_FILES" | grep -qE "AGENTS.md|\.agents/rules/"; then
+      MSG="docs: update agent rules"
```
