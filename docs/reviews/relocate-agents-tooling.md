# Code Review: relocate-agents-tooling (Bugfix)

본 리뷰는 `docs/plans/relocate-agents-tooling.md` 계획서에 따라 진행되었으며, 에이전트 인프라 도구들을 `apps/agents/`로 완전히 격리 이관한 작업 내역 및 이에 따른 TypeScript 컴파일 에러 해결(Bugfix) 상태를 검증합니다.

---

## 1. Safety & Infrastructure Checks
- [x] **No Host Port Access**: 변경된 내용은 로컬 진단 및 덤프 쉘 실행에 국한되며 포트 맵이나 호스트 노출과 무관합니다.
- [x] **Docker Network Usage**: 컨테이너의 가동 방식에 전혀 영향을 주지 않습니다.
- [x] **Connection Leak Prevention**: DB 커넥션 등의 변경 사항이 아니므로 누수 위험이 없습니다.
- [x] **Credentials Safe**: `.env` 또는 보안 자격 증명이 노출되지 않았습니다.

---

## 2. Engineering & Architecture Checks
- [x] **Strict Typing**: 독립적인 `tsconfig.json`을 제공하여 모듈 컴파일 무결성을 보장하며, 타입 에러(TSError)가 해결됨을 검증했습니다.
- [x] **Centralized Config**: 프로젝트 최상위 기준의 상대 경로가 2레벨 상위(`../../`)로 단순화되어 에이전트 관리의 결합도가 낮아졌습니다.

---

## 3. 검증 내역 (Verification Details & Bugfixes)
- **`[Bugfix]` Node Types 및 글로벌 개체 참조 해결**:
  - `sessions.ts`와 `rules.ts` 에서 `__dirname`, `console`, `process` 등의 글로벌 예약어가 타입 체크를 통과하지 못해 빌드가 깨지던 현상을 해결하기 위해, `tsconfig.json`에 `"types": ["node"]`를 명시하고 `agents.mk` 내 `ts-node` 실행 옵션에 `--project apps/agents/tsconfig.json`을 강제 주입하여 안정적으로 컴파일되도록 교정 완료했습니다.
- **`apps/agents/rules.ts` & `sessions.ts`**:
  - `path.join(__dirname, '../../...')`와 같이 이관에 맞는 올바른 상대 경로로 갱신되었습니다.
- **`scripts/utils/agents.mk`**:
  - 타겟 경로가 `apps/crawler/...`에서 `apps/agents/...`로 일괄 교정되었습니다.

---

## 4. 종합 의견 (Conclusion)
* 크롤러 소스(`apps/crawler/`) 내부에 종속되어 있던 에이전트 CLI 도구들을 모노레포 상위 루트의 `apps/agents/`로 분리하여 모듈 간 높은 응집도와 낮은 결합도를 실현했습니다.
* 특히 이관 후 발생한 ts-node 글로벌 컴파일 오류가 tsconfig 로드 옵션을 통해 완전히 정형화 및 교정(Bugfix)되었습니다.
