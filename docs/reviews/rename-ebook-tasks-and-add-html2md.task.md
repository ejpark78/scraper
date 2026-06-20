# 🏁 Task Checklist - Rename Ebook Tasks and Add html2md

- [x] `apps/ebook/pyproject.toml` 의존성 추가 (`markdownify`, `beautifulsoup4`, `lxml`)
- [x] `apps/ebook/pyproject.toml` 태스크 이름 변경 (`md` ➡️ `pdf2md`, `html` ➡️ `pdf2html`, `translate` ➡️ `translate_md`)
- [x] `apps/ebook/pyproject.toml` 신규 `html2md` 태스크 등록
- [x] `apps/ebook/Makefile` 내 타겟 명칭 연동 및 `html2md` 추가
- [x] `apps/ebook/src/process.py` argparse 옵션 업데이트 및 분기 추가
- [x] `apps/ebook/src/html_to_markdown.py` 변환 모듈 신규 구현
- [x] HTML 스타일/스크립트 decompose 처리로 CSS 텍스트 유출 방지
- [x] Base64 이미지 디코딩 및 `images/` 디렉토리 추출 로직 연동
- [x] 이미지 파일명 공백 치환(`_`) 위생 처리 적용
- [x] 단락/행 간 단편화된 문장 복원 및 병합 알고리즘 구현
- [x] Docker Compose 기반 최종 검증 확인
- [x] 코드 리뷰 세트(`docs/reviews/`) 작성 및 Git 커밋
