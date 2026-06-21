"""pdf_translator.py — Ollama batch translation & summarization utility.

Extracts text from PDF page ranges, translates with Ollama API, writes ko.md outputs.
"""

from pathlib import Path
import re
import json
import time
import urllib.request
import fitz


class PDFTranslator:
    """PDF batch translator using local or remote Ollama models."""

    def __init__(self, ollama_url: str = "http://localhost:11434/api", model: str = "gemma4:31b-cloud", batch_size: int = 20):
        self.ollama_url = ollama_url
        self.model = model
        self.batch_size = batch_size

    def extract_text(self, pdf_path: str, start: int, end: int) -> str:
        doc = fitz.open(pdf_path)
        text = []
        for i in range(start - 1, min(end, len(doc))):
            text.append(doc[i].get_text())
        doc.close()
        return "\n".join(text)

    def split_sentences(self, text: str) -> list[str]:
        raw = re.split(r'(?<=[.!?])\s+', text)
        return [s.strip() for s in raw if len(s.strip()) > 2]

    def call_ollama(self, prompt: str) -> str:
        body = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.05}
        }
        req = urllib.request.Request(
            f"{self.ollama_url}/generate",
            data=json.dumps(body).encode(),
            headers={"Content-Type": "application/json"},
        )
        resp = urllib.request.urlopen(req, timeout=60)
        return json.loads(resp.read()).get("response", "")

    def translate_batch(self, sentences: list[str]) -> list[str]:
        numbered = "\n".join(f"[{i+1}] {s}" for i, s in enumerate(sentences))
        prompt = (
            f"Translate each English sentence to Korean. Keep technical terms (API, LLM, Kubernetes, etc.) as-is.\n"
            f"Respond with the translations ONLY, one per line, numbered [1], [2], etc.\n"
            f"Preserve the exact numbering.\n\n"
            f"{numbered}\n\n"
            f"Translations:"
        )
        raw = self.call_ollama(prompt)
        translations = []
        for line in raw.strip().split("\n"):
            m = re.match(r'^\[\d+\]\s*(.*)', line.strip())
            if m:
                translations.append(m.group(1).strip())
        while len(translations) < len(sentences):
            translations.append("")
        return translations[:len(sentences)]

    def summarize_chapter(self, text: str) -> str:
        prompt = (
            f"Summarize the following English chapter in Korean (3-5 bullets).\n"
            f"Keep technical terms as-is.\n\n{text[:4000]}"
        )
        return self.call_ollama(prompt).strip()

    def translate_pdf(self, pdf_path: str, start: int, end: int, output_base: Path):
        output_base.parent.mkdir(parents=True, exist_ok=True)

        print(f"Extracting pages {start}-{end}...")
        raw_text = self.extract_text(pdf_path, start, end)
        print(f"Extracted {len(raw_text)} chars")

        sents = self.split_sentences(raw_text)
        print(f"Found {len(sents)} sentences (batch size {self.batch_size})")

        ko_path = output_base.parent / (output_base.name + ".ko.md")
        total = len(sents)

        with open(ko_path, "w", encoding="utf-8") as f:
            for batch_start in range(0, total, self.batch_size):
                batch = sents[batch_start:batch_start + self.batch_size]
                batch_num = batch_start // self.batch_size + 1
                total_batches = (total + self.batch_size - 1) // self.batch_size
                print(f"  Batch {batch_num}/{total_batches} (sents {batch_start+1}-{batch_start+len(batch)})...")

                t0 = time.time()
                translations = self.translate_batch(batch)
                elapsed = time.time() - t0

                for i, (orig, trans) in enumerate(zip(batch, translations), 1):
                    idx = batch_start + i
                    f.write(f"### Sentence {idx} / 문장 {idx}\n\n{orig}\n\n{trans}\n\n---\n")
                f.flush()
                print(f"    Done in {elapsed:.1f}s ({elapsed/len(batch):.1f}s/sent)")

        print(f"Saved: {ko_path}")

        print("Generating summary...")
        summary = self.summarize_chapter(raw_text)
        summary_path = output_base.parent / (output_base.name + ".summary.md")
        summary_path.write_text(f"# Summary / 요약\n\n{summary}\n", encoding="utf-8")
        print(f"Saved: {summary_path}")
        print("Translation complete!")
