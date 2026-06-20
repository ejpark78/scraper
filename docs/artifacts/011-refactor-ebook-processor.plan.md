# Plan: Ebook PDF 프로세서 구조 리팩토링 및 HTML/번역 모듈 분리

이 계획서는 `apps/ebook` 디렉토리에 혼재되어 있는 PDF 처리 소스코드(`process.py`, `analyze_pdfs.py`, `translate.py`)를 단일 책임 원칙에 입각해 모듈식으로 쪼개고, PyMuPDF 기반의 고품질 HTML 변환 기능을 추가하기 위한 아키텍처 리팩토링 구현 계획입니다.

## User Review Required
> [!IMPORTANT]
> - 기존 `process.py`에 집중되어 있던 결합 코드가 여러 하부 파이썬 파일로 분할됩니다.
> - 기존 단독 실행 파일인 `analyze_pdfs.py`와 `translate.py`는 신규 모듈 (`pdf_analyzer.py`, `pdf_translator.py`)에 병합되며 삭제 처리됩니다.
> - 모든 실행 및 수동 테스트는 `docker compose` 환경 내부에서 수행됩니다.

## Proposed Changes

### 1. New Modules (기능별 단일 책임 모듈 설계)
- **`[NEW]`** `apps/ebook/src/split_chapter.py`: PDF의 TOC 정보 및 범위 설정을 참고하여 챕터별 독립 PDF를 추출 분리하는 유틸
- **`[NEW]`** `apps/ebook/src/pdf_to_markdown.py`: 분할된 챕터 PDF에서 다단/레이아웃 보정, 이미지/표 렌더링을 병행하여 마크다운 문서로 파싱하는 유틸
- **`[NEW]`** `apps/ebook/src/pdf_to_html.py`: PyMuPDF 내장 HTML 추출기를 활용하여 CSS와 레이아웃이 적용된 고품질 단일 HTML 파일로 변환하는 유틸
- **`[NEW]`** `apps/ebook/src/pdf_translator.py`: Ollama API를 이용해 PDF 내 문장을 한글로 번역 및 요약본을 빌드하는 로직 모듈화
- **`[NEW]`** `apps/ebook/src/pdf_analyzer.py`: PDF 내 TOC 분석, 대화형 도서 챕터 경계 튜닝 및 기존 일괄 summary dump 출력 기능
- **`[NEW]`** `apps/ebook/Makefile`: Docker Compose 명령어 래핑 및 타겟 기반 단축 명령어 세트 제공
- **`[MODIFY]`** `Makefile`: 루트 Makefile에 `ebook-%` 패턴 규칙을 추가하여 하위 타겟과 간편 연동

### 2. Main Entrypoint & Legacy Cleanup
- **`[MODIFY]`** `apps/ebook/src/process.py`: 전체 흐름 분기(CLI parser 포함)를 조율하고 위 모듈들을 임포트해 명령을 내리는 얇은 메인 기동 컨트롤러로 재구성
- **`[DELETE]`** `apps/ebook/src/analyze_pdfs.py`: `pdf_analyzer.py`에 일괄 덤프 기능이 포함되므로 불필요하여 삭제
- **`[DELETE]`** `apps/ebook/src/translate.py`: `pdf_translator.py` 및 `process.py`에 이관되므로 불필요하여 삭제

---

## Verification Plan

### Automated Tests
- 파이썬 환경의 가독성 및 빌드 적합성 수동 검사
- `apps/ebook/docker/compose.yml` 컨테이너 상에서 CLI 인수 분석 정상 작동 여부

### Manual Verification (Docker-Centric)
1. **전체 PDF 상태 일괄 조회 (구 analyze_pdfs.py 기능 대체):**
   ```bash
   docker compose -f apps/ebook/docker/compose.yml run --rm ebook python src/process.py --summary
   ```
2. **단일 PDF TOC 정밀 분석 및 대화형 프로필 구성:**
   ```bash
   docker compose -f apps/ebook/docker/compose.yml run --rm ebook python src/process.py --analyze data/Beyond\ Vibe\ Coding\ -\ Addy\ Osmani.pdf
   ```
3. **PDF 챕터별 PDF 분할 및 마크다운 일괄 빌드:**
   ```bash
   docker compose -f apps/ebook/docker/compose.yml run --rm ebook python src/process.py --split --md
   ```
4. **PDF의 HTML 고품질 다이렉트 변환:**
   ```bash
   docker compose -f apps/ebook/docker/compose.yml run --rm ebook python src/process.py --html "data/Beyond Vibe Coding - Addy Osmani.pdf" --output "output/Beyond Vibe Coding/html"
   ```
