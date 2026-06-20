# Task List: Ebook PDF 프로세서 구조 리팩토링 및 HTML/번역 모듈 분리

`apps/ebook` 아키텍처 리팩토링 계획 진행 상태를 관리하는 태스크 목록입니다.

## 🟩 완료된 작업 (Completed Tasks)
- [x] 리팩토링 및 HTML 변환기, 분석/번역 모듈 분리 계획서 작성 및 승인 ([refactor_ebook_processor.md](file:///home/ejpark/workspace/scraper/docs/plans/refactor_ebook_processor.md))
- [x] `apps/ebook/src/split_chapter.py` 모듈 신규 구현 완료
- [x] `apps/ebook/src/pdf_to_markdown.py` 모듈 신규 구현 완료
- [x] `apps/ebook/src/pdf_to_html.py` 모듈 신규 구현 완료 (PyMuPDF HTML 파서 탑재)
- [x] `apps/ebook/src/pdf_translator.py` 모듈 신규 구현 완료
- [x] `apps/ebook/src/pdf_analyzer.py` 모듈 신규 구현 완료 (TOC 분석 및 요약 덤프 통합)
- [x] `apps/ebook/src/process.py` Entrypoint 컨트롤러 슬림화 리팩토링 수정 완료
- [x] 구버전 중복 레거시 파일들 삭제 완료 (`analyze_pdfs.py`, `translate.py`)
- [x] `apps/ebook/Makefile` 생성 완료 (Docker Compose 매핑 및 편리한 개발 타겟 탑재)

## 🟨 미진행/보류 작업 (Pending Tasks)
- 없음
