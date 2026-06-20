"""
translate_batch.py — Markdown document translator using Gemini / OpenAI API.

Design Context:
This script processes English Markdown documents from a specific folder, splits them into logical paragraphs, 
and translates them into a bilingual format (English original - Korean translation - Glossary) according to 
the rules specified in `docs/translate_prompts_en-ko.md`. At the end of each document, it appends 10 review Q&As.

Dependencies:
- python-dotenv (optional, to load API keys)
- google-generativeai (for Gemini API, default)
- openai (for OpenAI API, fallback or optional)

Execution:
Set GEMINI_API_KEY or OPENAI_API_KEY environment variables, then run:
  python translate_batch.py --input-dir "/path/to/dir" --model gemini
"""

import os
import re
import sys
import argparse
from pathlib import Path

# Try importing SDKs
try:
    import google.generativeai as genai
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False

try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

SYSTEM_PROMPT = """
당신은 AI/ML(인공지능 및 머신러닝) 분야 최고 수준의 전문 번역가이자 교육용 콘텐츠 설계자입니다.
제공된 기술 원문을 왜곡이나 요약 없이 정확하게 번역하고, 전문 용어의 학술적 의미를 보존하며, 원문과 번역문을 직관적으로 대조할 수 있는 학습용 문서를 구성합니다.

다음의 3가지 규칙을 엄격하게 준수하여 번역을 수행하십시오.

1. [단락 단위 원문 번역 및 구조화 (원문-번역문 대조)]
- 각 단락(Paragraph)에 대하여 반드시 [원문] 영역과 [번역문] 영역을 명확히 구분하여 교차 배치하십시오.
- 원문의 모든 문장과 내용을 요약 없이 전체 번역하십시오.
- 마크다운 스타일(헤더, 목록, 강조, 코드, 인용구 등)을 양쪽 모두에 완벽하게 복제 및 유지하십시오.
- 표(Table)는 절대 번역하지 않고 원문 텍스트(영어 등) 형태와 셀 구조를 그대로 유지하십시오.

2. [전문 용어(Technical Terms) 처리 및 단락별 각주 배정]
- 핵심 전문 용어(예: Gradient Descent, Overfitting, Transformer 등)는 원어 그대로 표기하거나 통용 번역어와 병기하십시오.
- 번역된 단락의 [번역문] 바로 아래에 해당 단락에 등장한 주요 전문 용어에 대한 해설을 각주 형식으로 작성하십시오.
  * 형식:
  > **[용어 해설]**
  > * **용어명:** AI/ML 맥락에서의 의미 및 작동 원리 설명

3. [최종 출력 포맷 및 예시]
단일 단락에 대한 번역 출력 구조는 다음과 같아야 합니다:

**[{paragraph_index} - 원문 (Original Text)]**
{원문 내용}

**[{paragraph_index} - 번역문 (Translated Text)]**
{번역문 내용}

> **[용어 해설]**
> * **전문용어 (원어):** 용어 해설
"""

QNA_PROMPT = """
아래 본문 내용에 기반하여 핵심 기술 개념의 구조적 이해를 도울 수 있는 고품질의 복습용 질문(Question)과 답변(Answer) 10개를 생성하십시오.
모든 질문과 답변은 반드시 영어와 한글 번역이 완전 병기되어야 합니다.

출력 형식:
# 복습용 질문 및 답변 (10문항)

1. **Q (English):** [영어 질문]
   **Q (한국어):** [한글 질문]
   **A (English):** [영어 답변]
   **A (한국어):** [한글 답변]

... (10번 문항까지 작성)

본문 내용:
{document_content}
"""


class TranslatorClient:
    def __init__(self, provider: str = "gemini", model_name: str = None):
        self.provider = provider
        if provider == "gemini":
            if not HAS_GEMINI:
                raise ImportError("google-generativeai 패키지가 설치되어 있지 않습니다. 'pip install google-generativeai'를 실행하세요.")
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY 환경 변수가 설정되어 있지 않습니다.")
            genai.configure(api_key=api_key)
            self.model_name = model_name or "gemini-1.5-flash"
            self.model = genai.GenerativeModel(self.model_name, system_instruction=SYSTEM_PROMPT)
        elif provider == "openai":
            if not HAS_OPENAI:
                raise ImportError("openai 패키지가 설치되어 있지 않습니다. 'pip install openai'를 실행하세요.")
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY 환경 변수가 설정되어 있지 않습니다.")
            self.client = openai.OpenAI(api_key=api_key)
            self.model_name = model_name or "gpt-4o"
        else:
            raise ValueError(f"지원하지 않는 프로바이더입니다: {provider}")

    def translate_paragraph(self, index: int, text: str) -> str:
        prompt = f"다음 단락을 양식에 맞춰 가공하십시오. (단락 인덱스: {index})\n\n{text}"
        
        if self.provider == "gemini":
            response = self.model.generate_content(prompt)
            return response.text
        else:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1
            )
            return response.choices[0].message.content

    def generate_qna(self, full_content: str) -> str:
        prompt = QNA_PROMPT.format(document_content=full_content[:15000])  # token limit safety context cutoff
        if self.provider == "gemini":
            response = self.model.generate_content(prompt)
            return response.text
        else:
            response = self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": "You are a professional educational content designer."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3
            )
            return response.choices[0].message.content


def split_into_paragraphs(text: str) -> list[str]:
    """Split markdown text into logical paragraphs."""
    # Split by two or more newlines
    raw_blocks = re.split(r'\n\s*\n', text)
    paragraphs = []
    current_block = []

    for block in raw_blocks:
        block_strip = block.strip()
        if not block_strip:
            continue
        
        # If it's a minor markdown component (like image, tables, list items), group them logically if needed,
        # otherwise treat each block as its own paragraph.
        paragraphs.append(block_strip)
        
    return paragraphs


def main():
    parser = argparse.ArgumentParser(description="Markdown batch translator")
    parser.add_argument("--input-dir", required=True, help="Directory containing original .md files")
    parser.add_argument("--provider", default="gemini", choices=["gemini", "openai"], help="API provider to use")
    parser.add_argument("--model", help="Specific model name (e.g. gemini-1.5-flash or gpt-4o)")
    args = parser.parse_args()

    input_path = Path(args.input_dir)
    if not input_path.exists() or not input_path.is_dir():
        print(f"Error: Directory {args.input_dir} does not exist.")
        sys.exit(1)

    # Initialize client
    try:
        client = TranslatorClient(provider=args.provider, model_name=args.model)
    except Exception as e:
        print(f"Error initializing API client: {e}")
        sys.exit(1)

    # Find md files excluding translated ones
    md_files = [f for f in input_path.glob("*.md") if not f.name.endswith(".en-ko.md") and not f.name.endswith("_translated.md")]
    md_files.sort()

    if not md_files:
        print("No markdown files found to translate.")
        return

    print(f"Found {len(md_files)} files to translate.")

    for file_path in md_files:
        output_file = file_path.with_name(f"{file_path.stem}.en-ko.md")
        print(f"\nProcessing: {file_path.name} -> {output_file.name}")

        content = file_path.read_text(encoding="utf-8")
        paragraphs = split_into_paragraphs(content)
        print(f"Divided into {len(paragraphs)} paragraphs.")

        translated_paragraphs = []
        translated_for_qna = []

        for idx, para in enumerate(paragraphs, 1):
            print(f"  [{idx}/{len(paragraphs)}] Translating paragraph...")
            try:
                # If paragraph is too small (e.g. title only, single markdown line), we still format it
                result = client.translate_paragraph(idx, para)
                translated_paragraphs.append(result)
                translated_for_qna.append(para)  # Keep original text segment for Q&A reference
            except Exception as e:
                print(f"  Error translating paragraph {idx}: {e}")
                # Fallback to appending original if failed
                translated_paragraphs.append(f"**[{idx} - 원문 (Original Text)]**\n{para}\n\n[Translation Failed]")

        # Generate Q&A based on the first few paragraphs if too long, or whole content
        print("  Generating 10 Review Q&A questions...")
        reference_text = "\n\n".join(translated_for_qna)
        try:
            qna_section = client.generate_qna(reference_text)
        except Exception as e:
            print(f"  Error generating Q&A: {e}")
            qna_section = "\n# 복습용 질문 및 답변 (10문항)\n\n(Q&A Generation Failed)"

        # Save to output file
        final_doc = "\n\n---\n\n".join(translated_paragraphs) + "\n\n---\n\n" + qna_section
        output_file.write_text(final_doc, encoding="utf-8")
        print(f"Saved translated document to: {output_file.name}")


if __name__ == "__main__":
    main()
