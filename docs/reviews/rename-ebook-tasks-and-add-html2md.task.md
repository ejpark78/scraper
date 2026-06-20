# 📋 Task List: Rename Ebook Tasks and Add html2md

이 파일은 `rename-ebook-tasks-and-add-html2md` 작업을 수행하기 위해 설정된 할 일 목록과 진행 상태입니다.

- [x] `apps/ebook/pyproject.toml` 태스크 명칭 변경 (`pdf2md`, `pdf2html`, `translate_md`, `html2md`) 및 라이브러리 의존성 추가 (`markdownify`, `beautifulsoup4`, `lxml`)
- [x] `apps/ebook/Makefile` 타겟 이름 변경 및 신규 타겟 `html2md` 추가
- [x] `apps/ebook/src/process.py` argparse 인자 연동 및 html2md 대체 검색 경로 보정
- [x] `apps/ebook/src/pdf_to_html.py` 하이브리드 파서 구현 (`dict` 좌표 중복 제거 + `html` 스타일 보존 및 디코딩)
- [x] `apps/ebook/src/html_to_markdown.py` `markdownify`를 활용한 GFM 변환, base64 이미지 추출, 레이아웃 정제 및 줄글 띄어쓰기 병합 로직 추가
- [x] Docker 환경 내 빌드 및 `Beyond Vibe Coding` 챕터 1 테스트 및 최종 검증 성공
- [x] 코드 리뷰 문서 및 산출물 영구 보존용 문서 작성
