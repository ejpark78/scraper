"""
translate_batch.py — Markdown document translator using Gemini / OpenAI / OpenCode API.

Design Context:
This script processes English Markdown documents from a specific folder, splits them into
~500-line chunks (at paragraph boundaries), and translates each chunk via an LLM API into
a bilingual format (English original - Korean translation - Glossary) according to the
rules specified in `docs/prompts/translate_pair.md`.

Execution:
Set GEMINI_API_KEY, OPENAI_API_KEY, or OPENCODE_API_KEY, then run:
  uv run python -m src.translate_batch --input-dir "data/output/mybook" --provider opencode
"""

import os
import sys
import argparse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

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

PROMPT_CANDIDATES = [
    Path(__file__).parent.parent.parent.parent / "docs" / "prompts" / "translate_pair.md",
    Path("/app/docs/prompts/translate_pair.md"),
]


def _load_system_prompt() -> str:
    for p in PROMPT_CANDIDATES:
        if p.exists():
            return p.read_text(encoding="utf-8")
    msg = (
        "Warning: translate_pair.md not found. "
        "Expected at docs/prompts/translate_pair.md relative to project root."
    )
    print(msg, file=sys.stderr)
    return ""


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
    def __init__(self, provider: str = "opencode", model_name: str = None):
        self.provider = provider
        self.system_prompt = _load_system_prompt()

        if provider == "gemini":
            if not HAS_GEMINI:
                raise ImportError("google-generativeai 패키지가 필요합니다: pip install google-generativeai")
            api_key = os.environ.get("GEMINI_API_KEY")
            if not api_key:
                raise ValueError("GEMINI_API_KEY 환경 변수가 설정되어 있지 않습니다.")
            genai.configure(api_key=api_key)
            self.model_name = model_name or "gemini-1.5-flash"
            self._gemini_model = genai.GenerativeModel(self.model_name, system_instruction=self.system_prompt)

        elif provider == "openai":
            if not HAS_OPENAI:
                raise ImportError("openai 패키지가 필요합니다: pip install openai")
            api_key = os.environ.get("OPENAI_API_KEY")
            if not api_key:
                raise ValueError("OPENAI_API_KEY 환경 변수가 설정되어 있지 않습니다.")
            self.client = openai.OpenAI(api_key=api_key)
            self.model_name = model_name or "gpt-4o"

        elif provider == "opencode":
            if not HAS_OPENAI:
                raise ImportError("openai 패키지가 필요합니다: pip install openai")
            api_key = os.environ.get("OPENCODE_API_KEY")
            if not api_key:
                raise ValueError("OPENCODE_API_KEY 환경 변수가 설정되어 있지 않습니다.")
            self.client = openai.OpenAI(
                api_key=api_key,
                base_url="https://opencode.ai/zen/go/v1",
            )
            self.model_name = model_name or "deepseek-v4-flash"

        else:
            raise ValueError(f"지원하지 않는 프로바이더입니다: {provider}")

    def _call(self, prompt: str, temperature: float = 0.1) -> str:
        if self.provider == "gemini":
            response = self._gemini_model.generate_content(prompt)
            return response.text
        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": prompt},
            ],
            temperature=temperature,
        )
        return response.choices[0].message.content

    def translate_chunk(self, chunk: str, part: int, total: int) -> str:
        prompt = (
            f"다음은 번역할 문서의 Part {part} / {total}입니다. "
            f"주어진 지시사항에 따라 번역하십시오.\n\n{chunk}"
        )
        return self._call(prompt).strip()

    def generate_qna(self, full_content: str) -> str:
        prompt = QNA_PROMPT.format(document_content=full_content[:15000])
        if self.provider == "gemini":
            response = self._gemini_model.generate_content(prompt)
            return response.text
        response = self.client.chat.completions.create(
            model=self.model_name,
            messages=[
                {"role": "system", "content": "You are a professional educational content designer."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )
        return response.choices[0].message.content


def split_into_chunks(text: str, max_lines: int = 500) -> list[str]:
    """Split text into chunks of ~max_lines, respecting paragraph boundaries."""
    lines = text.split("\n")
    chunks = []
    start = 0
    while start < len(lines):
        end = min(start + max_lines, len(lines))
        if end < len(lines):
            for i in range(end, start, -1):
                if i >= len(lines):
                    continue
                if lines[i].strip() == "":
                    end = i
                    break
        if end == start:
            chunks.append("\n".join(lines[start:]).strip())
            break
        chunk_text = "\n".join(lines[start:end]).strip()
        if chunk_text:
            chunks.append(chunk_text)
        start = end
    return chunks


def main():
    parser = argparse.ArgumentParser(description="Markdown batch translator")
    parser.add_argument("--input-dir", required=True, help="Directory containing original .md files")
    parser.add_argument("--provider", default="opencode", choices=["gemini", "openai", "opencode"],
                        help="API provider to use")
    parser.add_argument("--model", help="Specific model name (e.g. deepseek-v4-flash, gpt-4o)")
    parser.add_argument("--max-lines", type=int, default=500, help="Max lines per chunk")
    parser.add_argument("--workers", type=int, default=4, help="Max parallel workers")
    args = parser.parse_args()

    input_path = Path(args.input_dir)
    if not input_path.exists() or not input_path.is_dir():
        print(f"Error: Directory {args.input_dir} does not exist.")
        sys.exit(1)

    try:
        client = TranslatorClient(provider=args.provider, model_name=args.model)
    except Exception as e:
        print(f"Error initializing API client: {e}")
        sys.exit(1)

    md_files = [f for f in input_path.glob("*.md")
                if not f.name.endswith(".en-ko.md") and not f.name.endswith("_translated.md")]
    md_files.sort()

    if not md_files:
        print("No markdown files found to translate.")
        return

    print(f"Found {len(md_files)} files to translate.")

    for file_path in md_files:
        output_file = file_path.with_name(f"{file_path.stem}.en-ko.md")
        print(f"\nProcessing: {file_path.name} -> {output_file.name}")

        content = file_path.read_text(encoding="utf-8")
        chunks = split_into_chunks(content, max_lines=args.max_lines)
        print(f"Split into {len(chunks)} chunks (~{args.max_lines} lines each)")

        translated_chunks = [None] * len(chunks)
        with ThreadPoolExecutor(max_workers=min(len(chunks), args.workers)) as executor:
            future_map = {}
            for i, chunk in enumerate(chunks):
                future = executor.submit(client.translate_chunk, chunk, i + 1, len(chunks))
                future_map[future] = i
            for future in as_completed(future_map):
                idx = future_map[future]
                try:
                    translated_chunks[idx] = future.result()
                    print(f"  [chunk {idx + 1}/{len(chunks)}] Done")
                except Exception as e:
                    print(f"  [chunk {idx + 1}/{len(chunks)}] Error: {e}")
                    translated_chunks[idx] = f"\n{chunks[idx]}\n\n*[Chunk {idx + 1} Translation Failed]*\n"

        print("  Generating Q&A...")
        try:
            qna = client.generate_qna(content)
        except Exception as e:
            print(f"  Error generating Q&A: {e}")
            qna = "\n# 복습용 질문 및 답변 (10문항)\n\n(Q&A Generation Failed)"

        full = "\n\n---\n\n".join(translated_chunks) + "\n\n---\n\n" + qna
        output_file.write_text(full, encoding="utf-8")
        print(f"Saved: {output_file.name}")

    print("\nAll translations complete!")


if __name__ == "__main__":
    main()
