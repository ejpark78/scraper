# 📋 할 일 목록 (054-fix-squash-and-rename-archive.task.md)

## 📌 개요
- **목적**: `make agents-squash` 시 10개 단위 아카이빙이 누락되는 문제를 기본 동작으로 통합하고, 아카이브 파일의 명칭을 `*.batch.md`에서 `*.archive.md`로 일괄 변경.
- **등급**: **Major**

---

## 🛠️ 작업 목록

### 1단계: 기존 파일 리네임 및 룰 수정
- [x] 기존 `docs/artifacts/` 디렉터리에 존재하는 `.batch.md` 파일들을 `.archive.md`로 이름 변경 (mv 명령어 실행 승인 필요).
- [x] [AGENTS.md](file:///home/ejpark/workspace/scraper/AGENTS.md) 내의 배치(`.batch.md`) 관련 규칙 명칭을 아카이브(`.archive.md`)로 변경.

### 2단계: 스크립트 코드 수정
- [x] `scripts/agents/squash-artifacts.sh`를 수정하여:
  - 파일 매개변수 없을 시 triplet squash 수행 후 이어서 decade grouping archive를 연쇄 수행하도록 로직 재구성.
  - `--batch` ➡️ `--archive` 옵션명 변경 및 내부의 `*.batch.md` ➡️ `*.archive.md` 일괄 치환.

### 3단계: 문서화 및 검증
- [x] `CHANGELOG.md` 갱신.
- [x] `.review.md` 및 `.walkthrough.md` 작성.
- [x] `scripts/agents/commit-changes.sh` 실행 및 완료 보고.
