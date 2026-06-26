# 089-integrate-lint-lifecycle.plan.md

이 계획서는 정적 분석 도구(Lint, Format, Type-check)를 모노레포 개발 생명주기 및 Git Flow 커밋 프로세스에 공식적으로 통합하는 방안을 기술합니다.

---

## 1. 개요 및 배경
- 이전 3차/4차 리팩토링 및 도구 도입 단계에서 `eslint`, `prettier`, `mypy`, `ruff`를 각 앱(`apps/crawler`, `apps/viewer`, `apps/ebook`) 및 루트 단위에 연동하였습니다.
- 하지만 수동 실행에만 의존할 경우 정적 검증 누락이나 스타일 불일치가 발생할 수 있으므로, 에이전트의 자동 커밋 도구인 `scripts/agents/commit-changes.sh` 및 프로젝트 표준 규칙([AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md))에 이를 의무 단계로 편입합니다.

---

## 2. 세부 구현 계획

### A. 에이전트 커밋 스크립트 수정 (`scripts/agents/commit-changes.sh`)
- `git commit` 실행 전, 루트 레벨의 정적 분석 명령어들을 차례로 구동하여 상태를 검증합니다.
  - `npm run lint` (ESLint & Ruff/Black)
  - `npm run type-check` (TypeScript & Mypy)
- **에러 핸들링**:
  - 검증에 실패할 경우(Exit code != 0), 에러 요약을 상세하게 터미널에 출력하고 커밋 단계를 취소(Exit 1)하여 무결하지 않은 코드가 형상 관리에 반영되는 것을 사전에 방지합니다.

### B. 프로젝트 규칙 문서 갱신 ([AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md))
- 정적 검사 수행 의무화 규칙을 추가합니다.
- 변경 사항을 커밋하거나 PR을 보내기 전 반드시 린터 및 타입 체커가 무오류(Zero-Error) 상태여야 함을 규정합니다.

---

## 3. 구현 대상 및 범위

| 변경 대상 파일 | 설명 | 주요 변경 내용 |
|:---|:---|:---|
| `scripts/agents/commit-changes.sh` | 에이전트 전용 커밋 자동화 스크립트 | 커밋 전 `npm run lint` 및 `npm run type-check` 실행 및 결과 검증 로직 추가 |
| `AGENTS.md` | 프로젝트 공통 에이전트 규칙 | 개발 생명주기에 정적 검증 필수 포함 조항 명문화 |

---

## 4. 자가 검증 및 롤백 시나리오
- **자가 검증**: 
  - 의도적으로 타입 에러나 린트 에러를 유도한 후 `scripts/agents/commit-changes.sh`를 실행해 커밋이 차단되고 상세 에러 로그가 노출되는지 확인합니다.
  - 에러가 없을 때 정상적으로 커밋이 수행되는지 검증합니다.
- **롤백**:
  - 만약 빌드 서버나 로컬 캐시 문제로 전체 검사 속도가 극도로 느려지거나 루프가 발생할 시, `--no-verify` 성격의 옵션을 검토하거나 린트 동작 부분만 주석 처리하여 복구합니다.
