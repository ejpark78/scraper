"""PDF ebook process entrypoint.

Refactored to merge commands and entrypoint into a single file and remove translation features.
"""

import argparse
import json
import sys
from pathlib import Path

from .analyzer import PDFAnalyzer
from .html_parser import HTMLConverter
from .markdown_parser import HTMLToMarkdownConverter
from .split_chapter import BookProfile, ChapterDef, ChapterSplitter, get_output_path


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


# ── Commands ───────────────────────────────────────────────────────────────

def run_summary(path: str) -> None:
    PDFAnalyzer().dump_all_summaries(path)


def run_analyze(target: str | None, raw_dir: str, out_dir: str, overwrite: bool) -> None:
    if target is True or target == "all" or target == "" or target is None:
        target_path = Path(raw_dir)
    else:
        resolved = _resolve_file_arg(target, raw_dir)
        if resolved:
            target_path = resolved
        else:
            target_path = Path(target)
            if not target_path.exists():
                # Fallback to output directory check
                resolved_out = _resolve_file_arg(target, out_dir)
                if resolved_out:
                    target_path = resolved_out

    if not target_path.exists():
        print(f"Path not found: {target if target else raw_dir}")
        sys.exit(1)

    PDFAnalyzer().analyze(str(target_path), overwrite=overwrite)


def run_to_html(path: str) -> None:
    files = _collect_files(["pdf", "epub"], path)
    if not files:
        print(f"No PDF/EPUB files found in {path}")
        return

    for f in files:
        print(f"Converting {f.name} to HTML...")
        if f.suffix.lower() == ".epub":
            import ebooklib
            from ebooklib import epub

            book = epub.read_epub(str(f))
            out_dir = f.parent
            docs = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))
            for item in docs:
                content = item.get_content()
                name = Path(item.get_name()).name
                ch_path = out_dir / name
                ch_path.write_bytes(content)
                print(f"  ✓ Extracted HTML: {name}")
            book.close()
        else:
            converter = HTMLConverter(str(f.parent))
            converter.convert(f)


def run_to_md(path: str) -> None:
    files = _collect_files(["html", "pdf", "epub"], path)
    if not files:
        print(f"No HTML/PDF/EPUB files found in {path}")
        return

    for f in files:
        print(f"Converting {f.name} to Markdown...")
        if f.suffix.lower() == ".epub":
            import ebooklib
            from ebooklib import epub

            book = epub.read_epub(str(f))
            docs = list(book.get_items_of_type(ebooklib.ITEM_DOCUMENT))
            md_converter = HTMLToMarkdownConverter(str(f.parent))
            for item in docs:
                content = item.get_content()
                name = Path(item.get_name()).name
                html_path = f.parent / name
                html_path.write_bytes(content)
                print(f"  Extracted HTML: {name}")
                md_converter.convert(html_path)
            book.close()
        elif f.suffix.lower() == ".pdf":
            print(f"  Converting PDF→HTML→MD: {f.name}")
            html_converter = HTMLConverter(str(f.parent))
            html_path = html_converter.convert(f)
            md_converter = HTMLToMarkdownConverter(str(f.parent))
            md_converter.convert(html_path)
        else:
            converter = HTMLToMarkdownConverter(str(f.parent))
            converter.convert(f)


def run_split(raw_dir: str, out_dir: str) -> None:
    raw_path = Path(raw_dir)
    books_cfg = load_books_config(raw_path / "books.json")

    source_files = list(raw_path.glob("*.pdf")) + list(raw_path.glob("*.epub"))
    if not source_files:
        print(f"No PDF/EPUB files found in {raw_dir}")
        return

    splitter = ChapterSplitter(raw_dir, out_dir)

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

        splitter.split(name, profile)


# ── CLI Entrypoint ─────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Ebook PDF Process Pipeline.")
    parser.add_argument("--raw", default="data/raw", help="Directory of raw PDF/EPUB files")
    parser.add_argument("--path", default="data/output", help="Working path for inputs and outputs")

    parser.add_argument("--summary", action="store_true", help="Print summary of all PDFs")
    parser.add_argument("--analyze", nargs="?", const="all", default=None, help="Analyze specified PDF/EPUB structure or directory")
    parser.add_argument("--overwrite", action="store_true", default=False, help="Overwrite existing configuration in books.json if already analyzed")
    parser.add_argument("--to-html", action="store_true", help="Convert all PDF/EPUB files under data directory to HTML")
    parser.add_argument("--to-md", action="store_true", help="Convert all HTML/PDF/EPUB files under data directory to Markdown")
    parser.add_argument("--split", action="store_true", help="Split PDF/EPUB into chapter files")

    args = parser.parse_args()

    if args.summary:
        run_summary(args.path)
        sys.exit(0)
    elif args.to_html:
        run_to_html(args.path)
        sys.exit(0)
    elif args.to_md:
        run_to_md(args.path)
        sys.exit(0)
    elif args.split:
        run_split(args.raw, args.path)
        sys.exit(0)
    elif args.analyze is not None or "--analyze" in sys.argv:
        run_analyze(args.analyze, args.raw, args.path, args.overwrite)
        sys.exit(0)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
