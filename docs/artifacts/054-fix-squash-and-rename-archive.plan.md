# 📋 계획서: 아티팩트 Squash 및 Archive 기능 개선 계획 (054-fix-squash-and-rename-archive.plan.md)

## 1. 🔍 문제 정의 및 분석
- **현상**:
  - `make agents-squash` 실행 시, 아티팩트(triplet) 압축만 진행되고 10개 단위로 합치는 아카이빙 기능이 동작하지 않음.
  - 아카이빙 결과 파일의 확장자 형태가 레거시 `*.batch.md`로 설정되어 있음.
- **원인**:
  - `scripts/agents/agents.mk` 내 `squash` 타겟이 `squash-artifacts.sh`를 옵션 없이 실행하여, 10개 단위 묶음 처리 조건인 `--batch` 분기에 도달하지 못함.
  - 스크립트 내부 하드코딩된 파일명이 `*.batch.md`로 되어 있음.

---

## 🛠️ 해결 방안
1. **아카이빙 파일 확장자 교체**:
   - `*.batch.md` ➡️ `*.archive.md` 로 전면 변경.
   - 관련 변수명 및 로그 메시지도 `batch` ➡️ `archive`로 정렬.
2. **`make agents-squash` 기본 동작으로 통합**:
   - `squash-artifacts.sh` 스크립트가 매개변수 없이 실행되더라도, **(1) Triplet Squash**와 **(2) 10개 단위 Decade Grouping Archive** 작업을 연쇄적으로 자동 실행하도록 스크립트 구조 개선.
   - 사용자가 `make agents-squash` 단일 명령만 수행해도 두 단계가 모두 완벽히 적용되도록 처리.
3. **관련 문서 및 파일 경로 일괄 수정**:
   - `INDEX.md`의 기존 `001-010.batch.md` 등의 파일명을 `001-010.archive.md` 등으로 갱신.
   - 실제 존재하는 기존 `*.batch.md` 파일들이 있다면 이를 `*.archive.md`로 수동 파일명 변환 처리.

---

## 📂 수정 대상 파일 목록
1. [squash-artifacts.sh](file:///home/ejpark/workspace/scraper/scripts/agents/squash-artifacts.sh) (스크립트 로직 통합 및 이름 변경)
2. [INDEX.md](file:///home/ejpark/workspace/scraper/docs/artifacts/INDEX.md) (인덱스 내 파일명 변경)
3. [AGENTS.md](file:///home/ejpark/workspace/scraper/AGENTS.md) (규칙 내 배치 명칭 수정)

---

## 🧪 검증 계획
1. `squash-artifacts.sh`를 임의 아티팩트 구조에서 단독 실행하여 `.summary.md` 생성 및 `*.archive.md` 아카이빙이 정상 작동하는지 확인.
2. `make agents-squash` 타겟이 잘 연결되어 정상 구동되는지 테스트.
3. 타입 검사 및 린트 검증 진행.
