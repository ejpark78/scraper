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


def main():
    parser = argparse.ArgumentParser(description="Ebook PDF Process Pipeline.")
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
            # Search both data directory and output directory recursively
            pdf_files = []
            for search_dir in [Path(args.data), Path(args.output)]:
                if search_dir.exists():
                    pdf_files.extend(list(search_dir.glob("**/*.pdf")))
            
            # Exclude raw/ directory contents
            pdf_files = [p for p in pdf_files if "raw" not in p.resolve().parts]
            
            # Deduplicate by absolute path resolved
            pdf_files = list({p.resolve(): p for p in pdf_files}.values())
            
            if not pdf_files:
                print(f"No PDF files found in {args.data} or {args.output}")
                sys.exit(0)
            for pdf_file in pdf_files:
                print(f"Converting {pdf_file.name} to HTML...")
                html_converter.convert(pdf_file)
        else:
            pdf_file = Path(args.pdf2html)
            if pdf_file.exists():
                html_converter.convert(pdf_file)
            else:
                # Check if it resides in the data directory
                alt_path = Path(args.data) / args.pdf2html
                if alt_path.exists():
                    html_converter.convert(alt_path)
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
            # Search both data directory and output directory recursively
            html_files = []
            for search_dir in [Path(args.data), Path(args.output)]:
                if search_dir.exists():
                    html_files.extend(list(search_dir.glob("**/*.html")))
            
            # Exclude raw/ directory contents
            html_files = [p for p in html_files if "raw" not in p.resolve().parts]
            
            # Deduplicate by absolute path resolved
            html_files = list({p.resolve(): p for p in html_files}.values())
            
            if not html_files:
                print(f"No HTML files found in {args.data} or {args.output}")
                sys.exit(0)
            for html_file in html_files:
                print(f"Converting {html_file.name} to Markdown...")
                html2md_converter.convert(html_file)
        else:
            html_file = Path(args.html2md)
            if html_file.exists():
                html2md_converter.convert(html_file)
            else:
                # Check if it resides in data directory
                alt_path = Path(args.data) / args.html2md
                if alt_path.exists():
                    html2md_converter.convert(alt_path)
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
