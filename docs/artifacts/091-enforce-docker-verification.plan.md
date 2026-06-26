# 091-enforce-docker-verification.plan.md

이 계획서는 개발/검증 프로세스에서 Docker 및 `uv` 격리 환경 제약을 우회하고 호스트에서 임의로 경로를 수정하여 구조가 파괴되는 문제를 방지하기 위해 `AGENTS.md` 규칙을 보강하고, 훼손된 임포트 환경을 복구하는 것을 목표로 합니다.

## 1. 🔍 보강할 규칙 항목
- **정적 검증 도구(eslint, type-check, uv)의 Docker 격리 적용**:
  - `npm run lint`, `npm run type-check` 등은 호스트 환경에서의 패키지 구조 불일치로 인한 오작동을 피하기 위해 반드시 Docker 컨테이너 내부 환경 기준으로 실행하거나, 모노레포의 규격에 맞는 환경 하에서 실행해야 합니다.
  - 호스트 단독 검증 과정에서 임포트 경로가 어긋난다고 해서 모노레포 패키지 격리를 우회하는 상대 경로(`../../packages/...`) 수정을 일절 금지합니다.
- **`uv` 가상환경 및 `uv run` 규칙 추가**:
  - Python 애플리케이션(`apps/ebook`) 등은 호스트의 전역 Python을 사용하지 않고 반드시 `uv run` 또는 `docker compose` 내부 가상환경을 경유하여 격리된 채로 실행 및 진단해야 합니다.

## 2. 🛠️ 작업 순서
1. **`AGENTS.md` 수정**: Docker 격리 및 `uv run` 관련 명문화된 규칙 보강.
2. **훼손된 임포트 경로 복구**: 잘못 수정된 임포트 경로 롤백 및 `tsconfig.json` paths 분석 검토.
3. **통합 검증**: `npm run lint` 및 `npm run type-check` 수행.

## 🏁 검증 계획
- `AGENTS.md` 변경 사항 확인 및 적용.
- `npm run type-check` 통과 확인.
