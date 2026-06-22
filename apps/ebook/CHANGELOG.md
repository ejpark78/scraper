# Changelog (Ebook Pipeline)

All notable changes to the `apps/ebook` service will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to Semantic Versioning.

---

## [1.6.0] - 2026-06-22

### Changed
- **main.py OOP 리팩토링**: 절차식으로 흩어져 있던 함수들을 단일 책임 원칙(SRP)에 맞춰 `EbookPipeline`(핵심 변환 비즈니스 로직) 및 `EbookCLI`(사용자 매개변수 파싱 및 명령 라우팅) 클래스로 재구성 및 캡슐화 완료.
- **process.py -> main.py 네이밍 변경**: 모듈 내 명확한 CLI 진입점 역할을 드러내기 위해 파일명을 변경하고 `pyproject.toml` 및 `Makefile` 내 모듈 진입점 경로를 `src.main`으로 갱신.
- **상수 이식**: `constants.py`가 제거됨에 따라, 유일하게 해당 상수를 참조하고 있던 `analyzer.py` 내부에 `EXCLUDE_TITLES` 상수를 로컬로 내장 정의.

### Removed
- **미사용 번역 기능 제거**: 현재 사용하지 않는 PDF/Markdown 번역 기능인 `translator.py`, `translate_batch.py` 파일을 제거하고 `Makefile` 및 `pyproject.toml`에서 번역 관련 명령어(`translate_md`, `translate_batch`)를 삭제.
- **데드 코드 정리**: 파이프라인에서 실제 수행 및 호출처가 없는 `pdf_parser.py` 및 단일 상수 래퍼 `constants.py`를 영구 제거하고, 이에 의존하던 `tests/test_column_detector.py`, `tests/test_text_cleaner.py` 단위 테스트 파일도 정리 완료.

### Fixed (Bugfixes)
- **Bugfix: 단위 테스트 Mock 구성 오류 수정**: `tests/test_analyzer.py`에서 디렉토리 재귀 분석(`test_analyze_directory_recursion`) 시 Mock 우회 문제로 인한 `call_count` 검출 실패 및 Regex chapter detection 테스트(`test_overwrite_skip_logic_true`) 시 Mock 객체 반환으로 인한 `TypeError` 오류를 Mock 구조 정밀화 및 `side_effect` 분기 처리를 통해 수정 완료.

## [1.5.0] - 2026-06-21

### Changed
- **apps/ebook 리팩토링 (Phase 1~4)**: 중복 코드 제거, 일관성 개선, 테스트/린터 인프라를 전면 도입.
  - **Phase 1 (클린업)**: `EXCLUDE_TITLES`를 `src/constants.py` 중앙 상수로 분리 (`pdf_analyzer.py`, `pdf_to_markdown.py`에서 중복 제거); `process.py`의 중복 `ArgumentParser` 제거; 파일 탐색 로직을 `_collect_files()` / `_resolve_file_arg()` 헬퍼로 추출.
  - **Phase 2 (일관성)**: `HTMLConverter` / `HTMLToMarkdownConverter`가 output 디렉토리에 결과를 저장하도록 수정 (기존 source 옆 저장); `pdf_translator.py` 모듈 레벨 상수 제거 (Docker 호환성을 위해 생성자 기본값만 유지); `pyproject.toml`에 누락 의존성(`google-generativeai`, `openai`, `python-dotenv`, `pytest`) 및 `[tool.ruff]` / `[tool.pytest]` 설정 추가; `translate_batch` Poe task 및 Make target 추가.
  - **Phase 3 (품질)**: `tests/test_text_cleaner.py` (23개), `tests/test_splitter_utils.py` (7개), `tests/test_column_detector.py` (4개) 총 30개 단위 테스트 작성 (pytest); `README.md` 신규 작성.
  - **Phase 4 (Command 패턴)**: `main()` 165줄 → 15줄로 단축. 7개 모드를 `src/commands.py`의 `EbookCommand` 추상 클래스 기반 6개 Command 클래스로 분리.

## [1.1.0] - 2026-06-19

### Added
- **Ebook Parser & Sync Pipeline**: Python 3.13 및 `uv`를 사용해 PDF 도서를 변환하고 쪼개는 `apps/ebook` 서비스를 모노레포 하위 독립 서비스로 최초 도입.
- **Docker Profiles**: `ebook` 서비스 컨테이너 전용 Docker Compose 프로필 정의 완료.
