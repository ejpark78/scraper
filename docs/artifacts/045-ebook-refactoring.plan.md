# 045-ebook-refactoring.plan.md

이 문서는 `apps/ebook` 모듈의 복잡한 커맨드 패턴 구조를 단순화하고 사용하지 않는 번역 기능을 제거하기 위한 리팩토링 계획을 설명합니다.

---

## 🎯 목표 및 배경
- **구조 단순화**: 지나치게 복잡한 OOP Command 패턴을 걷어내고, CLI 진입점인 `main.py` 파일 하나로 정리합니다.
- **네이밍 개선**: 모호한 `process.py` 대신 명확한 CLI 진입점 역할을 나타내는 `main.py`로 변경합니다.
- **미사용 기능 삭제**: 유지보수 비용을 줄이기 위해 현재 사용하지 않는 PDF/Markdown 번역(`translator`, `translate_batch`) 로직 및 관련 태스크를 모두 제거합니다.

---

## 🛠️ 작업 목록 (Work Items)

### 1. 신규 파일 생성 및 병합 (`apps/ebook/src/main.py`)
- `process.py`를 `main.py`로 이름을 변경하고, `commands.py`에 나누어져 있던 핵심 실행 로직들을 단순 함수 형태로 병합합니다.
  - `run_summary(out_path: str)`
  - `run_analyze(target: str | None, raw_dir: str, out_dir: str, overwrite: bool)`
  - `run_to_html(out_path: str)`
  - `run_to_md(out_path: str)`
  - `run_split(raw_dir: str, out_dir: str)`
- `argparse` 파서를 구성하고 각 플래그 분기에 맞춰 단순 조건문으로 처리합니다.

### 2. 기존 파일 삭제
- `apps/ebook/src/commands.py` (로직이 `main.py`로 병합됨)
- `apps/ebook/src/translator.py` (미사용 번역 로직)
- `apps/ebook/src/translate_batch.py` (미사용 번역 스크립트)

### 3. 프로젝트 설정 및 Makefile 업데이트
- `apps/ebook/pyproject.toml`
  - `poe.tasks`에서 `translate_md` 및 `translate_batch` 제거.
  - 나머지 작업들의 실행 타겟을 `python -m src.process`에서 `python -m src.main`으로 업데이트.
- `apps/ebook/Makefile`
  - `translate_md` 및 `translate_batch` 관련 타겟들 제거.

---

## 📋 세부 수정 계획 표

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/ebook/src/process.py` | **Rename & Rewrite** | `main.py`로 변경 및 로직 통합 |
| `apps/ebook/src/commands.py` | **Delete** | `main.py` 병합에 따른 파일 삭제 |
| `apps/ebook/src/translator.py` | **Delete** | 번역 파일 삭제 |
| `apps/ebook/src/translate_batch.py` | **Delete** | 번역 배치 스크립트 삭제 |
| `apps/ebook/pyproject.toml` | **Modify** | 태스크 변경 및 진입 모듈 업데이트 |
| `apps/ebook/Makefile` | **Modify** | 번역 타겟 제거 |

---

## 🧪 검증 시나리오
모든 변경을 완료한 후, Docker 환경을 통해 다음 작업을 검증합니다.
1. `make summary` 정상 동작 여부 확인
2. `make analyze` 정상 동작 여부 확인
3. `make split` 정상 동작 여부 확인
4. `make to-html` 정상 동작 여부 확인
5. `make to-md` 정상 동작 여부 확인
