"""split_chapter.py — PDF chapter splitter.

Extracts page ranges from a PDF file to create separate chapter PDF files.
"""

from pathlib import Path
import re
import fitz

# Reuse existing data classes or structure
from dataclasses import dataclass

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
    chapters: list[ChapterDef]
    body_font_size: float = 11.0


def sanitize_filename(name: str) -> str:
    name = re.sub(r'[\\/:*?"<>|]', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name[:120]


def get_book_title(pdf_name: str) -> str:
    name = pdf_name.replace('.pdf', '')
    name = re.sub(r'\s*[-–—]\s*(Tom Taulli|Addy Osmani|Dave Thomas).*$', '', name)
    return name.strip()


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
