"""pdf_to_markdown.py — Convert PDF pages/chapters to markdown documents.

Extracts text layout, sanitizes linebreaks, renders table/images to PNGs and embeddings.
"""

from pathlib import Path
import re
import fitz

from .constants import EXCLUDE_TITLES

# ═══════════════════════════════════════════════════════════════
# TextCleaner & Layout Helpers
# ═══════════════════════════════════════════════════════════════


class TextCleaner:
    """Clean extracted text: fix line breaks, detect headings, remove markers."""

    @staticmethod
    def fix_linebreaks(text: str) -> str:
        if not text:
            return text

        text = text.replace('\u00ad', '')
        text = text.replace('\u2010', '-')
        text = text.replace('\u2011', '-')

        lines = text.split('\n')
        fixed = []
        buffer = []

        for line in lines:
            stripped = line.rstrip()
            if not stripped:
                if buffer:
                    fixed.append(''.join(buffer))
                    buffer = []
                fixed.append('')
                continue

            if buffer and buffer[-1].endswith('-') and stripped and stripped[0].islower():
                buffer[-1] = buffer[-1][:-1] + stripped
                continue

            if (buffer and buffer[-1]
                    and buffer[-1][-1] in 'abcdefghijklmnopqrstuvwxyz,;:'
                    and stripped
                    and stripped[0].islower()):
                buffer[-1] = buffer[-1] + ' ' + stripped
                continue

            buffer.append(stripped)

        if buffer:
            fixed.append(''.join(buffer))

        result = '\n'.join(fixed)

        result = re.sub(r'([a-z])([A-Z]{2,})([a-z])', r'\1 \2\3', result)
        result = re.sub(r'([a-z])(AI|ML)(?=\s|[.,;:!?)])', r'\1 \2', result)
        result = re.sub(r'([a-z])(\d)', r'\1 \2', result)
        result = re.sub(r'(\d)([A-Z][a-z])', r'\1 \2', result)
        result = re.sub(r'\.([A-Z])', r'. \1', result)

        return result

    @staticmethod
    def detect_heading(text: str, avg_font_size: float, body_size: float) -> str:
        text = text.strip()
        if not text or text.startswith('#'):
            return text
        diff = avg_font_size - body_size
        if diff >= 6:
            return '# ' + text
        elif diff >= 4:
            return '## ' + text
        elif diff >= 2:
            return '### ' + text
        return text

    @staticmethod
    def is_page_number(y0: float, y1: float, page_h: float, text: str) -> bool:
        stripped = text.strip()
        if not stripped:
            return False

        margin_y = page_h * 0.06

        in_margin = y1 > page_h - margin_y or y0 < margin_y

        if in_margin and stripped.isdigit() and len(stripped) <= 4:
            return True

        if in_margin and re.match(r'^[—\-–]\s*\d+\s*[—\-–]$', stripped):
            return True

        if re.match(r'^\d+\s*\|.*$', stripped) or re.match(r'^\|\s*\d+$', stripped):
            return True

        if re.match(r'^\d+\s*\|?\s*(Chapter|PART)\s', stripped):
            return True

        return False

    @staticmethod
    def is_chapter_header(text: str, y0: float, page_h: float) -> bool:
        stripped = text.strip()
        if y0 < page_h * 0.08:
            if re.match(r'^(Chapter|Part|CHAPTER)\b', stripped):
                return True
            if re.match(r'^//', stripped):
                return True
        return False

    @staticmethod
    def extract_block_text(block: dict) -> str:
        lines_text = []
        for line in block.get("lines", []):
            spans = line.get("spans", [])
            if not spans:
                continue
            line_parts = []
            prev_end = None
            for span in spans:
                text = span.get("text", "")
                if not text:
                    continue
                bbox = span.get("bbox", None)
                if prev_end is not None and bbox:
                    gap = bbox[0] - prev_end
                    font_size = span.get("size", 10)
                    if gap > font_size * 0.7:
                        line_parts.append(" " + text)
                    else:
                        line_parts.append(text)
                else:
                    line_parts.append(text)
                if bbox:
                    prev_end = bbox[2]
            lines_text.append("".join(line_parts))
        return "\n".join(lines_text)

    @staticmethod
    def get_avg_font_size(block: dict) -> float:
        sizes = []
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                sizes.append(span.get("size", 0))
        if not sizes:
            return 0.0
        return sum(sizes) / len(sizes)

    @staticmethod
    def is_mostly_uppercase(text: str) -> bool:
        letters = [c for c in text if c.isalpha()]
        if not letters:
            return False
        upper = sum(1 for c in letters if c.isupper())
        return upper / len(letters) > 0.7


class ColumnDetector:
    """Detect multi-column layout and return blocks in reading order."""

    @staticmethod
    def sort_blocks(blocks: list[dict], page_width: float) -> list[dict]:
        if not blocks:
            return blocks

        x0s = sorted(set(round(b["bbox"][0], -1) for b in blocks if b.get("bbox")))
        clusters = []
        for x0 in x0s:
            if not clusters or abs(x0 - clusters[-1]) > 30:
                clusters.append(x0)

        if len(clusters) <= 1:
            return sorted(blocks, key=lambda b: (b["bbox"][1], b["bbox"][0]))

        col_blocks: list[list[dict]] = [[] for _ in clusters]
        for b in blocks:
            bx0 = b["bbox"][0]
            idx = min(range(len(clusters)), key=lambda i: abs(clusters[i] - bx0))
            col_blocks[idx].append(b)

        result = []
        for col_idx in range(len(clusters)):
            col_blocks[col_idx].sort(key=lambda b: b["bbox"][1])
            result.extend(col_blocks[col_idx])

        return result


class ImageRenderer:
    """Render specific page regions (tables, images) to PNG."""

    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.images_dir = self.output_dir / "images"
        self.images_dir.mkdir(parents=True, exist_ok=True)

    def render_region(self, page: fitz.Page, bbox: tuple, prefix: str,
                      page_no: int, idx: int, padding: int = 5) -> str:
        x0, y0, x1, y1 = bbox
        clip = fitz.Rect(x0 - padding, y0 - padding, x1 + padding, y1 + padding)
        clip = clip & page.rect

        pix = page.get_pixmap(clip=clip, dpi=150)
        filename = f"{prefix}_p{page_no:03d}_{idx:03d}.png"
        filepath = self.images_dir / filename
        pix.save(str(filepath))

        return f"images/{filename}"

    def render_table(self, page: fitz.Page, bbox: tuple,
                     page_no: int, idx: int) -> str:
        return self.render_region(page, bbox, "table", page_no, idx, padding=10)

    def render_image(self, page: fitz.Page, bbox: tuple,
                     page_no: int, idx: int) -> str:
        return self.render_region(page, bbox, "img", page_no, idx, padding=5)

    def render_full_page(self, page: fitz.Page, page_no: int) -> str:
        pix = page.get_pixmap(dpi=150)
        filename = f"page_p{page_no:03d}.png"
        filepath = self.images_dir / filename
        pix.save(str(filepath))
        return f"images/{filename}"


# ═══════════════════════════════════════════════════════════════
# ChapterConverter
# ═══════════════════════════════════════════════════════════════

class ChapterConverter:
    """Convert a chapter PDF to a single .md file with embedded images."""

    def __init__(self, output_dir: str, body_font_size: float = 11.0):
        self.output_dir = Path(output_dir)
        self.body_font_size = body_font_size
        self.image_renderer = ImageRenderer(output_dir)
        self.text_cleaner = TextCleaner()

    def convert(self, chapter_pdf: Path) -> Path:
        doc = fitz.open(str(chapter_pdf))
        md_lines = []

        for page_no in range(doc.page_count):
            page = doc[page_no]
            page_md = self._process_page(page, page_no + 1)
            if page_md.strip():
                md_lines.append(page_md)

        doc.close()

        md_text = '\n\n'.join(md_lines)
        md_path = chapter_pdf.with_suffix('.md')
        with open(str(md_path), 'w', encoding='utf-8') as f:
            f.write(md_text)

        return md_path

    def _process_page(self, page: fitz.Page, page_no: int) -> str:
        page_h = page.rect.height
        page_w = page.rect.width

        table_bboxes = []
        try:
            tables = page.find_tables()
            for t in tables.tables:
                table_bboxes.append(t.bbox)
        except Exception:
            pass

        image_bboxes = []
        try:
            for img in page.get_images():
                bbox = page.get_image_bbox(img)
                if bbox and bbox.width > 15 and bbox.height > 15:
                    image_bboxes.append(bbox)
        except Exception:
            pass

        blocks = page.get_text("dict")["blocks"]
        text_blocks = [b for b in blocks if b.get("type") == 0]

        filtered = []
        for tb in text_blocks:
            tb_bbox = tb["bbox"]
            skip = False
            for table_bbox in table_bboxes:
                if self._bbox_overlap(tb_bbox, table_bbox) > 0.4:
                    skip = True
                    break
            if not skip:
                filtered.append(tb)

        sorted_blocks = ColumnDetector.sort_blocks(filtered, page_w)

        content_blocks: list[tuple[float, str, str]] = []

        for block in sorted_blocks:
            text = self.text_cleaner.extract_block_text(block)
            if not text.strip():
                continue

            y0 = block["bbox"][1]
            y1 = block["bbox"][3]

            if self.text_cleaner.is_page_number(y0, y1, page_h, text):
                continue
            if self.text_cleaner.is_chapter_header(text, y0, page_h):
                if len(text) < 80:
                    continue

            avg_font = self.text_cleaner.get_avg_font_size(block)

            if self.text_cleaner.is_mostly_uppercase(text) and len(text) < 100:
                text = f"## {text}"
            else:
                text = self.text_cleaner.detect_heading(text, avg_font, self.body_font_size)

            content_blocks.append((y0, "text", text))

        for idx, bbox in enumerate(table_bboxes):
            img_ref = self.image_renderer.render_table(page, bbox, page_no, idx)
            content_blocks.append((bbox[1], "table", f"\n\n![Table](images/{Path(img_ref).name})\n\n"))

        for idx, bbox in enumerate(image_bboxes):
            is_in_table = False
            for table_bbox in table_bboxes:
                if self._bbox_overlap(bbox, table_bbox) > 0.6:
                    is_in_table = True
                    break
            if is_in_table:
                continue
            img_ref = self.image_renderer.render_image(page, bbox, page_no, idx)
            content_blocks.append((bbox[1], "image", f"\n\n![Image](images/{Path(img_ref).name})\n\n"))

        content_blocks.sort(key=lambda x: x[0])

        merged_md = []
        for _, b_type, content in content_blocks:
            if b_type == "text":
                cleaned = self.text_cleaner.fix_linebreaks(content)
                merged_md.append(cleaned)
            else:
                merged_md.append(content)

        return '\n\n'.join(merged_md)

    def _bbox_overlap(self, box1: tuple, box2: tuple) -> float:
        x0_1, y0_1, x1_1, y1_1 = box1
        x0_2, y0_2, x1_2, y1_2 = box2

        ix0 = max(x0_1, x0_2)
        iy0 = max(y0_1, y0_2)
        ix1 = min(x1_1, x1_2)
        iy1 = min(y1_1, y1_2)

        if ix0 >= ix1 or iy0 >= iy1:
            return 0.0

        i_area = (ix1 - ix0) * (iy1 - iy0)
        box1_area = (x1_1 - x0_1) * (y1_1 - y0_1)

        if box1_area <= 0:
            return 0.0
        return i_area / box1_area
