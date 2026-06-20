# 📋 apps/ebook Task Renaming and html2md Implementation Plan

이 계획서는 `apps/ebook` 디렉토리 내의 Poethepoet 태스크 및 Makefile 타겟 명칭을 변경하고, HTML을 Markdown으로 변환하는 `html2md` 기능을 이미지 및 표 변환 지원과 함께 구현하는 작업을 다룹니다.

## 1. 개요 및 목적
- 사용자 요청에 따라 기존 CLI/Makefile 타겟 이름 변경:
  - `md` ➡️ `pdf2md`
  - `html` ➡️ `pdf2html`
  - `translate` ➡️ `translate_md`
- 신규 변환기 추가:
  - `html2md`: HTML 파일을 Markdown 파일로 변환. 이미지(`<img>`) 및 표(`<table>`) 태그가 손실 없이 Markdown 문법으로 변환되어야 함.

## 2. 상세 작업 계획

| 파일 경로 | 작업 | 상세 내용 |
| :--- | :--- | :--- |
| [pyproject.toml](file:///home/ejpark/workspace/scraper/apps/ebook/pyproject.toml) | **수정** | 1. dependencies에 `markdownify`, `beautifulsoup4`, `lxml` 등 HTML 파싱 및 마크다운 변환에 유용한 라이브러리 추가.<br>2. [tool.poe.tasks]에서 `md` ➡️ `pdf2md`, `html` ➡️ `pdf2html`, `translate` ➡️ `translate_md`로 변경하고 `html2md` 태스크 추가. |
| [Makefile](file:///home/ejpark/workspace/scraper/apps/ebook/Makefile) | **수정** | 1. `.PHONY` 선언 및 타겟 이름을 `md`, `html`, `translate`에서 `pdf2md`, `pdf2html`, `translate_md`로 변경.<br>2. 신규 타겟 `html2md` 정의 추가. (기본 파라미터 또는 전체 변환 분기 처리) |
| [process.py](file:///home/ejpark/workspace/scraper/apps/ebook/src/process.py) | **수정** | 1. CLI argparse 인자 이름을 `--md` ➡️ `--pdf2md`, `--html` ➡️ `--pdf2html`, `--translate` ➡️ `--translate-md`로 변경.<br>2. 신규 `--html2md` 인자 추가.<br>3. `--html2md` 실행 시 `src/html_to_markdown.py` 모듈을 로드하여 변환 수행하도록 흐름 연동. |
| [html_to_markdown.py](file:///home/ejpark/workspace/scraper/apps/ebook/src/html_to_markdown.py) | **신규 작성** | 1. HTML 파일을 읽어서 Markdown으로 변환하는 `HTMLToMarkdownConverter` 클래스 구현.<br>2. `markdownify` 라이브러리를 사용하거나 BeautifulSoup을 활용하여 표(`<table>`), 이미지(`<img>`)가 깨지지 않고 깔끔하게 마크다운 형식으로 변환되도록 커스터마이징.<br>3. 변환 대상은 입력 HTML과 동일한 경로에 `.md` 확장자로 저장되도록 구현. |

## 3. 검증 계획
1. **의존성 설치 및 빌드**:
   - `make ebook-build` (또는 `docker compose build ebook`) 실행으로 신규 추가된 라이브러리 반영 확인.
2. **타겟 이름 변경 검증**:
   - `make pdf2md`, `make pdf2html`, `make translate_md` 동작 여부 확인.
3. **html2md 검증**:
   - 기존에 생성된 HTML 파일을 대상으로 `make html2md HTML=<path_to_html>` 또는 전체 html 파일 대상 변환 실행.
   - 변환된 `.md` 파일에서 표와 이미지가 올바른 마크다운 문법(`![]()`, `|--|--|`)으로 표현되었는지 확인.
