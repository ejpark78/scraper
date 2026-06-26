# 089-integrate-lint-lifecycle.review.md

## 🔍 변경 대조 검토서 (Review Document)

### 1. `AGENTS.md` 변경 계획
- **기존**: Git Flow 브랜치 전략 및 에이전트 행동 지침(16번)까지만 정의됨.
- **변경**: 정적 검증 강제 조항(17번) 신설.
  > 17. **개발 생명주기 내 정적 검증 강제**: 소스 코드를 커밋하거나 원격 저장소에 반영하기 전, 에이전트와 개발자는 반드시 정적 스타일 검증(`npm run lint`) 및 정적 타입 검증(`npm run type-check`)을 성공해야 합니다. 검사 에러가 존재하는 상태에서의 강제 커밋은 금지됩니다.

### 2. `scripts/agents/commit-changes.sh` 변경 계획
- **기존**: 바로 변경 감지 후 `git add .` 및 `git commit` 수행.
- **변경**: `git commit` 이전 단계에서 다음 검증 명령어 실행 및 실패 시 에러 출력 후 중단.
  ```bash
  # 정적 린트 및 스타일 분석 수행
  echo "🔍 Running linter checks (npm run lint)..."
  if ! npm run lint; then
    echo "❌ ERROR: Lint validation failed. Please resolve lint issues before committing." >&2
    exit 1
  fi

  # 정적 타입 검증 수행
  echo "🔍 Running static type checks (npm run type-check)..."
  if ! npm run type-check; then
    echo "❌ ERROR: Static type check failed. Please resolve compilation/type issues before committing." >&2
    exit 1
  fi
  ```
