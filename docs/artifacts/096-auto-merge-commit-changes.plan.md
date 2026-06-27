# 계획서: commit-changes.sh 내 자동 머지(--merge) 기능 도입 (096-auto-merge-commit-changes.plan.md)

## 1. 목적 및 배경
에이전트가 기능 개발 또는 버그 수정을 마치면 최종 커밋을 올리고 기준 브랜치(`develop`)로 복귀하여 머지(merge)해야 하는 룰이 있습니다. 매번 이를 수동 쉘 명령어로 승인받아 진행하는 비효율을 제거하기 위해, 기존의 사전 승인 스크립트인 `commit-changes.sh`에 `--merge` 옵션을 내장합니다. 이 옵션을 켜면 커밋 직후 안전하게 `develop` 브랜치로 전환 및 머지까지 수행하여 작업 파이프라인을 자동화합니다.

## 2. 관련 파일 및 변경 부분
- **[commit-changes.sh](../../scripts/agents/commit-changes.sh)**:
  - 스크립트 실행 인자 파싱 로직 추가 (최상단 혹은 최하단)
  - `--merge` 옵션 감지 시, `git commit` 완료 후 `develop` 브랜치로 `checkout` 하고, 기존 작업 중이던 피처 브랜치를 `git merge` 하는 자동화 로직 결합
  - 머지 도중 발생할 수 있는 충돌 예외 처리
- **[AGENTS.md](../../AGENTS.md)**:
  - 규칙 17번의 머지 절차 가이드라인에 `commit-changes.sh --merge` 옵션 사용 권장 사항 명시

## 3. 실행 단계 및 명령어 목록
1. **코드 수정**:
   - `scripts/agents/commit-changes.sh` 수정
   - `AGENTS.md` 보완
2. **검증 및 자동 머지**:
   - 수정한 스크립트를 사용하여 현재 브랜치의 변경 사항을 직접 커밋하고 `develop` 브랜치로 복귀하여 머지를 검증합니다.
     - 명령어 (사전 승인 스크립트): `scripts/agents/commit-changes.sh --merge`
