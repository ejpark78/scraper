# 🚶 Walkthrough - Rename Ebook Tasks and Add html2md

## 1. 수행 내용
- **태스크 명칭 변경**:
  - `make md` ➡️ `make pdf2md`
  - `make html` ➡️ `make pdf2html`
  - `make translate` ➡️ `make translate_md`
- **html2md 구현**:
  - `make html2md HTML="<path_to_html>"` 형태로 작동.
  - HTML 내 base64 이미지 데이터를 PNG 파일로 디코딩하여 `images/` 하위 경로에 저장하고 마크다운에 상대 경로로 자동 전환 처리.
  - 이미지 파일명 생성 시 공백 문자를 언더스코어(`_`)로 보정 처리.
  - 마크다운 변환 시 최상단 CSS 텍스트 유출을 막기 위해 `<style>`, `<script>` 태그를 사전에 `decompose`로 완전 박멸.
  - 단락 내에서 불필요하게 줄바꿈된 행들을 감지하여 자연스러운 하나의 문장으로 이어주는 문장 복원 필터 작성.

## 2. 검증 과정 및 결과
- **테스트 환경**: Docker compose `ebook` 컨테이너 환경
- **실행 명령어**:
  ```bash
  make -C apps/ebook html2md HTML="data/output/Beyond Vibe Coding/1. Introduction What Is Vibe Coding.html" OUTPUT="data/output"
  ```
- **검증 결과**:
  - `data/ebook/output/Beyond Vibe Coding/images/` 폴더에 `1._Introduction_What_Is_Vibe_Coding_img_1.png` 등 추출 완료.
  - 마크다운 문서 최상단에 CSS 노출 현상 완전 소멸.
  - 이미지 참조 경로가 `![image](images/1._Introduction_What_Is_Vibe_Coding_img_1.png)`로 정상 변환.
  - 줄바꿈으로 끊겼던 영문 문장이 한 문단으로 복원 완료.
