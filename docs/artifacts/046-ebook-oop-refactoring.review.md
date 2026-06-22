# 046-ebook-oop-refactoring.review.md

이 문서는 `apps/ebook` OOP 리팩토링 및 데드 코드 정리 변경 건에 대한 사전 설계 리뷰를 진행합니다.

---

## 🔍 변경 개요
- **대상**: `apps/ebook`
- **구분**: Major (아키텍처 개선 및 데드 코드 대폭 정리)
- **작성일**: 2026-06-22

---

## 🏗️ 아키텍처 및 설계 분석

### 1. 데드 코드 분석 및 의존성 관계
- `pdf_parser.py`는 PDF 마크다운 변환 핵심 모듈처럼 보이지만, 현재 프로젝트의 실제 파이프라인(`main.py` -> `HTMLConverter` + `HTMLToMarkdownConverter`)에서는 사용되고 있지 않습니다.
- 따라서 `pdf_parser.py`와 이를 검증하고 있던 `test_column_detector.py`, `test_text_cleaner.py`를 영구 제거하여 불필요한 코드 및 테스트 유지보수 포인트를 삭제합니다.
- 단일 변수 `EXCLUDE_TITLES`를 갖는 `constants.py`를 삭제하고, 해당 변수를 단독 사용하는 `analyzer.py`에 이관하여 결합도를 낮추고 모듈 구조를 단순화합니다.

### 2. OOP 리팩토링 설계 (`main.py`)
- **이전 구조 (Procedural/Functional)**:
  - `main.py`는 전역 함수 수준에서 CLI의 모든 서브 동작을 분리하고 매칭하는 단순 매핑 구조였습니다.
- **개선 구조 (OOP)**:
  - **`EbookPipeline`**: 책의 입출력 경로(`raw_dir`, `out_dir`)와 PDFAnalyzer, HTMLConverter 등 파이프라인의 실질적인 하위 모듈 결합을 관리하고 실행하는 도메인 서비스 클래스입니다.
  - **`EbookCLI`**: 사용자 CLI 매개변수의 등록, 검증, 파이싱을 캡슐화하고 실행의 중계를 지휘하는 CLI 드라이버 클래스입니다.
  - 이를 통해 각 모듈의 단일 책임 원칙(SRP)과 응집도를 크게 개선합니다.
