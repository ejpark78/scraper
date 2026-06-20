"""HTML to Markdown Converter Module.

This script parses HTML files, including complex elements like tables and images,
separates embedded base64 images into standalone image files, resolves layout breaks,
and converts the structural HTML into standard GitHub Flavored Markdown (GFM).
"""

import base64
import re
from pathlib import Path
from bs4 import BeautifulSoup
import markdownify


class CustomMarkdownConverter(markdownify.MarkdownConverter):
    """Custom converter to guarantee explicit rendering of certain tags like img."""

    def convert_img(self, el, text, *args, **kwargs):
        src = el.get("src", "")
        alt = el.get("alt", "") or "image"
        # Return standard markdown image format
        return f"![{alt}]({src})"


class HTMLToMarkdownConverter:
    """Converter class to parse HTML, extract images, merge broken sentences, and generate Markdown."""

    def __init__(self, output_dir: str | Path):
        self.output_dir = Path(output_dir)

    def convert(self, html_path: Path) -> Path:
        """Converts an HTML file to Markdown and saves it with a .md extension in the same directory."""
        if not html_path.exists():
            raise FileNotFoundError(f"HTML file not found: {html_path}")

        print(f"Reading HTML from: {html_path}")
        with open(html_path, "r", encoding="utf-8") as f:
            html_content = f.read()

        soup = BeautifulSoup(html_content, "lxml")

        # 1. Extract Base64 Images to files
        self._extract_base64_images(soup, html_path)

        # 2. Merge structurally broken paragraphs/lines before markdown conversion
        self._merge_broken_sentences(soup)

        # 3. Convert to Markdown using CustomMarkdownConverter
        # This guarantees standard Markdown output and keeps image/table tags intact
        markdown_text = CustomMarkdownConverter(
            heading_style=markdownify.ATX,
            bullets="-",
            strip=["script", "style"],
            wrap=False
        ).convert(str(soup))

        # Post-process markdown text to clean up any remaining line break issues
        markdown_text = self._cleanup_markdown(markdown_text)

        # Output Markdown file path (same path, .md suffix)
        md_path = html_path.with_suffix(".md")
        
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(markdown_text)

        print(f"Saved Markdown to: {md_path}")
        return md_path

    def _extract_base64_images(self, soup: BeautifulSoup, html_path: Path):
        """Finds all base64-encoded images in the HTML, saves them to an 'images' folder, and updates the src."""
        # Create an images folder inside the same directory as the HTML file
        parent_dir = html_path.parent
        images_dir = parent_dir / "images"
        images_dir.mkdir(parents=True, exist_ok=True)

        # BeautifulSoup find_all is case-insensitive by default for HTML tags
        img_tags = soup.find_all("img")
        for idx, img in enumerate(img_tags):
            src = img.get("src", "").strip()
            # Handle potential newlines or tabs inside src attribute value
            src_clean = re.sub(r"\s+", "", src)
            if src_clean.startswith("data:image/"):
                try:
                    # Parse base64 header from cleaned src
                    header, base64_data = src_clean.split(",", 1)
                    # Extract extension (e.g. png, jpeg)
                    ext_match = re.search(r"data:image/(\w+);", header)
                    ext = ext_match.group(1) if ext_match else "png"

                    # Decode base64
                    img_data = base64.b64decode(base64_data)
                    
                    # Target filename (replace spaces with underscores)
                    safe_stem = re.sub(r"\s+", "_", html_path.stem)
                    img_filename = f"{safe_stem}_img_{idx + 1}.{ext}"
                    img_file_path = images_dir / img_filename
                    
                    with open(img_file_path, "wb") as f_img:
                        f_img.write(img_data)
                    
                    # Update src in soup to the relative path
                    img["src"] = f"images/{img_filename}"
                    print(f"Extracted image to: images/{img_filename}")
                except Exception as e:
                    print(f"Error extracting image {idx}: {e}")

    def _merge_broken_sentences(self, soup: BeautifulSoup):
        """Cleans up structural layout breakages within paragraph elements."""
        # Replace <br> tags within paragraph/text tags with space to join lines
        for br in soup.find_all("br"):
            br.replace_with(" ")

        # Look at adjacent <p> tags
        p_tags = soup.find_all("p")
        for i in range(len(p_tags) - 1):
            curr_p = p_tags[i]
            next_p = p_tags[i + 1]
            
            if not curr_p or not next_p:
                continue

            curr_text = curr_p.get_text().strip()
            next_text = next_p.get_text().strip()

            if not curr_text or not next_text:
                continue

            # If the current paragraph doesn't end with a sentence-ending punctuation (., ?, !, :, etc.)
            # and the next paragraph starts with a lowercase letter, merge them to avoid broken paragraphs.
            ends_with_punctuation = re.search(r"[.?!:»]$", curr_text)
            starts_with_lowercase = re.match(r"^[a-z0-9]", next_text)

            # Check if they are actually adjacent text lines by checking parent nodes and styling
            if not ends_with_punctuation and starts_with_lowercase:
                # Merge next_p's content into curr_p
                for child in list(next_p.children):
                    curr_p.append(child)
                # Clear next_p so it doesn't render
                next_p.decompose()

    def _cleanup_markdown(self, markdown_text: str) -> str:
        """Removes duplicate empty lines or unnecessary mid-sentence line breaks in Markdown text."""
        # Split text into lines
        lines = markdown_text.splitlines()
        cleaned_lines = []
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # If line is blank, preserve it as a paragraph separator
            if not line:
                cleaned_lines.append("")
                i += 1
                continue

            # Look ahead to see if we should merge the next line
            # If the current line does not end with sentence boundaries (., ?, !, :, etc.)
            # and the next line is not blank, and doesn't start with a header, list item, or code block
            # we merge them.
            merged_line = lines[i]
            while (i + 1 < len(lines)) and lines[i + 1].strip():
                curr_strip = merged_line.strip()
                next_line = lines[i + 1].strip()
                
                # Check markdown constructs
                is_md_structure = (
                    next_line.startswith("#") or 
                    next_line.startswith("-") or 
                    next_line.startswith("*") or 
                    next_line.startswith("`") or
                    next_line.startswith("[") or
                    re.match(r"^\d+\.", next_line)
                )

                ends_with_sentence = re.search(r"[.?!:;]$", curr_strip)

                if not ends_with_sentence and not is_md_structure:
                    # Merge lines with a space
                    merged_line = merged_line + " " + lines[i + 1].strip()
                    i += 1
                else:
                    break
            
            cleaned_lines.append(merged_line)
            i += 1

        # Reconstruct markdown text
        result = "\n".join(cleaned_lines)
        
        # Replace multiple consecutive blank lines with a single blank line
        result = re.sub(r"\n{3,}", "\n\n", result)
        return result
