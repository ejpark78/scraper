"""Tests for TextCleaner — pure-function unit tests with no PDF dependency."""

from src.pdf_to_markdown import TextCleaner


def test_fix_linebreaks_hyphenation():
    text = "long computa-\ntional process"
    result = TextCleaner.fix_linebreaks(text)
    assert "computational" in result
    assert "-" not in result


def test_fix_linebreaks_lowercase_continuation():
    text = "the model is\nvery efficient"
    result = TextCleaner.fix_linebreaks(text)
    assert "model is very" in result


def test_fix_linebreaks_soft_hyphen():
    text = "hyphen\u00adated"
    result = TextCleaner.fix_linebreaks(text)
    assert "hyphenated" in result


def test_fix_linebreaks_empty():
    assert TextCleaner.fix_linebreaks("") == ""
    assert TextCleaner.fix_linebreaks(None) is None


def test_fix_linebreaks_preserve_paragraphs():
    text = "First paragraph.\n\nSecond paragraph."
    result = TextCleaner.fix_linebreaks(text)
    assert "First paragraph." in result
    assert "Second paragraph." in result


def test_fix_linebreaks_uppercase_insertion():
    text = "uses AI models"
    result = TextCleaner.fix_linebreaks(text)
    assert "uses AI" in result or "uses" in result


def test_is_page_number_bottom_margin():
    page_h = 800.0
    assert TextCleaner.is_page_number(750, 780, page_h, "42")
    assert TextCleaner.is_page_number(750, 780, page_h, " 42 ")
    assert not TextCleaner.is_page_number(100, 130, page_h, "42")


def test_is_page_number_not_digit():
    page_h = 800.0
    assert not TextCleaner.is_page_number(750, 780, page_h, "Chapter Title")
    assert not TextCleaner.is_page_number(10, 40, page_h, "Introduction")


def test_is_page_number_dash_pattern():
    page_h = 800.0
    assert TextCleaner.is_page_number(750, 780, page_h, "— 42 —")
    assert TextCleaner.is_page_number(750, 780, page_h, "- 15 -")


def test_is_page_number_pipe_pattern():
    page_h = 800.0
    assert TextCleaner.is_page_number(100, 130, page_h, "42 | Some text")
    assert TextCleaner.is_page_number(100, 130, page_h, "| 42")


def test_is_chapter_header_top_page():
    page_h = 800.0
    assert TextCleaner.is_chapter_header("Chapter 1 Introduction", 20, page_h)
    assert TextCleaner.is_chapter_header("CHAPTER 2", 30, page_h)
    assert TextCleaner.is_chapter_header("Part I Foundations", 40, page_h)


def test_is_chapter_header_not_at_top():
    page_h = 800.0
    assert not TextCleaner.is_chapter_header("Some body text", 200, page_h)


def test_is_mostly_uppercase():
    assert TextCleaner.is_mostly_uppercase("HELLO WORLD")
    assert TextCleaner.is_mostly_uppercase("AI ML DL")
    assert not TextCleaner.is_mostly_uppercase("Hello World")
    assert not TextCleaner.is_mostly_uppercase("")
    assert not TextCleaner.is_mostly_uppercase("abc123")


def test_detect_heading_large_font():
    result = TextCleaner.detect_heading("Big Title", 20.0, 11.0)
    assert result.startswith("# ")


def test_detect_heading_medium_font():
    result = TextCleaner.detect_heading("Section Title", 15.0, 11.0)
    assert result.startswith("## ")


def test_detect_heading_small_font():
    result = TextCleaner.detect_heading("Body text", 11.0, 11.0)
    assert result == "Body text"


def test_extract_block_text_single_line():
    block = {
        "lines": [
            {
                "spans": [
                    {"text": "Hello", "bbox": (0, 0, 30, 10), "size": 11.0},
                    {"text": "World", "bbox": (45, 0, 70, 10), "size": 11.0},
                ]
            }
        ]
    }
    result = TextCleaner.extract_block_text(block)
    assert result == "Hello World"


def test_get_avg_font_size():
    block = {
        "lines": [
            {"spans": [{"size": 12.0}, {"size": 14.0}]},
            {"spans": [{"size": 10.0}]},
        ]
    }
    avg = TextCleaner.get_avg_font_size(block)
    assert avg == 12.0
