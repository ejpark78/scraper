"""PDF ebook processor — split chapters and convert to markdown.

Usage:
    uv run python process.py                          # process all PDFs in ./data
    uv run python process.py --data ./pdfs --output ./docs
    uv run python process.py --analyze data/new_book.pdf
    uv run python process.py --config data/new_book.profile.json

Dependencies: pymupdf (fitz)
"""

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import fitz


# ═══════════════════════════════════════════════════════════════
# Data Classes
# ═══════════════════════════════════════════════════════════════

@dataclass
class ChapterDef:
    title: str
    start_page: int
    end_page: int
    include: bool = True


@dataclass
class BookProfile:
    path: Path
    title: str
    page_count: int
    chapters: list[ChapterDef] = field(default_factory=list)
    body_font_size: float = 11.0


@dataclass
class Block:
    y0: float
    block_type: str
    content: str
    bbox: tuple = (0.0, 0.0, 0.0, 0.0)


# ═══════════════════════════════════════════════════════════════
# Configuration — PDF별 챕터 정의 (start, end: 1-based, end exclusive)
# ═══════════════════════════════════════════════════════════════

EXCLUDE_TITLES = [
    "cover", "copyright", "table of contents", "contents",
    "index", "about the author", "about the authors", "colophon",
    "foreword",
]

BOOK_CONFIG: dict[str, dict] = {
    "AI Engineering.pdf": {
        "chapters": [
            ("Chapter 1. Introduction to Building AI Applications with Foundation Models", 25, 73),
            ("Chapter 2. Understanding Foundation Models", 73, 137),
            ("Chapter 3. Evaluation Methodology", 137, 183),
            ("Chapter 4. Evaluate AI Systems", 183, 235),
            ("Chapter 5. Prompt Engineering", 235, 277),
            ("Chapter 6. RAG and Agents", 277, 331),
            ("Chapter 7. Finetuning", 331, 387),
            ("Chapter 8. Dataset Engineering", 387, 429),
            ("Chapter 9. Inference Optimization", 429, 473),
            ("Chapter 10. AI Engineering Architecture and User Feedback", 473, 519),
            ("Epilogue", 519, 521),
        ],
    },
    "AI-Assisted Programming - Tom Taulli.pdf": {
        "chapters": [
            ("Chapter 1. New World for Developers", 21, 41),
            ("Chapter 2. How AI Coding Technology Works", 41, 63),
            ("Chapter 3. Prompt Engineering", 63, 81),
            ("Chapter 4. GitHub Copilot", 81, 103),
            ("Chapter 5. Other AI-Assisted Programming Tools", 103, 123),
            ("Chapter 6. ChatGPT and Other General-Purpose LLMs", 123, 151),
            ("Chapter 7. Ideas, Planning, and Requirements", 151, 173),
            ("Chapter 8. Coding", 173, 199),
            ("Chapter 9. Debugging, Testing, and Deployment", 199, 213),
            ("Chapter 10. Takeaways", 213, 225),
        ],
    },
    "Beyond Vibe Coding - Addy Osmani.pdf": {
        "chapters": [
            ("Preface", 5, 13),
            ("1. Introduction: What Is Vibe Coding?", 13, 66),
            ("2. The Art of the Prompt: Communicating Effectively with AI", 66, 102),
            ("3. The 70% Problem: AI-Assisted Workflows That Actually Work", 102, 121),
            ("4. Beyond the 70%: Maximizing Human Contribution", 121, 143),
            ("5. Understanding Generated Code: Review, Refine, Own", 143, 157),
            ("6. AI-Driven Prototyping: Tools and Techniques", 157, 174),
            ("7. Building Web Applications with AI", 174, 202),
            ("8. Security, Maintainability, and Reliability", 202, 244),
            ("9. The Ethical Implications of Vibe Coding", 244, 266),
            ("10. Autonomous Background Coding Agents", 266, 292),
            ("11. Beyond Code Generation: The Future of AI-Augmented Development", 292, 387),
        ],
    },
    "Building Applications with AI Agents.pdf": {
        "chapters": [
            ("Chapter 1. Introduction to Agents", 23, 39),
            ("Chapter 2. Designing Agent Systems", 39, 63),
            ("Chapter 3. User Experience Design for Agentic Systems", 63, 93),
            ("Chapter 4. Tool Use", 93, 111),
            ("Chapter 5. Orchestration", 111, 137),
            ("Chapter 6. Knowledge and Memory", 137, 157),
            ("Chapter 7. Learning in Agentic Systems", 157, 185),
            ("Chapter 8. From One Agent to Many", 185, 227),
            ("Chapter 9. Validation and Measurement", 227, 245),
            ("Chapter 10. Monitoring in Production", 245, 265),
            ("Chapter 11. Improvement Loops", 265, 293),
            ("Chapter 12. Protecting Agentic Systems", 293, 319),
            ("Chapter 13. Human-Agent Collaboration", 319, 337),
            ("Glossary", 337, 355),
        ],
    },
    "Generative AI on Kubernetes.pdf": {
        "chapters": [
            ("Introduction", 21, 37),
            ("Part I. Inference", 37, 115),
            ("Part II. Production Readiness", 115, 213),
            ("Part III. Tuning", 213, 295),
            ("Part IV. AI-Driven Apps", 295, 404),
        ],
    },
    "Learning LangChain.pdf": {
        "chapters": [
            ("Chapter 1. LLM Fundamentals with LangChain", 29, 51),
            ("Chapter 2. RAG Part I: Indexing Your Data", 51, 85),
            ("Chapter 3. RAG Part II: Chatting with Your Data", 85, 123),
            ("Chapter 4. Using LangGraph to Add Memory to Your Chatbot", 123, 143),
            ("Chapter 5. Cognitive Architectures with LangGraph", 143, 163),
            ("Chapter 6. Agent Architecture", 163, 183),
            ("Chapter 7. Agents II", 183, 199),
            ("Chapter 8. Patterns to Make the Most of LLMs", 199, 219),
            ("Chapter 9. Deployment: Launching Your AI Application into Production", 219, 243),
            ("Chapter 10. Testing: Evaluation, Monitoring, and Continuous Improvement", 243, 279),
            ("Chapter 11. Building with LLMs", 279, 297),
        ],
    },
    "simplicity - Dave Thomas.pdf": {
        "chapters": [
            ("1. An Approach to Simplicity", 16, 19),
            ("Part I. Simplify What You Do Simplify How You Do It", 19, 73),
            ("Part II. Simplify Your Environment", 73, 111),
            ("Part III. Simplify Your Interactions", 111, 140),
            ("Part IV. Simplify Your Code", 140, 190),
        ],
    },
}


# ═══════════════════════════════════════════════════════════════
# Utility Functions
# ═══════════════════════════════════════════════════════════════

def sanitize_filename(name: str) -> str:
    name = re.sub(r'[\\/:*?"<>|]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name[:120]


def get_book_title(pdf_name: str) -> str:
    name = pdf_name.replace('.pdf', '')
    name = re.sub(r'\s*[-–—]\s*(Tom Taulli|Addy Osmani|Dave Thomas).*$', '', name)
    return name.strip()


# ═══════════════════════════════════════════════════════════════
# TextCleaner
# ═══════════════════════════════════════════════════════════════

class TextCleaner:
    """Clean extracted text: fix line breaks, detect headings, remove markers."""

    @staticmethod
    def fix_linebreaks(text: str) -> str:
        if not text:
            return text

        text = text.replace('\u00ad', '')
        text = text.replace('\u2010', '-')
        text = text.replace('\u2011', '-')

        lines = text.split('\n')
        fixed = []
        buffer = []

        for line in lines:
            stripped = line.rstrip()
            if not stripped:
                if buffer:
                    fixed.append(''.join(buffer))
                    buffer = []
                fixed.append('')
                continue

            if buffer and buffer[-1].endswith('-') and stripped and stripped[0].islower():
                buffer[-1] = buffer[-1][:-1] + stripped
                continue

            if (buffer and buffer[-1]
                    and buffer[-1][-1] in 'abcdefghijklmnopqrstuvwxyz,;:'
                    and stripped
                    and stripped[0].islower()):
                buffer[-1] = buffer[-1] + ' ' + stripped
                continue

            buffer.append(stripped)

        if buffer:
            fixed.append(''.join(buffer))

        result = '\n'.join(fixed)

        result = re.sub(r'([a-z])([A-Z]{2,})([a-z])', r'\1 \2\3', result)
        result = re.sub(r'([a-z])(AI|ML)(?=\s|[.,;:!?)])', r'\1 \2', result)
        result = re.sub(r'([a-z])(\d)', r'\1 \2', result)
        result = re.sub(r'(\d)([A-Z][a-z])', r'\1 \2', result)
        result = re.sub(r'\.([A-Z])', r'. \1', result)

        return result

    @staticmethod
    def detect_heading(text: str, avg_font_size: float, body_size: float) -> str:
        text = text.strip()
        if not text or text.startswith('#'):
            return text
        diff = avg_font_size - body_size
        if diff >= 6:
            return '# ' + text
        elif diff >= 4:
            return '## ' + text
        elif diff >= 2:
            return '### ' + text
        return text

    @staticmethod
    def is_page_number(y0: float, y1: float, page_h: float, text: str) -> bool:
        stripped = text.strip()
        if not stripped:
            return False

        margin_y = page_h * 0.06

        in_margin = y1 > page_h - margin_y or y0 < margin_y

        if in_margin and stripped.isdigit() and len(stripped) <= 4:
            return True

        if in_margin and re.match(r'^[—\-–]\s*\d+\s*[—\-–]$', stripped):
            return True

        if re.match(r'^\d+\s*\|.*$', stripped) or re.match(r'^\|\s*\d+$', stripped):
            return True

        if re.match(r'^\d+\s*\|?\s*(Chapter|PART)\s', stripped):
            return True

        return False

    @staticmethod
    def is_chapter_header(text: str, y0: float, page_h: float) -> bool:
        stripped = text.strip()
        if y0 < page_h * 0.08:
            if re.match(r'^(Chapter|Part|CHAPTER)\b', stripped):
                return True
            if re.match(r'^//', stripped):
                return True
        return False

    @staticmethod
    def extract_block_text(block: dict) -> str:
        lines_text = []
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans:
                continue
            line_parts = []
            prev_end = None
            for span in spans:
                text = span.get("text", "")
                if not text:
                    continue
                bbox = span.get("bbox", None)
                if prev_end is not None and bbox:
                    gap = bbox[0] - prev_end
                    font_size = span.get("size", 10)
                    if gap > font_size * 0.7:
                        line_parts.append(" " + text)
                    else:
                        line_parts.append(text)
                else:
                    line_parts.append(text)
                if bbox:
                    prev_end = bbox[2]
            lines_text.append("".join(line_parts))
        return "\n".join(lines_text)

    @staticmethod
    def get_avg_font_size(block: dict) -> float:
        sizes = []
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                sizes.append(span.get("size", 0))
        if not sizes:
            return 0.0
        return sum(sizes) / len(sizes)

    @staticmethod
    def is_mostly_uppercase(text: str) -> bool:
        letters = [c for c in text if c.isalpha()]
        if not letters:
            return False
        upper = sum(1 for c in letters if c.isupper())
        return upper / len(letters) > 0.7


# ═══════════════════════════════════════════════════════════════
# ColumnDetector
# ═══════════════════════════════════════════════════════════════

class ColumnDetector:
    """Detect multi-column layout and return blocks in reading order."""

    @staticmethod
    def sort_blocks(blocks: list[dict], page_width: float) -> list[dict]:
        if not blocks:
            return blocks

        x0s = sorted(set(round(b["bbox"][0], -1) for b in blocks if b.get("bbox")))
        clusters = []
        for x0 in x0s:
            if not clusters or abs(x0 - clusters[-1]) > 30:
                clusters.append(x0)

        if len(clusters) <= 1:
            return sorted(blocks, key=lambda b: (b["bbox"][1], b["bbox"][0]))

        col_blocks: list[list[dict]] = [[] for _ in clusters]
        for b in blocks:
            bx0 = b["bbox"][0]
            idx = min(range(len(clusters)), key=lambda i: abs(clusters[i] - bx0))
            col_blocks[idx].append(b)

        result = []
        for col_idx in range(len(clusters)):
            col_blocks[col_idx].sort(key=lambda b: b["bbox"][1])
            result.extend(col_blocks[col_idx])

        return result


# ═══════════════════════════════════════════════════════════════
# ImageRenderer
# ═══════════════════════════════════════════════════════════════

class ImageRenderer:
    """Render specific page regions (tables, images) to PNG."""

    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.images_dir = self.output_dir / "images"
        self.images_dir.mkdir(parents=True, exist_ok=True)

    def render_region(self, page: fitz.Page, bbox: tuple, prefix: str,
                      page_no: int, idx: int, padding: int = 5) -> str:
        x0, y0, x1, y1 = bbox
        clip = fitz.Rect(x0 - padding, y0 - padding, x1 + padding, y1 + padding)
        clip = clip & page.rect

        pix = page.get_pixmap(clip=clip, dpi=150)
        filename = f"{prefix}_p{page_no:03d}_{idx:03d}.png"
        filepath = self.images_dir / filename
        pix.save(str(filepath))

        return f"images/{filename}"

    def render_table(self, page: fitz.Page, bbox: tuple,
                     page_no: int, idx: int) -> str:
        return self.render_region(page, bbox, "table", page_no, idx, padding=10)

    def render_image(self, page: fitz.Page, bbox: tuple,
                     page_no: int, idx: int) -> str:
        return self.render_region(page, bbox, "img", page_no, idx, padding=5)

    def render_full_page(self, page: fitz.Page, page_no: int) -> str:
        pix = page.get_pixmap(dpi=150)
        filename = f"page_p{page_no:03d}.png"
        filepath = self.images_dir / filename
        pix.save(str(filepath))
        return f"images/{filename}"


# ═══════════════════════════════════════════════════════════════
# PDFAnalyzer
# ═══════════════════════════════════════════════════════════════

class PDFAnalyzer:
    """Analyze a new PDF, extract TOC, and interactively build BookProfile."""

    def analyze(self, pdf_path: str) -> BookProfile:
        path = Path(pdf_path)
        if not path.exists():
            print(f"File not found: {pdf_path}")
            sys.exit(1)

        doc = fitz.open(str(path))

        profile = BookProfile(
            path=path,
            title=path.name,
            page_count=doc.page_count,
        )

        print(f"\n{'=' * 60}")
        print(f"  Analyzing: {path.name} ({doc.page_count}p)")
        print(f"{'=' * 60}\n")

        toc = doc.get_toc()
        if not toc:
            print("No TOC found. Running regex-based chapter detection...")
            chapters = self._detect_chapters_regex(doc)
        else:
            has_part = any("part" in e[1].lower() for e in toc if e[0] == 1)
            if has_part:
                print(f"TOC found ({len(toc)} entries). Part structure detected — showing chapters:\n")
                chapters = self._build_part_chapters(toc, doc.page_count)
            else:
                print(f"TOC found ({len(toc)} entries). Level-1 chapters:\n")
                chapters = self._build_from_toc(toc, doc.page_count)

        header = f"{'':>3} {'Title':60s} {'Pages':>10s}  {'Include?'}"
        print(header)
        print("-" * 85)

        profile.chapters = []
        for i, (title, start, end, default) in enumerate(chapters):
            is_excluded = any(ex.lower() in title.lower() for ex in EXCLUDE_TITLES)
            default_include = default and not is_excluded
            default_label = "Y" if default_include else "n"

            label = f"  [{i+1:2d}]"
            pages_str = f"p.{start:3d}-{end-1:<3d}"
            prompt = f" include? [{default_label}] (ENTER=default, n=skip, q=quit): "

            ans = input(f"  {label} {title:60s} {pages_str}  {prompt}").strip().lower()

            if ans == '' or ans == 'y':
                include = default_include
            elif ans == 'n':
                include = False
            elif ans == 'q':
                print("Aborted.")
                sys.exit(0)
            else:
                include = True

            profile.chapters.append(ChapterDef(
                title=title,
                start_page=start,
                end_page=end - 1,
                include=include,
            ))

        self._verify_offsets(doc, profile)
        profile.body_font_size = self._estimate_body_font(doc)
        doc.close()

        # books.json 에 저장
        self._save_books_config(profile)
        print(f"\nSaved to books.json")
        print(f"Estimated body font size: {profile.body_font_size:.1f}pt")

        return profile

    def _build_part_chapters(self, toc: list, total_pages: int) -> list:
        level1 = [e for e in toc if e[0] == 1]
        result = []
        for i, entry in enumerate(level1):
            level, title, page = entry
            next_l1_page = total_pages
            for j in range(i + 1, len(level1)):
                if level1[j][2] > page:
                    next_l1_page = level1[j][2]
                    break

            is_part = "part" in title.lower()

            if is_part:
                part_children = []
                for e in toc:
                    if e[0] != 2:
                        continue
                    if e[2] >= page and e[2] < next_l1_page:
                        part_children.append(e)

                if part_children:
                    m = re.search(r'(Part|PART)\s+([IVXLCDM]+|\d+)', title)
                    part_prefix = f"Part {m.group(2)}" if m else title.split(".")[0].strip()

                    for ci, (_, ch_title, ch_page) in enumerate(part_children):
                        ch_end = next_l1_page
                        if ci + 1 < len(part_children):
                            ch_end = part_children[ci + 1][2]
                        full_title = f"{part_prefix} - {ch_title}"
                        is_excluded = any(ex.lower() in ch_title.lower() for ex in EXCLUDE_TITLES)
                        result.append((full_title, ch_page, ch_end, not is_excluded))
                else:
                    is_excluded = any(ex.lower() in title.lower() for ex in EXCLUDE_TITLES)
                    result.append((title, page, next_l1_page, not is_excluded))
            else:
                is_excluded = any(ex.lower() in title.lower() for ex in EXCLUDE_TITLES)
                result.append((title, page, next_l1_page, not is_excluded))

        return result

    def _build_from_toc(self, toc: list, total_pages: int) -> list:
        chapters = []
        for i, entry in enumerate(toc):
            level, title, page = entry
            if level != 1:
                continue
            next_page = total_pages
            for j in range(i + 1, len(toc)):
                if toc[j][0] <= level:
                    next_page = toc[j][2]
                    break
            chapters.append((title, page, next_page, True))
        return chapters

    def _detect_chapters_regex(self, doc: fitz.Document) -> list:
        chapters = []
        for i in range(doc.page_count):
            page = doc[i]
            text = page.get_text("text")
            m = re.search(
                r'^(?:Chapter|CHAPTER|Part|PART)\s+(\d+|[IVXLCDM]+)[\.\s]',
                text, re.MULTILINE
            )
            if m:
                next_p = doc.page_count
                for j in range(i + 1, doc.page_count):
                    p2 = doc[j]
                    t2 = p2.get_text("text")
                    if re.search(r'^(?:Chapter|CHAPTER|Part|PART)\s+', t2, re.MULTILINE):
                        next_p = j + 1
                        break
                chapters.append((m.group(0).strip(), i + 1, next_p, True))
        return chapters

    def _verify_offsets(self, doc: fitz.Document, profile: BookProfile):
        print("\n--- Offset Verification ---")
        any_offset = False
        for ch in profile.chapters:
            if not ch.include:
                continue
            offset = self._find_offset(doc, ch)
            if offset != 0:
                any_offset = True
                print(f"  '{ch.title[:50]}' p.{ch.start_page} → actual p.{ch.start_page + offset}")
                fix = input(f"    Apply offset {offset:+d}? [y/N] ").strip().lower()
                if fix.startswith('y'):
                    ch.start_page += offset
                    ch.end_page += offset
        if not any_offset:
            print("  All chapter titles verified (no offset).")

    def _find_offset(self, doc: fitz.Document, ch: ChapterDef) -> int:
        page_idx = ch.start_page - 1
        title_key = ch.title[:40].strip().lower()
        for offset in range(-2, 4):
            pg = page_idx + offset
            if pg < 0 or pg >= doc.page_count:
                continue
            text = doc[pg].get_text("text").lower()
            if title_key in text:
                return offset
        return 0

    def _estimate_body_font(self, doc: fitz.Document) -> float:
        sizes = []
        for pg_idx in [10, 30, 50, 80, 100]:
            if pg_idx >= doc.page_count:
                continue
            page = doc[pg_idx]
            blocks = page.get_text("dict")["blocks"]
            for block in blocks:
                if block.get("type") != 0:
                    continue
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        s = span.get("size", 0)
                        if 8 < s < 16:
                            sizes.append(s)
        if not sizes:
            return 11.0
        sizes.sort()
        return sizes[len(sizes) // 2]

    def _save_profile(self, profile: BookProfile, path: str):
        data = {
            "title": profile.title,
            "page_count": profile.page_count,
            "body_font_size": profile.body_font_size,
            "chapters": [
                {"title": c.title, "start_page": c.start_page,
                 "end_page": c.end_page, "include": c.include}
                for c in profile.chapters
            ],
        }
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _save_books_config(self, profile: BookProfile):
        books_path = Path("books.json")
        config = {}
        if books_path.exists():
            with open(str(books_path), 'r', encoding='utf-8') as f:
                config = json.load(f)

        pdf_name = profile.path.name
        existing = config.get(pdf_name)
        if existing:
            ans = input(f"  Config for '{pdf_name}' already exists in books.json. Overwrite? [y/N] ").strip().lower()
            if not ans.startswith('y'):
                print("  Skipped saving to books.json.")
                return

        chapters = []
        for ch in profile.chapters:
            if not ch.include:
                continue
            chapters.append({
                "title": ch.title,
                "start": ch.start_page,
                "end": ch.end_page + 1,
            })

        config[pdf_name] = {"chapters": chapters}

        tmp = books_path.with_suffix('.json.tmp')
        with open(str(tmp), 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        tmp.rename(books_path)


# ═══════════════════════════════════════════════════════════════
# ChapterSplitter
# ═══════════════════════════════════════════════════════════════

class ChapterSplitter:
    """Split a PDF into chapter-level PDF files."""

    def __init__(self, data_dir: str, output_dir: str):
        self.data_dir = Path(data_dir)
        self.output_dir = Path(output_dir)

    def split(self, pdf_name: str, profile: BookProfile) -> list[Path]:
        pdf_path = self.data_dir / pdf_name
        if not pdf_path.exists():
            print(f"  ✗ File not found: {pdf_path}")
            return []

        book_dir = self.output_dir / get_book_title(pdf_name)
        book_dir.mkdir(parents=True, exist_ok=True)

        doc = fitz.open(str(pdf_path))
        chapter_paths = []

        for ch in profile.chapters:
            if not ch.include:
                continue

            title_clean = sanitize_filename(ch.title)
            ch_filename = f"{title_clean}.pdf"
            ch_path = book_dir / ch_filename

            from_p = ch.start_page - 1
            to_p = ch.end_page - 1

            if from_p < 0:
                from_p = 0
            if to_p >= doc.page_count:
                to_p = doc.page_count - 1
            if from_p > to_p:
                print(f"  ✗ Invalid range for '{ch.title}': {ch.start_page}–{ch.end_page}")
                continue

            new_doc = fitz.open()
            new_doc.insert_pdf(doc, from_page=from_p, to_page=to_p)
            new_doc.save(str(ch_path))
            new_doc.close()

            chapter_paths.append(ch_path)
            print(f"  ✓ {ch_filename}")

        doc.close()
        return chapter_paths


# ═══════════════════════════════════════════════════════════════
# ChapterConverter
# ═══════════════════════════════════════════════════════════════

class ChapterConverter:
    """Convert a chapter PDF to a single .md file with embedded images."""

    def __init__(self, output_dir: str, body_font_size: float = 11.0):
        self.output_dir = Path(output_dir)
        self.body_font_size = body_font_size
        self.image_renderer = ImageRenderer(output_dir)
        self.text_cleaner = TextCleaner()

    def convert(self, chapter_pdf: Path) -> Path:
        doc = fitz.open(str(chapter_pdf))
        md_lines = []

        for page_no in range(doc.page_count):
            page = doc[page_no]
            page_md = self._process_page(page, page_no + 1)
            if page_md.strip():
                md_lines.append(page_md)

        doc.close()

        md_text = '\n\n'.join(md_lines)
        md_path = chapter_pdf.with_suffix('.md')
        with open(str(md_path), 'w', encoding='utf-8') as f:
            f.write(md_text)

        return md_path

    def _process_page(self, page: fitz.Page, page_no: int) -> str:
        page_h = page.rect.height
        page_w = page.rect.width

        table_bboxes = []
        try:
            tables = page.find_tables()
            for t in tables.tables:
                table_bboxes.append(t.bbox)
        except Exception:
            pass

        image_bboxes = []
        try:
            for img in page.get_images():
                bbox = page.get_image_bbox(img)
                if bbox and bbox.width > 15 and bbox.height > 15:
                    image_bboxes.append(bbox)
        except Exception:
            pass

        blocks = page.get_text("dict")["blocks"]
        text_blocks = [b for b in blocks if b.get("type") == 0]

        filtered = []
        for tb in text_blocks:
            tb_bbox = tb["bbox"]
            skip = False
            for table_bbox in table_bboxes:
                if self._bbox_overlap(tb_bbox, table_bbox) > 0.4:
                    skip = True
                    break
            if not skip:
                filtered.append(tb)

        sorted_blocks = ColumnDetector.sort_blocks(filtered, page_w)

        content_blocks: list[tuple[float, str, str]] = []

        for block in sorted_blocks:
            text = self.text_cleaner.extract_block_text(block)
            if not text.strip():
                continue

            y0 = block["bbox"][1]
            y1 = block["bbox"][3]

            if self.text_cleaner.is_page_number(y0, y1, page_h, text):
                continue
            if self.text_cleaner.is_chapter_header(text, y0, page_h):
                if len(text) < 80:
                    continue

            avg_font = self.text_cleaner.get_avg_font_size(block)

            if self.text_cleaner.is_mostly_uppercase(text) and len(text) < 100:
                text = f"## {text}"
            else:
                text = self.text_cleaner.detect_heading(text, avg_font, self.body_font_size)

            text = self.text_cleaner.fix_linebreaks(text)
            content_blocks.append((y0, "text", text))

        for i, t_bbox in enumerate(table_bboxes):
            try:
                rel_path = self.image_renderer.render_table(page, t_bbox, page_no, i)
                content_blocks.append((t_bbox[1], "table", f"![Table]({rel_path})"))
            except Exception:
                pass

        for i, i_bbox in enumerate(image_bboxes):
            try:
                rel_path = self.image_renderer.render_image(page, i_bbox, page_no, i)
                content_blocks.append((i_bbox[1], "image", f"![]({rel_path})"))
            except Exception:
                pass

        if not content_blocks:
            try:
                rel_path = self.image_renderer.render_full_page(page, page_no)
                return f"![]({rel_path})"
            except Exception:
                return ""

        content_blocks.sort(key=lambda x: x[0])

        page_md_lines = []
        for _, type_, content in content_blocks:
            page_md_lines.append(content)

        return '\n\n'.join(page_md_lines)

    @staticmethod
    def _bbox_overlap(bbox1: tuple, bbox2: tuple) -> float:
        x0 = max(bbox1[0], bbox2[0])
        y0 = max(bbox1[1], bbox2[1])
        x1 = min(bbox1[2], bbox2[2])
        y1 = min(bbox1[3], bbox2[3])

        if x1 <= x0 or y1 <= y0:
            return 0.0

        overlap = (x1 - x0) * (y1 - y0)
        area1 = (bbox1[2] - bbox1[0]) * (bbox1[3] - bbox1[1])
        if area1 == 0:
            return 0.0
        return overlap / area1


# ═══════════════════════════════════════════════════════════════
# Pipeline
# ═══════════════════════════════════════════════════════════════

class Pipeline:
    """Orchestrate the full split → convert workflow."""

    def __init__(self, data_dir: str, output_dir: str):
        self.data_dir = Path(data_dir)
        self.output_dir = Path(output_dir)

    def run_all(self):
        pdf_files = sorted(self.data_dir.glob("*.pdf"))
        if not pdf_files:
            print(f"No PDF files found in {self.data_dir}")
            return

        print(f"Found {len(pdf_files)} PDF(s) in {self.data_dir}\n")
        for pdf_path in pdf_files:
            self.run_single(pdf_path.name)
            print()

    def run_single(self, pdf_name: str, profile: Optional[BookProfile] = None):
        print(f"{'=' * 60}")
        print(f"  Processing: {pdf_name}")
        print(f"{'=' * 60}")

        if profile is None:
            profile = self._load_profile(pdf_name)

        if profile is None:
            print(f"  Skipped. Use --analyze to configure: {pdf_name}")
            return

        print(f"\n[Phase 1] Splitting chapters...")
        splitter = ChapterSplitter(str(self.data_dir), str(self.output_dir))
        chapter_paths = splitter.split(pdf_name, profile)

        if not chapter_paths:
            print("  No chapters to process.")
            return

        print(f"\n[Phase 2] Converting to Markdown...")
        book_dir = self.output_dir / get_book_title(pdf_name)
        converter = ChapterConverter(
            str(book_dir),
            body_font_size=profile.body_font_size,
        )

        for ch_path in chapter_paths:
            try:
                md_path = converter.convert(ch_path)
                print(f"  ✓ {md_path.name}")
            except Exception as e:
                print(f"  ✗ {ch_path.name}: {e}")

        print(f"\nDone: {pdf_name} → {book_dir}")

    @staticmethod
    def _load_books_config() -> dict:
        config = {}
        books_path = Path("books.json")
        if books_path.exists():
            with open(str(books_path), 'r', encoding='utf-8') as f:
                config = json.load(f)
        return config

    def _load_profile(self, pdf_name: str) -> Optional[BookProfile]:
        pdf_path = self.data_dir / pdf_name

        # 1. .profile.json (per-book override, highest priority)
        profile_path = pdf_path.with_suffix('.profile.json')
        if profile_path.exists():
            with open(str(profile_path), 'r', encoding='utf-8') as f:
                data = json.load(f)
            return BookProfile(
                path=pdf_path,
                title=data.get("title", pdf_name),
                page_count=data.get("page_count", 0),
                chapters=[ChapterDef(**ch) for ch in data["chapters"]],
                body_font_size=data.get("body_font_size", 11.0),
            )

        # 2. books.json (shared config)
        books_config = self._load_books_config()
        entry = books_config.get(pdf_name)
        if entry is not None:
            chapters = []
            for ch in entry.get("chapters", []):
                chapters.append(ChapterDef(
                    title=ch["title"],
                    start_page=ch["start"],
                    end_page=ch["end"] - 1,
                    include=True,
                ))
            doc = fitz.open(str(pdf_path))
            body_font = PDFAnalyzer()._estimate_body_font(doc)
            doc.close()
            return BookProfile(
                path=pdf_path,
                title=pdf_name,
                page_count=0,
                chapters=chapters,
                body_font_size=body_font,
            )

        # 3. BOOK_CONFIG (legacy fallback)
        config = BOOK_CONFIG.get(pdf_name)
        if config is None:
            return None

        chapters = []
        for title, start, end in config.get("chapters", []):
            chapters.append(ChapterDef(
                title=title,
                start_page=start,
                end_page=end - 1,
                include=True,
            ))

        doc = fitz.open(str(pdf_path))
        body_font = PDFAnalyzer()._estimate_body_font(doc)
        doc.close()

        return BookProfile(
            path=pdf_path,
            title=pdf_name,
            page_count=0,
            chapters=chapters,
            body_font_size=body_font,
        )


# ═══════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="PDF ebook processor — split chapters and convert to markdown",
    )
    parser.add_argument(
        '--data', '-d',
        type=str,
        default='data',
        help='Path to directory containing PDF files (default: ./data)',
    )
    parser.add_argument(
        '--output', '-o',
        type=str,
        default='output',
        help='Path to output directory (default: ./output)',
    )
    parser.add_argument(
        '--analyze', '-a',
        type=str,
        default=None,
        metavar='PDF_PATH',
        help='Analyze a new PDF interactively and create its profile',
    )
    parser.add_argument(
        '--config', '-c',
        type=str,
        default=None,
        metavar='JSON_PATH',
        help='Use a specific profile JSON file for processing',
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if args.analyze:
        analyzer = PDFAnalyzer()
        analyzer.analyze(args.analyze)
        return

    if args.config:
        config_path = Path(args.config)
        if not config_path.exists():
            print(f"Config file not found: {args.config}")
            sys.exit(1)

        with open(str(config_path), 'r', encoding='utf-8') as f:
            data = json.load(f)

        pdf_name = data.get("title", config_path.stem)
        if not pdf_name.endswith('.pdf'):
            pdf_name += '.pdf'

        profile = BookProfile(
            path=Path(pdf_name),
            title=pdf_name,
            page_count=data.get("page_count", 0),
            chapters=[ChapterDef(**ch) for ch in data["chapters"]],
            body_font_size=data.get("body_font_size", 11.0),
        )

        pipeline = Pipeline(args.data, args.output)
        pipeline.run_single(pdf_name, profile)
        return

    pipeline = Pipeline(args.data, args.output)
    pipeline.run_all()


if __name__ == "__main__":
    main()
