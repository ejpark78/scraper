"""Ebook processing commands — each mode as an OOP Command class."""

import json
import sys
from abc import ABC, abstractmethod
from argparse import ArgumentParser, Namespace
from pathlib import Path

from .split_chapter import ChapterSplitter, BookProfile, ChapterDef, get_output_path
from .html_parser import HTMLConverter
from .markdown_parser import HTMLToMarkdownConverter
from .translator import PDFTranslator
from .analyzer import PDFAnalyzer


# ── Utilities ──────────────────────────────────────────────────────────────

def load_books_config(books_json_path: Path) -> dict:
    if books_json_path.exists():
        with open(str(books_json_path), "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _collect_files(suffixes: list[str], *dirs: str) -> list[Path]:
    files = []
    for suf in suffixes:
        for d in dirs:
            search_dir = Path(d)
            if search_dir.exists():
                files.extend(list(search_dir.glob(f"**/*.{suf}")))
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
        """Primary argparse attribute name (e.g. 'summary', 'to_html')."""

    def add_arguments(self, parser: ArgumentParser) -> None:
        """Register CLI arguments. Override if the command has flags."""

    @abstractmethod
    def execute(self, args: Namespace) -> None:
        """Execute the command and call sys.exit()."""

    def matches(self, args: Namespace) -> bool:
        val = getattr(args, self.flag, None)
        if val is None or val is False:
            return False
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
        PDFAnalyzer().dump_all_summaries(args.path)
        sys.exit(0)


# ── Analyze ────────────────────────────────────────────────────────────────

class AnalyzeCommand(EbookCommand):
    @property
    def flag(self) -> str:
        return "analyze"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--analyze", nargs="?", const="all", default=None,
                            help="Analyze specified PDF/EPUB structure or directory")
        parser.add_argument("--overwrite", action="store_true", default=False,
                            help="Overwrite existing configuration in books.json if already analyzed")

    def execute(self, args: Namespace) -> None:
        target = args.analyze
        if target is True or target == "all" or target == "" or target is None:
            target_path = Path(args.raw)
        else:
            resolved = _resolve_file_arg(target, args.raw)
            if resolved:
                target_path = resolved
            else:
                target_path = Path(target)
                if not target_path.exists():
                    # Fallback to output directory check
                    resolved_out = _resolve_file_arg(target, args.path)
                    if resolved_out:
                        target_path = resolved_out

        if not target_path.exists():
            print(f"Path not found: {target if target else args.raw}")
            sys.exit(1)

        PDFAnalyzer().analyze(str(target_path), overwrite=args.overwrite)
        sys.exit(0)


# ── To HTML (PDF/EPUB → HTML) ──────────────────────────────────────────────

class ToHtmlCommand(EbookCommand):
    @property
    def flag(self) -> str:
        return "to_html"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--to-html", action="store_true",
                            help="Convert all PDF/EPUB files under data directory to HTML")

    def _convert_pdf(self, pdf_path: Path) -> None:
        converter = HTMLConverter(str(pdf_path.parent))
        converter.convert(pdf_path)

    def _convert_epub(self, epub_path: Path) -> None:
        import ebooklib
        from ebooklib import epub

        book = epub.read_epub(str(epub_path))
        out_dir = epub_path.parent
        docs = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))
        for item in docs:
            content = item.get_content()
            name = Path(item.get_name()).name
            ch_path = out_dir / name
            ch_path.write_bytes(content)
            print(f"  ✓ Extracted HTML: {name}")
        book.close()

    def execute(self, args: Namespace) -> None:
        files = _collect_files(["pdf", "epub"], args.path)
        if not files:
            print(f"No PDF/EPUB files found in {args.path}")
            sys.exit(0)

        for f in files:
            print(f"Converting {f.name} to HTML...")
            if f.suffix.lower() == ".epub":
                self._convert_epub(f)
            else:
                self._convert_pdf(f)
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

        pdf_path = _resolve_file_arg(args.translate_md, args.path)
        out_path = Path(args.translate_out)
        if not out_path.is_absolute():
            out_path = Path(args.path) / out_path
        if pdf_path is None:
            print(f"File not found: {args.translate_md}", file=sys.stderr)
            sys.exit(1)
        PDFTranslator().translate_pdf(str(pdf_path), start, end, out_path)
        sys.exit(0)


# ── To Markdown (HTML/PDF/EPUB → MD) ───────────────────────────────────────

class ToMdCommand(EbookCommand):
    @property
    def flag(self) -> str:
        return "to_md"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--to-md", action="store_true",
                            help="Convert all HTML/PDF/EPUB files under data directory to Markdown")

    def _convert_html(self, html_path: Path) -> None:
        converter = HTMLToMarkdownConverter(str(html_path.parent))
        converter.convert(html_path)

    def _convert_pdf(self, pdf_path: Path) -> None:
        print(f"  Converting PDF→HTML→MD: {pdf_path.name}")
        html_converter = HTMLConverter(str(pdf_path.parent))
        html_path = html_converter.convert(pdf_path)
        self._convert_html(html_path)

    def _convert_epub(self, epub_path: Path) -> None:
        import ebooklib
        from ebooklib import epub

        book = epub.read_epub(str(epub_path))
        docs = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))
        md_converter = HTMLToMarkdownConverter(str(epub_path.parent))
        for item in docs:
            content = item.get_content()
            name = Path(item.get_name()).name
            html_path = epub_path.parent / name
            html_path.write_bytes(content)
            print(f"  Extracted HTML: {name}")
            md_converter.convert(html_path)
        book.close()

    def execute(self, args: Namespace) -> None:
        files = _collect_files(["html", "pdf", "epub"], args.path)
        if not files:
            print(f"No HTML/PDF/EPUB files found in {args.path}")
            sys.exit(0)

        for f in files:
            print(f"Converting {f.name} to Markdown...")
            if f.suffix.lower() == ".epub":
                self._convert_epub(f)
            elif f.suffix.lower() == ".pdf":
                self._convert_pdf(f)
            else:
                self._convert_html(f)
        sys.exit(0)


# ── Split ──────────────────────────────────────────────────────────────────

class SplitCommand(EbookCommand):
    @property
    def flag(self) -> str:
        return "split"

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument("--split", action="store_true",
                            help="Split PDF/EPUB into chapter files")

    def execute(self, args: Namespace) -> None:
        raw_path = Path(args.raw)
        output_path = Path(args.path)
        books_cfg = load_books_config(raw_path / "books.json")

        source_files = list(raw_path.glob("*.pdf")) + list(raw_path.glob("*.epub"))
        if not source_files:
            print(f"No PDF/EPUB files found in {args.raw}")
            sys.exit(0)

        splitter = ChapterSplitter(args.raw, args.path)

        for src in source_files:
            name = src.name
            print(f"\nProcessing {name}...")

            cfg = books_cfg.get(name)
            if not cfg:
                print(f"  No configuration found for {name}. Skip.")
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
                path=src,
                title=get_output_path(name),
                page_count=0,
                chapters=chapters,
            )

            chapter_paths = splitter.split(name, profile)

        sys.exit(0)


# ── Registry (priority ordered: first match wins) ──────────────────────────

COMMANDS: list[EbookCommand] = [
    SummaryCommand(),
    AnalyzeCommand(),
    ToHtmlCommand(),
    TranslateCommand(),
    ToMdCommand(),
    SplitCommand(),
]