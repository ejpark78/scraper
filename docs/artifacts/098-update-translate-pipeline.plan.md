# 098-update-translate-pipeline.plan.md

본 계획서는 `docs/prompts/translate_pipeline.md` 프롬프트 가이드 파일의 요구사항을 반영하여 수정하는 상세 설계 및 실행 단계를 정의합니다.

## 🎯 수정 목표

1. **복습용 Q&A 제거**:
   - `docs/prompts/translate_pipeline.md` 내 '옵션 A'의 구성 요소 중 학습용 Q&A 10문항을 생성하지 않도록 관련 설명을 제거합니다.
2. **`*.summary.md` 생성 규칙 추가**:
   - 번역 작업 후속 과정 또는 결과로 원본 파일명에 대응하는 요약본 파일(`[원본파일명].summary.md`)을 별도 생성하도록 지침을 추가합니다.
   - 요약본에는 각 단락별 요약이 (원문 요약 - 번역문 요약)의 형태로 쌍을 이루어 작성되도록 프롬프트 가이드에 구체적인 가이드라인과 템플릿을 제시합니다.

## 📂 변경 대상 파일

- [translate_pipeline.md](file:///Users/ejpark/workspace/scraper/docs/prompts/translate_pipeline.md)

---

## 🛠️ 작업 목록 (Tasks)

### 1. `docs/prompts/translate_pipeline.md` 파일 수정
- **1단계: 실행 매개변수 및 초기 질의 규칙** 수정
  - 옵션 A의 설명에서 `Q&A` 언급 제거 및 `*.summary.md` 요약 생성을 옵션 A의 최종 단계 또는 별도 결과물로 명시.
- **2단계: 에이전트 워크플로우** 수정
  - 결과물 파일명 규칙(5번)에 `[원본파일명].summary.md` 추가.
  - 파이프라인 흐름상 요약본(`*.summary.md`)을 어떻게 구성하는지 명시.
- **3단계: 포맷별 세부 번역 및 작성 규칙** 수정
  - `옵션 A`에서 복습용 Q&A 10문항 규칙(3번)을 완전히 삭제하고, 대신 `*.summary.md` 요약 문서 생성 및 단락별 요약 형식(원문 - 번역문 대비)에 관한 작성 지침을 기술.

---

## 🔍 자가 검증 방법

1. 수정 후 `translate_pipeline.md` 파일 내용이 요구사항에 부합하는지 텍스트 정합성 확인.
2. 마크다운 링크 및 내용이 올바른지 확인.
