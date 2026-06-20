# Plan - Beyond Vibe Coding 번역 및 자동화 스크립트 작성

이 계획서는 Beyond Vibe Coding 책의 영문 마크다운 파일들을 한국어 대조식 번역 문서(`.en-ko.md`)로 가공하고 최하단에 복습용 질문 10문항을 추가하기 위한 작업 계획입니다.

## Proposed Changes

### 1. Translation Automation Script (Method 2)
- **`[NEW]`** `/home/ejpark/workspace/workspace/scraper/apps/ebook/src/translate_batch.py`:
  - OpenAI 및 Gemini API를 사용하여 영어 마크다운 문서를 단락별로 분할 번역하는 Python 스크립트.
  - 번역 규칙 문서(`docs/translate_prompts_en-ko.md`)의 요구사항(대조 배치, 용어 해설, 표 보존, 10문항 복습용 질문 생성 등)을 시스템 프롬프트로 주입하여 처리.

### 2. Manual/Sequential Translation by Agent (Method 1)
- **`[NEW]`** `/home/ejpark/workspace/scraper/data/ebook/output/Beyond Vibe Coding/*.en-ko.md`:
  - 에이전트가 직접 소스 파일을 읽고 번역하여 결과를 `.en-ko.md`로 순차 저장.
  - 용량이 비교적 적은 `Preface.md`, `I. Foundations.md`, `II. AI Coding in Practice.md`, `III. Trust and Autonomy.md` 등을 먼저 완료하고, 메인 챕터로 진행.

---

## Verification Plan

### Automated Verification
- 번역 스크립트의 구문 검증 및 실행 파라미터 확인.

### Manual Verification
- 에이전트가 생성한 번역 문서의 포맷 및 마크다운 대조 구조 검증.
- 복습용 질문 10문항의 영-한 완전 병기 및 내용 정확성 확인.
