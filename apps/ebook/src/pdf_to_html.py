"""pdf_to_html.py — Convert PDF documents directly to HTML with PyMuPDF.

Extracts styled HTML structures including embedded images and text alignment.
"""

import sys
import argparse
from pathlib import Path
import fitz

class HTMLConverter:
    """Converter to output high fidelity HTML files from PDF documents."""

    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def convert(self, pdf_path: Path) -> Path:
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")

        doc = fitz.open(str(pdf_path))
        html_pages = []

        # HTML boilerplate structure with styling wrapper
        html_pages.append("<!DOCTYPE html>\n<html>\n<head>")
        html_pages.append('  <meta charset="utf-8">')
        html_pages.append(f"  <title>{pdf_path.stem}</title>")
        html_pages.append("""  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background-color: #f7f9fc;
      margin: 0;
      padding: 40px 20px;
      color: #333;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background-color: #ffffff;
      padding: 50px 60px;
      box-shadow: 0 4px 15px rgba(0,0,0,0.05);
      border-radius: 8px;
    }
    .page-separator {
      border-top: 1px dashed #ccc;
      margin: 40px 0;
      text-align: center;
      color: #999;
      font-size: 12px;
      user-select: none;
    }
    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 20px auto;
    }
  </style>""")
  
        html_pages.append("</head>\n<body>\n<div class='container'>")

        for idx, page in enumerate(doc):
            if idx > 0:
                html_pages.append(f"<div class='page-separator'>Page {idx + 1}</div>")
            
            # Using PyMuPDF's get_text("html") layout engine
            html_content = page.get_text("html")
            html_pages.append(html_content)

        html_pages.append("</div>\n</body>\n</html>")
        doc.close()

        output_path = pdf_path.with_suffix(".html")
        output_path.write_text("\n".join(html_pages), encoding="utf-8")
        print(f"  ✓ Saved HTML: {output_path.name}")
        return output_path


def main():
    parser = argparse.ArgumentParser(description="Convert PDF directly to HTML.")
    parser.add_argument("--input", required=True, help="Input PDF filepath")
    parser.add_argument("--output", default="output", help="Output directory")

    args = parser.parse_args()
    
    input_path = Path(args.input)
    converter = HTMLConverter(args.output)
    
    try:
        converter.convert(input_path)
        print("Conversion completed successfully.")
    except Exception as e:
        print(f"Error during conversion: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
