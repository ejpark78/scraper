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
            output_dir = Path(args.output)
            pdf_files = list(output_dir.glob("**/*.pdf"))
            if not pdf_files:
                print(f"No PDF files found in {args.output}")
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
            output_dir = Path(args.output)
            html_files = list(output_dir.glob("**/*.html"))
            if not html_files:
                print(f"No HTML files found in {args.output}")
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
            cfg = books_cfg.get(pdf_name) or BOOK_CONFIG.get(pdf_name)
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
