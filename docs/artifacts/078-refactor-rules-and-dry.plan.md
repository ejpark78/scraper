# 078-refactor-rules-and-dry.plan.md

이 계획서는 `AGENTS.md` 파일에 정의된 엔지니어링 및 아키텍처 규칙을 신규 규칙 파일로 분리하고, DRY(Don't Repeat Yourself) 규칙을 명문화하여 추가하는 작업을 다룹니다.

## 1. 목적 및 요구사항
* **규칙 분리**: `AGENTS.md` 파일의 크기를 줄이고 관리 효율성을 높이기 위해 '⚙️ 엔지니어링 및 아키텍처 규칙'을 별도 마크다운 규칙 파일로 분리합니다.
* **DRY 규칙 보완**: 분리된 규칙 파일에 소프트웨어 설계 핵심 원칙인 DRY(Don't Repeat Yourself) 원칙과 구체적인 준수 기준을 명문화하여 추가합니다.
* **에이전트 인지력 유지**: 루트 레벨의 `AGENTS.md`에서 분리된 규칙 파일을 명확하게 참조하도록 가이드를 구성하여 에이전트가 이를 상시 준수하도록 합니다.

## 2. 변경 대상 파일 및 범위

### 신규 생성 파일
* **`.agents/rules/engineering_architecture.md`**:
  * 기존 `AGENTS.md` 내의 '⚙️ 엔지니어링 및 아키텍처 규칙' 내용을 이관합니다.
  * 신규 규칙 항목으로 **DRY (Don't Repeat Yourself) 규칙**을 추가합니다.

### 수정 파일
* **`AGENTS.md`**:
  * 기존의 긴 규칙 세부 텍스트를 제거하고, 새로 분리된 `.agents/rules/engineering_architecture.md`로의 상대 경로 링크 및 한 줄 요약 지침을 제공합니다.
* **`scripts/agents/commit-changes.sh`**:
  * `.agents/rules/` 하위의 파일이 수정되었을 때도 커밋 메시지를 적절하게 자동 지정할 수 있도록 감지 패턴을 보완합니다.

---

## 3. 상세 규칙 내용 설계

### `.agents/rules/engineering_architecture.md`
```markdown
# ⚙️ 엔지니어링 및 아키텍처 규칙 (Engineering & Architecture Rules)

이 문서는 프로젝트 내의 모든 코드 구현 및 설계 시 준수해야 하는 공통 아키텍처 규칙을 정의합니다.

## 1. DRY (Don't Repeat Yourself) 규칙
* **단일 원천 정보 (Single Source of Truth)**: 시스템 내의 모든 비즈니스 로직, 데이터 형태, 환경 설정 등의 '지식'은 오직 한 곳에만 존재해야 합니다.
* **로직 중복 금지**: 2회 이상 반복되거나 재사용될 가능성이 높은 공통 기능은 독립된 함수, 클래스, 혹은 공통 모듈로 분리 및 추상화하여 사용합니다.
* **설정 및 환경의 하드코딩 금지**: 포트, 호스트, 비밀번호 등은 절대 코드 내에 중복 기재하지 않고 전용 설정 관리 모듈을 통해 주입받습니다.
* **우연한 일치의 경계**: 모양은 같으나 목적과 비즈니스 맥락이 완전히 다른 코드를 무리하게 공통화하여 결합도를 높이지 않도록 주의합니다.

## 2. 기존 아키텍처 규칙 이관
* **Strict OOP Patterns**: 클래스, 인터페이스, SOLID 원칙을 사용합니다. 핵심 로직에 느슨한 유틸리티 함수 사용을 지양합니다.
* **Strict Typing**: 'any' 타입 사용을 금지합니다. public 메서드에 명시적 반환 타입과 인터페이스를 선언합니다.
* **Robust Error Handling**: 빈 catch 블록을 사용하지 마세요. 항상 에러 컨텍스트를 로깅하고 finally 블록에서 DB/Redis 연결을 종료합니다.
* **Centralized Config**: 'process.env'는 전용 설정 파일에서만 접근합니다. 생성자를 통해 설정을 주입합니다.
* **Agent-Friendly Docstrings**: 모든 소스, 스크립트, 자동화 파일에 설계 컨텍스트, 제약 조건, 의존성을 설명하는 헤더 docstring/주석을 추가하여 리팩터링 루프를 방지합니다. 동작 변경 시 업데이트합니다.
* **No Superficial Patches**: 오류 발생 시 표면적 패치(예: 커스텀 regex 제외나 하드코딩 파라미터로 증상 숨기기)를 절대 구현하지 마세요. 항상 데이터 흐름을 추적하고, DB/상태 조정을 조사하여 진정한 근본 원인을 찾아 견고한 구조적/아키텍처 솔루션을 구현하세요. 또한 버그가 수정(Bugfix)되었을 때에는 단순 변경사항과 엄격히 구분하여 CHANGELOG와 코드 리뷰 문서에 'Bugfix'임을 명확히 표기하고 기록해야 합니다.
```

---

## 4. 진행 단계 계획

### 1단계: 신규 규칙 파일 생성
* `.agents/rules/engineering_architecture.md` 생성 및 상세 규칙 내용 기술.

### 2단계: `AGENTS.md` 경량화 수정
* 기존 '⚙️ 엔지니어링 및 아키텍처 규칙' 섹션을 신규 파일에 대한 마크다운 링크와 필수 확인 가이드로 대체.

### 3단계: `commit-changes.sh` 스크립트 보완
* 규칙 파일(`.agents/rules/*`) 수정이 포함된 경우의 커밋 메시지 처리 추가.

### 4단계: 사후 문서화 및 검증
* `078-refactor-rules-and-dry.review.md`, `078-refactor-rules-and-dry.task.md` 작성.
* 변경 사항 최종 검증 및 자동 커밋 스크립트 실행.
* 최종 결과보고서 `078-refactor-rules-and-dry.walkthrough.md` 작성.
