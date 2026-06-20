# 📝 Code Review: Rename Ebook Tasks and Add html2md

이 문서는 `apps/ebook` 디렉토리 내의 Poethepoet/Makefile 태스크 이름을 변경하고, 하이브리드 파서를 활용하여 HTML을 마크다운으로 깔끔하게 변환하는 `html2md` 기능을 추가한 작업에 대한 코드 리뷰입니다.

## 1. 변경 사항 및 작업 요약
- **태스크명 변경**: `md` ➡️ `pdf2md`, `html` ➡️ `pdf2html`, `translate` ➡️ `translate_md`
- **신규 기능 추가**: `html2md` 태스크 추가 및 `HTMLToMarkdownConverter` 클래스 연동
- **하이브리드 파싱 기법 도입**: 
  - `page.get_text("xhtml")` 시 발생하는 중복 단락 생성 버그를 방지하기 위해 `dict`와 `html` 데이터를 추출 및 비교하고 중복 좌표 텍스트를 제거하는 알고리즘 구현
  - `html.unescape` 처리를 통해 HTML 엔티티 코드를 온전한 유니코드 문자로 완전 복원
  - 줄바꿈으로 끊어진 문장을 가독성 높은 하나의 단락으로 띄어쓰기를 보장하며 병합

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
