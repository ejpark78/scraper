# 066-split-git-flow-rules.plan.md

본 계획서는 기존 [AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md)의 Git Flow 전략, 기술 스택별 코딩 규칙, Docker 네트워크 인프라 규칙, 문서화 수명 주기 규칙을 하이브리드 방식으로 대대적으로 쪼개어 가독성을 극대화하고 에이전트의 컨텍스트 토큰을 최적화하기 위해 작성되었습니다.

---

## 🎯 목표 (Objective)
- `AGENTS.md` 내에 기재된 텍스트 중 구체적인 가이드 및 명세 성격의 내용을 별도의 전용 가이드 파일들로 분리합니다.
- `AGENTS.md`에는 에이전트가 단 1초도 망각해서는 안 되는 **핵심 행동 제약 조건(Constraints)**과 **보안 규칙**만 컴팩트하게 남기고, 상세한 세부 매뉴얼은 링크 참조 방식으로 연동합니다.

---

## 🗺️ 변경 대상 파일 및 브랜치
- **대상 브랜치 (`Target Branch`)**: `develop`
- **변경 대상 파일**:
  - [AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md) (수정)
  - `docs/guides/git-flow.md` (신규 생성)
  - `docs/guides/tech-stack.md` (신규 생성)
  - `docs/guides/docker-environment.md` (신규 생성)
  - `docs/guides/documentation-lifecycle.md` (신규 생성)

---

## 📋 분리 및 병합 설계 방안

### 1. 보안 규칙 유지 (Security Rules)
- `.env` 접근 금지 및 API 키/자격 증명 노출 금지와 같은 보안 규칙은 망각 시 위험성이 크므로 **`AGENTS.md` 본문에 명시적으로 유지**합니다.

### 2. 상세 가이드 문서 분리
- **`docs/guides/git-flow.md`**: 상세 브랜치 정의, Conventional Commits 규격, 머지 충돌 시 대처, 브랜치 최신화 및 전환 절차.
- **`docs/guides/tech-stack.md`**: Python(PEP 8, Type Hinting, `uv`), TypeScript & Vue 3(setup, Composition API, Eslint/Prettier).
- **`docs/guides/docker-environment.md`**: Docker Compose 볼륨 마운트 검증, Traefik 리버스 프록시 노출 정책, Netshoot을 이용한 네트워크 진단 방법.
- **`docs/guides/documentation-lifecycle.md`**: Spec -> Plan -> Review -> Walkthrough 수명 주기 가이드, 아티팩트 명명 규칙 및 등급별 문서화 의무 표, Squash/Archive 정책.

### 3. `AGENTS.md` 본문 경량화
- 기존의 복잡한 가이드라인을 한 줄 요약 형태의 핵심 제약 요약과 문서 링크로 대체하여 본문 길이를 대폭 압축합니다.

---

## 🛠️ 작업 목록 (Tasks)
1. **가이드 문서 4종 생성**:
   - `docs/guides/git-flow.md`
   - `docs/guides/tech-stack.md`
   - `docs/guides/docker-environment.md`
   - `docs/guides/documentation-lifecycle.md`
2. **[AGENTS.md](file:///Users/ejpark/workspace/scraper/AGENTS.md) 본문 수정**:
   - 코딩 룰, 도커 상세, 문서화 상세 및 Git Flow 상세를 경량 제약+링크로 구조화합니다.
3. **검증 및 커밋**:
   - `scripts/agents/commit-changes.sh`를 실행하여 커밋을 생성합니다.

---

## 🗓️ 후속 문서 수명 주기 계획
계획 승인 이후 다음 아티팩트를 자율적으로 작성하되, 최종 검토 프로세스를 준수합니다:
- `066-split-git-flow-rules.task.md` (할 일 목록)
- `066-split-git-flow-rules.review.md` (수정 계획 검토서)
- `066-split-git-flow-rules.walkthrough.md` (완료 결과보고서)

**[CRITICAL] 리뷰 및 승인 루프**:
- 후속 문서 작성 후 반드시 사용자에게 리뷰를 요청하고 최종 승인을 받아야 합니다.
- 승인을 받지 못할 경우, 피드백을 바탕으로 보완 단계로 되돌아갑니다.
