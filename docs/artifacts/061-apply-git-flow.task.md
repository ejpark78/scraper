# 📋 할 일 목록 (061-apply-git-flow.task.md)

## 📌 개요
- **목적**: `AGENTS.md`에 Git Flow 브랜치 및 행동 규칙을 적용하고, 100줄 제한을 완화하며, 자동 커밋 스크립트(`commit-changes.sh`)가 브랜치명을 기반으로 메시지를 자동 생성하도록 구현합니다.
- **등급**: **Major** (규칙 개정 및 코어 스크립트 개선)

---

## 🛠️ 작업 목록

### 1단계: 규격 개정 및 문서 수정
- [x] `AGENTS.md` 수정
  - `2. AGENTS.md 유지보수` 규칙에서 100줄 제한 문구 제거
  - `⚠️ 주요 제약 사항`에 Git Flow 브랜치 전략 및 에이전트 체크아웃/머지 행동 규칙 명시
- [x] `scripts/agents/commit-changes.sh` 수정
  - 현재 브랜치명 추출 로직 추가
  - `feature/###-name` 또는 `hotfix/###-name` 매칭 시 `feat(###): name` / `fix(###): name` 형식으로 커밋 메시지 자동 빌드되도록 보완

### 2단계: 검증 및 동기화
- [x] 자동 커밋 및 검증: 변경사항 저장 후 `scripts/agents/commit-changes.sh`를 실행하여 개선된 로직이 실제 커밋 메시지를 적절하게 자동 빌드하는지 확인
- [x] `CHANGELOG.md` 갱신

### 3단계: 보고서 작성
- [x] 코드 리뷰 문서 (`061-apply-git-flow.review.md`) 작성
- [x] 결과보고서 (`061-apply-git-flow.walkthrough.md`) 작성
- [x] `INDEX.md` 및 마일리 갱신 확인 (squash 시 자동 갱신됨)
