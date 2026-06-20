# 📘 Ebook Pipeline

## 개요
PDF ebook 수집 → split → pdf2html → html2md → translate 파이프라인

## 주요 명령어
| 명령어 | 설명 |
|--------|------|
| `make ebook-split` | PDF → 챕터별 PDF 분할 |
| `make ebook-pdf2html` | 챕터 PDF → HTML 변환 |
| `make ebook-html2md` | HTML → Markdown 변환 |
| `make ebook-test` | pytest 실행 (30 tests) |

## 출력 파일 규칙
- 변환 결과는 **입력 파일과 동일한 디렉토리**에 저장
  - `chapter.pdf` → `chapter.html` (with_suffix)
  - `chapter.html` → `chapter.md` (with_suffix)
- 이미지는 `images/` 서브디렉토리에 저장 (입력 파일 기준 상대 경로)
- 출력 폴더명 = raw PDF 파일명에서 `.pdf` 제거 (작가/년도 제거 안 함)

## Makefile 변수
- `OUTPUT=data/output` — split/convert 작업 디렉토리
- `RAW_PDF=data/raw` — 원본 PDF 디렉토리
- `PDF=<path>` — 단일 파일 처리 시 파일 경로

## Permission 이슈 해결
- `ENV UV_FROZEN=1` — `uv run`이 lock 파일 검증/갱신 시도로 발생하는 Permission denied 해결
- `ENV UV_CACHE_DIR=/tmp/uv-cache` — non-root 사용자도 쓸 수 있는 캐시 경로
- `ENV UV_PROJECT_ENVIRONMENT=/usr/local` — `.venv` 생성 회피, system Python 사용
- `RUN_USER` — Docker 컨테이너를 host 사용자 권한으로 실행 (파일 소유권 일관성)
- Makefile `OUTPUT` 기본값 `data/output` (마운트된 볼륨 내 경로, writable)

## 아키텍처
- Command pattern: `commands.py` (EbookCommand ABC + 6 구현체)
- `ChapterSplitter` — PDF 페이지 범위 분할
- `HTMLConverter` — PDF → HTML (PyMuPDF)
- `HTMLToMarkdownConverter` — HTML → MD (BeautifulSoup + markdownify)
- `PDFTranslator` — PDF 페이지 번역
- `get_book_title(pdf_name)` — `.pdf` 제거한 순수 파일명 반환

## 설정
- `books.json`: PDF 파일명을 key, `chapters[]`에 title/start/end/include
- `--path data/output`: split 결과물 및 convert 입출력 경로
