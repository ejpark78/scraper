# Plan: relocate-agents-tooling

에이전트 이력 덤프, 룰 압축, 검증 등 AI 에이전트 인프라 관련 도구들(`apps/crawler/src/tools/agents/`)을 모노레포 구조 상위 모듈인 `apps/agents/`로 완전히 격리 이관하여 독립된 의존성과 관리 경로를 갖추게 하는 계획입니다.

## User Review Required
> [!IMPORTANT]
> - 에이전트 도구들의 물리적 경로가 `apps/crawler/src/tools/agents/`에서 `apps/agents/`로 이관됩니다.
> - `rules.ts` 등 스크립트 내부의 파일 시스템 탐색 경로가 이관된 경로 기준으로 최적화 수정됩니다.

## Proposed Changes

### 1. Relocate Agent Tooling Files
- **`[NEW]`** `apps/agents/` 디렉토리:
  - `agent_adapter.ts`, `rules.ts`, `sessions.ts`, `usage.ts` 파일 이관 수용
- **`[NEW]`** `apps/agents/tsconfig.json`:
  - 독립된 TypeScript 컴파일 및 실행을 보장하기 위한 tsconfig 파일 정의
- **`[DELETE]`** `apps/crawler/src/tools/agents/` 디렉토리:
  - 기존 레거시 경로의 파일 삭제

### 2. Script Paths Restructuring
- **`[MODIFY]`** `apps/agents/rules.ts`:
  - 변경된 상대 경로에 맞게 내부의 rulesDir, transcriptsAgyDir, transcriptsDir 경로 수정 (`../../` 기준)
- **`[MODIFY]`** `scripts/utils/agents.mk`:
  - `dump`, `compress-rules`, `usage` 등의 명령어 타겟 경로를 `apps/agents/...` 로 갱신

---

## Verification Plan

### Manual Verification
- 에이전트 덤프 유효성 검사:
  - `make agents-dump` 실행하여 `rules_compact.txt` 압축 및 트랜스크립트 덤프가 예외 없이 완벽하게 정상 구동하는지 확인합니다.
