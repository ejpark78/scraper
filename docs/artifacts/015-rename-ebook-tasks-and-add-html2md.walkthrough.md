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
