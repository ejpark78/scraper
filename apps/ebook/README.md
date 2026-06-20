# Ebook — PDF Processing Pipeline

PDF ebook processing toolkit: split, convert, analyze, and translate PDFs.

## Prerequisites

- Docker + Docker Compose
- Python 3.13+ (for local development with `uv`)

## Usage

All commands run via Docker Compose:

```bash
# Build image
make build

# Analyze a PDF (interactive)
make analyze PDF=path/to/book.pdf

# Print summary of all PDFs
make summary

# Split PDFs into chapter PDFs (based on books.json)
make split

# Convert chapter PDFs to Markdown
make pdf2md

# Convert PDF directly to HTML
make pdf2html [PDF=path/to/book.pdf]

# Convert HTML to Markdown
make html2md [HTML=path/to/file.html]

# Translate PDF pages using Ollama
make translate_md PDF=path/to/book.pdf RANGE=10-20 OUT=output_base

# Batch translate markdown files using Gemini/OpenAI
make translate_batch INPUT_DIR=path/to/markdown_files
```

## Tests

```bash
make test
```

## Project Structure

```
src/
├── __init__.py          # Package marker
├── constants.py         # Shared constants (EXCLUDE_TITLES)
├── process.py           # CLI entrypoint / dispatcher
├── split_chapter.py     # Chapter splitting (PDF → chapter PDFs)
├── pdf_to_markdown.py   # Chapter PDF → Markdown conversion
├── pdf_to_html.py       # Full PDF → HTML conversion
├── html_to_markdown.py  # HTML → Markdown conversion
├── pdf_analyzer.py      # PDF TOC analysis & profile building
├── pdf_translator.py    # Ollama batch translation
└── translate_batch.py   # Gemini/OpenAI batch translation
tests/
├── test_text_cleaner.py
├── test_splitter_utils.py
└── test_column_detector.py
books.json               # Chapter/page-range configuration
```
