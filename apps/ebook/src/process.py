"""PDF ebook process entrypoint.

Refactored controller to split chapters, convert to markdown/html, translate, and analyze.
"""

import argparse
import json
import sys
from pathlib import Path

# Local module imports
from .split_chapter import ChapterSplitter, BookProfile, ChapterDef, get_book_title
from .pdf_to_markdown import ChapterConverter
from .pdf_to_html import HTMLConverter
from .html_to_markdown import HTMLToMarkdownConverter
from .pdf_translator import PDFTranslator
from .pdf_analyzer import PDFAnalyzer


def load_books_config(books_json_path: Path) -> dict:
    if books_json_path.exists():
        with open(str(books_json_path), "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def _collect_files(data_dir: str, output_dir: str, suffix: str) -> list[Path]:
    """Collect files with given suffix from data/output dirs, excluding raw/ and deduplicating."""
    files = []
    for search_dir in [Path(data_dir), Path(output_dir)]:
        if search_dir.exists():
            files.extend(list(search_dir.glob(f"**/*.{suffix}")))
    files = [p for p in files if "raw" not in p.resolve().parts]
    files = list({p.resolve(): p for p in files}.values())
    return files


def _resolve_file_arg(name: str, data_dir: str) -> Path | None:
    """Resolve a file argument: try as-is, then under data_dir."""
    p = Path(name)
    if p.exists():
        return p
    alt = Path(data_dir) / name
    if alt.exists():
        return alt
    return None


def main():
    parser = argparse.ArgumentParser(description="Ebook PDF Process Pipeline.")
    parser.add_argument("--data", default="data", help="Input directory of PDFs")
    parser.add_argument("--output", default="output", help="Output directory")
    
    # Modes
    parser.add_argument("--summary", action="store_true", help="Print summary of all PDFs")
    parser.add_argument("--analyze", help="Analyze specified PDF structure interactively")
    parser.add_argument("--split", action="store_true", help="Split PDFs into chapter PDFs")
    parser.add_argument("--pdf2md", action="store_true", help="Convert split chapter PDFs to markdown")
    parser.add_argument("--pdf2html", nargs="?", const="all", help="Directly convert specified PDF (or all PDFs if empty/all) to HTML")
    parser.add_argument("--html2md", nargs="?", const="all", help="Convert specified HTML (or all HTMLs if empty/all) to Markdown")
    
    # Translation options
    parser.add_argument("--translate-md", help="Translate PDF path")
    parser.add_argument("--translate-pages", help="Page range for translation (e.g., '10-20')")
    parser.add_argument("--translate-out", help="Output filepath base name")

    args = parser.parse_args()

    # Initialize modules
    analyzer = PDFAnalyzer()
    
    # 1. Summary Mode
    if args.summary:
        analyzer.dump_all_summaries(args.data)
        sys.exit(0)

    # 2. Analyze Mode
    if args.analyze:
        analyzer.analyze(args.analyze)
        sys.exit(0)

    # 3. Direct HTML Mode
    if args.pdf2html is not None:
        html_converter = HTMLConverter(args.output)
        if args.pdf2html == "all" or args.pdf2html == "":
            pdf_files = _collect_files(args.data, args.output, "pdf")
            if not pdf_files:
                print(f"No PDF files found in {args.data} or {args.output}")
                sys.exit(0)
            for pdf_file in pdf_files:
                print(f"Converting {pdf_file.name} to HTML...")
                html_converter.convert(pdf_file)
        else:
            pdf_file = _resolve_file_arg(args.pdf2html, args.data)
            if pdf_file:
                html_converter.convert(pdf_file)
            else:
                print(f"File not found: {args.pdf2html}")
                sys.exit(1)
        sys.exit(0)

    # 4. Translation Mode
    if args.translate_md:
        if not args.translate_pages or not args.translate_out:
            print("Error: --translate-md requires both --translate-pages (e.g., '10-20') and --translate-out", file=sys.stderr)
            sys.exit(1)
        
        try:
            start, end = map(int, args.translate_pages.split("-"))
        except ValueError:
            print("Error: --translate-pages must be in format 'start-end' (e.g. '10-20')", file=sys.stderr)
            sys.exit(1)

        translator = PDFTranslator()
        translator.translate_pdf(args.translate_md, start, end, Path(args.translate_out))
        sys.exit(0)

    # 5. HTML to Markdown Mode
    if args.html2md is not None:
        html2md_converter = HTMLToMarkdownConverter(args.output)
        if args.html2md == "all" or args.html2md == "":
            html_files = _collect_files(args.data, args.output, "html")
            if not html_files:
                print(f"No HTML files found in {args.data} or {args.output}")
                sys.exit(0)
            for html_file in html_files:
                print(f"Converting {html_file.name} to Markdown...")
                html2md_converter.convert(html_file)
        else:
            html_file = _resolve_file_arg(args.html2md, args.data)
            if html_file:
                html2md_converter.convert(html_file)
            else:
                print(f"File not found: {args.html2md}")
                sys.exit(1)
        sys.exit(0)

    # 6. Split and/or Convert to MD Modes
    if args.split or args.pdf2md:
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

            # Locate configuration
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
                    include=include
                ))

            profile = BookProfile(
                path=pdf,
                title=get_book_title(pdf_name),
                page_count=0, # not strictly needed for splitter
                chapters=chapters
            )

            # Execution
            chapter_pdfs = []
            if args.split:
                print("Splitting chapters...")
                chapter_pdfs = splitter.split(pdf_name, profile)
            else:
                # If we only want MD conversion but split folder exists
                book_dir = output_path / get_book_title(pdf_name)
                for ch in profile.chapters:
                    if ch.include:
                        ch_path = book_dir / f"{ch.title}.pdf"
                        if ch_path.exists():
                            chapter_pdfs.append(ch_path)

            if args.pdf2md:
                print("Converting split chapters to markdown...")
                converter = ChapterConverter(output_path)
                for ch_pdf in chapter_pdfs:
                    if ch_pdf.exists():
                        print(f"  Converting {ch_pdf.name}...")
                        converter.convert(ch_pdf)
        sys.exit(0)

    # Fallback to printing help if no args provided
    parser.print_help()


if __name__ == "__main__":
    main()
