# 046-ebook-oop-refactoring.plan.md

이 문서는 `apps/ebook` 모듈의 데드 코드를 정리하고, `main.py` 진입점을 객체 지향 프로그래밍(OOP) 규칙에 맞춰 깔끔하게 리팩토링하는 계획을 다룹니다.

---

## 🎯 목표 및 배경
- **데드 코드 제거**: 현재 파이프라인에서 사용되지 않는 `pdf_parser.py` 및 관련 테스트 코드와 단일 상수를 담던 `constants.py`를 제거하여 코드베이스를 슬림하게 유지합니다.
- **상수 재배치**: `EXCLUDE_TITLES` 상수를 실제 사용하는 유일한 모듈인 `analyzer.py` 내부로 이동합니다.
- **OOP 리팩토링**: `main.py`에 선언된 절차식 전역 함수들을 역할과 책임에 따라 `EbookCLI`와 `EbookPipeline` 클래스로 구조화하여 캡슐화 및 단일 책임 원칙(SRP)을 준수합니다.

---

## 🛠️ 작업 목록 (Work Items)

### 1. 데드 코드 및 불필요한 파일 삭제
- `apps/ebook/src/pdf_parser.py` (미사용 파일)
- `apps/ebook/src/constants.py` (상수 단일 파일 삭제)
- `apps/ebook/tests/test_column_detector.py` (`pdf_parser` 관련 테스트 삭제)
- `apps/ebook/tests/test_text_cleaner.py` (`pdf_parser` 관련 테스트 삭제)

### 2. `analyzer.py` 내부 상수 이동
- `EXCLUDE_TITLES` 상수를 `analyzer.py`에 내장 정의하고 `constants` 임포트 제거.

### 3. `main.py` OOP 리팩토링
- **`EbookPipeline` 클래스**:
  - `raw_dir`, `out_dir` 인스턴스 변수 관리.
  - `summary()`, `analyze()`, `to_html()`, `to_md()`, `split()` 등 비즈니스 로직 메서드로 캡슐화.
- **`EbookCLI` 클래스**:
  - `argparse` 파서 생성 및 아규먼트 정의.
  - 실행 분기 관리 (`run()` 메서드).

---

## 📋 세부 수정 계획 표

| File Path | Action | Details |
| :--- | :--- | :--- |
| `apps/ebook/src/constants.py` | **Delete** | 미사용 파일 삭제 |
| `apps/ebook/src/pdf_parser.py` | **Delete** | 미사용 파일 삭제 |
| `apps/ebook/tests/test_column_detector.py` | **Delete** | `pdf_parser` 의존 테스트 삭제 |
| `apps/ebook/tests/test_text_cleaner.py` | **Delete** | `pdf_parser` 의존 테스트 삭제 |
| `apps/ebook/src/analyzer.py` | **Modify** | `EXCLUDE_TITLES` 상수 이동 및 내장 |
| `apps/ebook/src/main.py` | **Rewrite (OOP)** | `EbookPipeline` 및 `EbookCLI` 클래스 설계 |

---

## 🧪 검증 시나리오
변경 후 `make test`를 통해 남은 단위 테스트들이 문제없이 실행되는지 확인합니다.
