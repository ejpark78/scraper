"""Ebook processing commands — each mode as an OOP Command class."""

import json
import sys
from abc import ABC, abstractmethod
from argparse import ArgumentParser, Namespace
from pathlib import Path

from .split_chapter import ChapterSplitter, BookProfile, ChapterDef, get_book_title
from .pdf_to_markdown import ChapterConverter
from .pdf_to_html import HTMLConverter
from .html_to_markdown import HTMLToMarkdownConverter
from .pdf_translator import PDFTranslator
from .pdf_analyzer import PDFAnalyzer


# ── Utilities ──────────────────────────────────────────────────────────────

def load_books_config(books_json_path: Path) -> dict:
    if books_json_path.exists():
        with open(str(books_json_path), "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _collect_files(data_dir: str, output_dir: str, suffix: str) -> list[Path]:
    files = []
    for search_dir in [Path(data_dir), Path(output_dir)]:
        if search_dir.exists():
            files.extend(list(search_dir.glob(f"**/*.{suffix}")))
    files = [p for p in files if "raw" not in p.resolve().parts]
    files = list({p.resolve(): p for p in files}.values())
    return files


def _resolve_file_arg(name: str, data_dir: str) -> Path | None:
    p = Path(name)
    if p.exists():
        return p
    alt = Path(data_dir) / name
    if alt.exists():
        return alt
    return None


# ── Base Command ───────────────────────────────────────────────────────────

class EbookCommand(ABC):
    @property
    @abstractmethod
    def flag(self) -> str:
        """Primary argparse attribute name (e.g. 'summary', 'pdf2html')."""

    def add_arguments(self, parser: ArgumentParser) -> None:
        """Register CLI arguments. Override if the command has flags."""

    @abstractmethod
    def execute(self, args: Namespace) -> None:
        """Execute the command and call sys.exit()."""

    def matches(self, args: Namespace) -> bool:
        val = getattr(args, self.flag, None)
        if val is None:
            return False
        if isinstance(val, bool):
            return val
        return True


# ── Summary ────────────────────────────────────────────────────────────────

class SummaryCommand(EbookCommand):
    @property
    def flag(self) -> str:
        return "summary"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--summary", action="store_true",
                            help="Print summary of all PDFs")

    def execute(self, args: Namespace) -> None:
        PDFAnalyzer().dump_all_summaries(args.data)
        sys.exit(0)


# ── Analyze ────────────────────────────────────────────────────────────────

class AnalyzeCommand(EbookCommand):
    @property
    def flag(self) -> str:
        return "analyze"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--analyze",
                            help="Analyze specified PDF structure interactively")

    def execute(self, args: Namespace) -> None:
        PDFAnalyzer().analyze(args.analyze)
        sys.exit(0)


# ── PDF → HTML ─────────────────────────────────────────────────────────────

class Pdf2HtmlCommand(EbookCommand):
    @property
    def flag(self) -> str:
        return "pdf2html"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--pdf2html", nargs="?", const="all",
                            help="Directly convert specified PDF (or all PDFs if empty/all) to HTML")

    def execute(self, args: Namespace) -> None:
        converter = HTMLConverter(args.output)
        raw = args.pdf2html
        if raw == "all" or raw == "":
            pdf_files = _collect_files(args.data, args.output, "pdf")
            if not pdf_files:
                print(f"No PDF files found in {args.data} or {args.output}")
                sys.exit(0)
            for pdf_file in pdf_files:
                print(f"Converting {pdf_file.name} to HTML...")
                converter.convert(pdf_file)
        else:
            pdf_file = _resolve_file_arg(raw, args.data)
            if pdf_file:
                converter.convert(pdf_file)
            else:
                print(f"File not found: {raw}")
                sys.exit(1)
        sys.exit(0)


# ── Translate Markdown ─────────────────────────────────────────────────────

class TranslateCommand(EbookCommand):
    @property
    def flag(self) -> str:
        return "translate_md"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--translate-md",
                            help="Translate PDF path")
        parser.add_argument("--translate-pages",
                            help="Page range for translation (e.g., '10-20')")
        parser.add_argument("--translate-out",
                            help="Output filepath base name")

    def execute(self, args: Namespace) -> None:
        if not args.translate_pages or not args.translate_out:
            print("Error: --translate-md requires both --translate-pages (e.g., '10-20') and --translate-out",
                  file=sys.stderr)
            sys.exit(1)

        try:
            start, end = map(int, args.translate_pages.split("-"))
        except ValueError:
            print("Error: --translate-pages must be in format 'start-end' (e.g. '10-20')",
                  file=sys.stderr)
            sys.exit(1)

        PDFTranslator().translate_pdf(
            args.translate_md, start, end, Path(args.translate_out))
        sys.exit(0)


# ── HTML → Markdown ────────────────────────────────────────────────────────

class Html2MdCommand(EbookCommand):
    @property
    def flag(self) -> str:
        return "html2md"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--html2md", nargs="?", const="all",
                            help="Convert specified HTML (or all HTMLs if empty/all) to Markdown")

    def execute(self, args: Namespace) -> None:
        converter = HTMLToMarkdownConverter(args.output)
        raw = args.html2md
        if raw == "all" or raw == "":
            html_files = _collect_files(args.data, args.output, "html")
            if not html_files:
                print(f"No HTML files found in {args.data} or {args.output}")
                sys.exit(0)
            for html_file in html_files:
                print(f"Converting {html_file.name} to Markdown...")
                converter.convert(html_file)
        else:
            html_file = _resolve_file_arg(raw, args.data)
            if html_file:
                converter.convert(html_file)
            else:
                print(f"File not found: {raw}")
                sys.exit(1)
        sys.exit(0)


# ── Split / PDF → Markdown ─────────────────────────────────────────────────

class SplitOrPdf2MdCommand(EbookCommand):
    @property
    def flag(self) -> str:
        return "split"

    def matches(self, args: Namespace) -> bool:
        return args.split or args.pdf2md

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--split", action="store_true",
                            help="Split PDFs into chapter PDFs")
        parser.add_argument("--pdf2md", action="store_true",
                            help="Convert split chapter PDFs to markdown")

    def execute(self, args: Namespace) -> None:
        data_path = Path(args.data)
        output_path = Path(args.output)
        books_cfg = load_books_config(Path("books.json"))

        pdf_files = list(data_path.glob("*.pdf"))
        if not pdf_files:
            print(f"No PDF files found in {args.data}")
            sys.exit(0)

        splitter = ChapterSplitter(args.data, args.output)

        for pdf in pdf_files:
            pdf_name = pdf.name
            print(f"\nProcessing {pdf_name}...")

            cfg = books_cfg.get(pdf_name)
            if not cfg:
                print(f"  No configuration found for {pdf_name}. Skip.")
                continue

            chapters = []
            for item in cfg["chapters"]:
                if isinstance(item, list) or isinstance(item, tuple):
                    title, start, end = item
                    include = True
                else:
                    title = item["title"]
                    start = item["start"]
                    end = item["end"]
                    include = item.get("include", True)

                chapters.append(ChapterDef(
                    title=title,
                    start_page=start,
                    end_page=end - 1,
                    include=include,
                ))

            profile = BookProfile(
                path=pdf,
                title=get_book_title(pdf_name),
                page_count=0,
                chapters=chapters,
            )

            chapter_pdfs: list[Path] = []
            if args.split:
                print("  Splitting chapters...")
                chapter_pdfs = splitter.split(pdf_name, profile)
            else:
                book_dir = output_path / get_book_title(pdf_name)
                for ch in profile.chapters:
                    if ch.include:
                        ch_path = book_dir / f"{ch.title}.pdf"
                        if ch_path.exists():
                            chapter_pdfs.append(ch_path)

            if args.pdf2md:
                print("  Converting split chapters to markdown...")
                converter = ChapterConverter(output_path)
                for ch_pdf in chapter_pdfs:
                    if ch_pdf.exists():
                        print(f"    Converting {ch_pdf.name}...")
                        converter.convert(ch_pdf)

        sys.exit(0)


# ── Registry (priority ordered: first match wins) ──────────────────────────

COMMANDS: list[EbookCommand] = [
    SummaryCommand(),
    AnalyzeCommand(),
    Pdf2HtmlCommand(),
    TranslateCommand(),
    Html2MdCommand(),
    SplitOrPdf2MdCommand(),
]
