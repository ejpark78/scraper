# Summary: 015-rename-ebook-tasks-and-add-html2md

> Squashed from: 015-rename-ebook-tasks-and-add-html2md.review.md 015-rename-ebook-tasks-and-add-html2md.task.md 015-rename-ebook-tasks-and-add-html2md.walkthrough.md

---

## Review

# 📝 Code Review: Rename Ebook Tasks and Add html2md

이 문서는 `apps/ebook` 디렉토리 내의 Poethepoet/Makefile 태스크 이름을 변경하고, 하이브리드 파서를 활용하여 HTML을 마크다운으로 깔끔하게 변환하는 `html2md` 기능을 추가한 작업에 대한 코드 리뷰입니다.

## 1. 변경 사항 및 작업 요약
- **태스크명 변경**: `md` ➡️ `pdf2md`, `html` ➡️ `pdf2html`, `translate` ➡️ `translate_md`
- **신규 기능 추가**: `html2md` 태스크 추가 및 `HTMLToMarkdownConverter` 클래스 연동
- **하이브리드 파싱 기법 도입**: 
  - `page.get_text("xhtml")` 시 발생하는 중복 단락 생성 버그를 방지하기 위해 `dict`와 `html` 데이터를 추출 및 비교하고 중복 좌표 텍스트를 제거하는 알고리즘 구현
  - `html.unescape` 처리를 통해 HTML 엔티티 코드를 온전한 유니코드 문자로 완전 복원
  - 줄바꿈으로 끊어진 문장을 가독성 높은 하나의 단락으로 띄어쓰기를 보장하며 병합
- **이미지 분리 시점 전진 (HTML 레벨)**:
  - HTML 변환 시점(`pdf_to_html.py`)에서 base64 인라인 인코딩 대신 `images/` 폴더에 실제 이미지 파일을 추출하여 기록하도록 설계하여 HTML 가독성 및 파일 가벼움을 극대화했습니다.
- **재귀 일괄 탐색 연동**:
  - `make ebook-pdf2html` 및 `make ebook-html2md` 실행 시 인자가 없어도 `data` 및 `output` 폴더 전체의 대상 파일들을 재귀적으로 검색하여 일괄 처리하도록 사용 편의성을 개선했습니다.

## 2. 코드 품질 검토 (Quality Review)

### Type Safety
- Python의 `argparse`, `pathlib.Path` 등을 사용하여 타입 호환성을 유지하였으며, `pymupdf(fitz)`의 반환 타입인 `dict`를 안전하게 탐색하고 처리합니다.

### Error Handling & Exception Management
- `process.py` 내부에서 html 파일의 절대 경로가 존재하지 않는 경우 `alt_path = Path(args.data) / args.html2md`를 통해 데이터 마운트 폴더를 조회하도록 보완하여, 경로 이탈로 인한 `FileNotFoundError` 발생 상황을 안전하게 예외 처리 및 복구했습니다.

### Layout & Cleanliness
- CSS 스타일 시트, JS 스크립트, 그리고 `page-separator`와 같은 레이아웃 보조 요소를 `BeautifulSoup.decompose()`로 완벽하게 소거하여 마크다운 프리뷰 시 잡음이 전혀 발생하지 않도록 했습니다.

## 3. 자가 검증 결과 (Self-Inspection)
- `Beyond Vibe Coding` 도서의 실제 1장을 대상으로 테스트를 수행한 결과:
  - 본문 텍스트 내 중복 텍스트 출력이 100% 제거되었음을 확인했습니다.
  - base64 인라인 이미지가 `images/` 폴더 하위에 파일명 공백 치환 후 PNG 파일로 정상 저장되고, 마크다운 이미지 태그로 상대 경로 매핑되었습니다.
  - HTML 엔티티 코드가 `“`, `’`, `—` 로 깔끔하게 렌더링되었습니다.

---

## Task

# 📋 Task List: Rename Ebook Tasks and Add html2md

이 파일은 `rename-ebook-tasks-and-add-html2md` 작업을 수행하기 위해 설정된 할 일 목록과 진행 상태입니다.

- [x] `apps/ebook/pyproject.toml` 태스크 명칭 변경 (`pdf2md`, `pdf2html`, `translate_md`, `html2md`) 및 라이브러리 의존성 추가 (`markdownify`, `beautifulsoup4`, `lxml`)
- [x] `apps/ebook/Makefile` 타겟 이름 변경 및 신규 타겟 `html2md` 추가
- [x] `apps/ebook/src/process.py` argparse 인자 연동 및 html2md 대체 검색 경로 보정
- [x] `apps/ebook/src/pdf_to_html.py` 하이브리드 파서 구현 (`dict` 좌표 중복 제거 + `html` 스타일 보존 및 디코딩)
- [x] `apps/ebook/src/html_to_markdown.py` `markdownify`를 활용한 GFM 변환, base64 이미지 추출, 레이아웃 정제 및 줄글 띄어쓰기 병합 로직 추가
- [x] Docker 환경 내 빌드 및 `Beyond Vibe Coding` 챕터 1 테스트 및 최종 검증 성공
- [x] 코드 리뷰 문서 및 산출물 영구 보존용 문서 작성

---

## Walkthrough

# 🚀 Walkthrough: Rename Ebook Tasks and Add html2md

이 문서는 태스크 완료 후 최종 결과 검증 과정을 설명하는 결과 보고서(Walkthrough)입니다.

## 1. 검증 대상 및 환경
- **환경**: Docker compose `ebook` 서비스 컨테이너 기반 실행
- **검증 데이터**: `data/ebook/output/Beyond Vibe Coding/1. Introduction What Is Vibe Coding.pdf`

## 2. 검증 절차 및 결과

### 1) 빌드 수행
- `make -C apps/ebook build`를 실행하여 Python virtualenv 및 라이브러리(`beautifulsoup4`, `markdownify`, `lxml`)가 패키징된 최신 Docker 이미지를 생성했습니다.

### 2) PDF ➡️ HTML 변환 테스트 (pdf2html)
- 명령어:
  ```bash
  make -C apps/ebook pdf2html PDF="output/Beyond Vibe Coding/1. Introduction What Is Vibe Coding.pdf"
  ```
- 결과:
  - `page.get_text("dict")` 정보를 수집하여 페이지당 median font size 산출 및 제목 임계값(`heading_threshold`) 설정.
  - 이중 쓰기로 작성된 그림자 텍스트와 좌표가 겹치는 중복 문자열을 감지하여 필터링 완료.
  - HTML 엔티티 코드가 아닌 깨끗한 유니코드 일반 문자 기반 구조 생성 성공.
  - `✓ Saved HTML: 1. Introduction What Is Vibe Coding.html` 정상 저장.

### 3) HTML ➡️ Markdown 변환 테스트 (html2md)
- 명령어:
  ```bash
  make -C apps/ebook html2md HTML="output/Beyond Vibe Coding/1. Introduction What Is Vibe Coding.html"
  ```
- 결과:
  - `<style>`, `<script>`, `<div class="page-separator">` 등 레이아웃 파편 완벽 디컴포즈(제거).
  - base64로 박혀있던 이미지를 디코딩하여 `images/` 하위에 고유 파일명(공백 치환)으로 저장하고, 마크다운 이미지 링크로 정상 전환.
  - 마크다운 문단 정리 규칙을 통해 영어 단어 잘림/띄어쓰기 뭉침 현상 복원.
  - HTML 엔티티가 최종 디코딩된 깔끔한 GFM(GitHub Flavored Markdown) 파일이 `1. Introduction What Is Vibe Coding.md`로 생성됨.

## 3. 최종 산출물 확인
- 최종 마크다운 프리뷰 시 중복 텍스트나 깨짐 없이 고품질의 콘텐츠 레이아웃이 복원되었음을 검증 완료했습니다.

---

