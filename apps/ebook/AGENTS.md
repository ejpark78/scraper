# 📘 Ebook Pipeline

## 개요
(PDF, EPUB) → split → to-html → to-md → translate (en-ko)

## 주요 명령어
| 명령어 | 설명 |
|--------|------|
| `make ebook-split` | PDF/EPUB → 챕터별 파일 분할 (PDF→PDF, EPUB→HTML) |
| `make ebook-to-html` | PDF/EPUB → HTML 변환 |
| `make ebook-to-md` | HTML/PDF/EPUB → Markdown 변환 |
| `make ebook-test` | pytest 실행 |

## 출력 파일 규칙
- 변환 결과는 **입력 파일과 동일한 디렉토리**에 저장
  - `chapter.pdf` → `chapter.html` (with_suffix)
  - `chapter.html` → `chapter.md` (with_suffix)
  - `chapter.epub` → `chapter.html` (내부 HTML 추출)
- 이미지는 `images/` 서브디렉토리에 저장 (입력 파일 기준 상대 경로)
- 출력 폴더명 = raw 파일명에서 `.pdf`/`.epub` 제거 (`get_output_path()`)

## 확장자별 처리

| 명령어 | `.pdf` | `.epub` | `.html` |
|--------|--------|---------|---------|
| `--split` | fitz 페이지 범위 분할 | ebooklib 내부 문서 추출 | — |
| `--to-html` | HTMLConverter (PyMuPDF) | ebooklib 내부 HTML 추출 | — |
| `--to-md` | HTML→MD 2단계 (중간html 유지) | HTML→MD 2단계 | HTMLToMarkdownConverter |

## Makefile 변수
- `OUTPUT=data/output` — split/convert 작업 디렉토리
- `RAW=data/raw` — 원본 PDF/EPUB 디렉토리
- `FILE=<path>` — 단일 파일 처리 시 파일 경로

## Permission 이슈 해결
- `ENV UV_FROZEN=1` — `uv run`이 lock 파일 검증/갱신 시도로 발생하는 Permission denied 해결
- `ENV UV_CACHE_DIR=/tmp/uv-cache` — non-root 사용자도 쓸 수 있는 캐시 경로
- `ENV UV_PROJECT_ENVIRONMENT=/usr/local` — `.venv` 생성 회피, system Python 사용
- `RUN_USER` — Docker 컨테이너를 host 사용자 권한으로 실행 (파일 소유권 일관성)
- Makefile `OUTPUT` 기본값 `data/output` (마운트된 볼륨 내 경로, writable)

## 아키텍처
- Command pattern: `commands.py` (EbookCommand ABC + 6 구현체)
- `ChapterSplitter` — PDF(페이지) / EPUB(내부 문서) 분할
- `HTMLConverter` — PDF → HTML (PyMuPDF)
- `HTMLToMarkdownConverter` — HTML → MD (BeautifulSoup + markdownify)
- `PDFTranslator` — PDF 페이지 번역
- `get_output_path(filename)` — `.pdf`/`.epub` 제거한 순수 파일명 반환

## 설정
- `books.json`: 파일명을 key, `chapters[]`에 title/start/end/include
- `--path data/output`: split 결과물 및 convert 입출력 경로
