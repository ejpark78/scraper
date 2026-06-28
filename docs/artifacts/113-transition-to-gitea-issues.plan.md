# 📝 계획서: Gitea 이슈 기반 문서화 수명 주기 전환 (113-transition-to-gitea-issues.plan.md)

이 계획서는 아티팩트 관리 및 승인 프로세스를 Gitea의 이슈(Issues) 관리 시스템으로 완전히 전환하고, 로컬 Git 저장소의 Gitea 원격지 등록 및 에이전트 행동 수칙(AGENTS.md)을 갱신하는 상세 계획을 정의합니다.

---

## 1. 개요 & 목적
* **목적**: 불필요한 로컬 마크다운 아티팩트 파일 생성과 이로 인한 Git 커밋 노이즈 및 토큰 낭비를 차단합니다.
* **해결책**: Gitea API와 `tea` CLI를 활용해 계획 제안 단계에서 Gitea 이슈를 생성하고, 이슈 내 댓글과 라벨 상태(`status/planned`, `status/in-progress`, `status/done`)로 진행 상황을 트래킹합니다.

---

## 2. 세부 작업 설계 및 범위

### Phase 1: 로컬 Git 원격 저장소에 Gitea 등록
* 로컬 Gitea 서버에 `scraper` 저장소를 생성하고, 로컬 Git의 원격지(`gitea`)로 등록합니다.
  ```bash
  # Gitea를 원격지 'gitea'로 추가 등록
  git remote add gitea https://gitea.localhost/gitea-admin/scraper.git
  ```

### Phase 2: 에이전트 행동 규칙 개정
1. **[AGENTS.md](../../AGENTS.md) 제약 사항 개정**:
   * "2. 계획 수립 철저 및 자율 일괄 실행"의 대상 매체를 기존 `.plan.md` 파일 쓰기에서 **"Gitea 이슈 자동 생성 및 이슈 URL 고지"**로 수정합니다.
2. **[.agents/rules/documentation_lifecycle.md](../rules/documentation_lifecycle.md) 규칙 개정**:
   * 로컬 아티팩트 파일 생성 규칙, 3자리 접두사 규칙 및 `squash`, `archive` 정책을 명시적으로 폐지합니다.
   * 대신 Gitea 이슈 생성, 댓글(Comment)을 통한 계획/검증 피드백, 라벨(`status/*`) 기반 칸반 카드 관리 정책을 새롭게 수립합니다.

### Phase 3: 초기 데이터 동기화 및 검증
* 기존에 축적되어 있던 로컬 `docs/artifacts/` 내의 이전 아티팩트 기록들을 Gitea 이슈로 일괄 전송 및 동기화합니다.
  ```bash
  # PMS 동기화 유틸리티를 실행하여 기존 아티팩트들을 Gitea 이슈로 자동 생성 및 마이그레이션
  npx tsx .agents/scripts/sync-pms.ts --reset
  ```

---

## 3. 검증 계획
* Gitea 웹페이지(`https://gitea.localhost`)의 `Issues` 탭 및 `Projects` 칸반 보드에 기존 아티팩트 이력들이 카드로 알맞은 라벨(`status/done`, `status/in-progress` 등)과 함께 자동 분산 정렬되는지 시각적으로 검증합니다.
* `git remote -v` 명령을 통해 Gitea 원격 저장소가 정상 등록되었는지 검증합니다.
