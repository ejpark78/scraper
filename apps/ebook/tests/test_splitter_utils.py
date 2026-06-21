"""Tests for split_chapter utility functions and dataclasses."""

from pathlib import Path
from src.split_chapter import sanitize_filename, get_output_path, ChapterDef, BookProfile


def test_sanitize_filename_removes_special_chars():
    result = sanitize_filename("Intro: Chapter 1? (Basics)")
    assert "?" not in result
    assert ":" not in result
    assert result == "Intro Chapter 1 (Basics)"


def test_sanitize_filename_collapses_spaces():
    result = sanitize_filename("Hello    World")
    assert "  " not in result


def test_sanitize_filename_truncates():
    long_name = "A" * 200
    result = sanitize_filename(long_name)
    assert len(result) <= 120


def test_get_output_path_strips_extensions():
    assert get_output_path("The Book - Tom Taulli.pdf") == "The Book - Tom Taulli"
    assert get_output_path("Learning Python - Addy Osmani.pdf") == "Learning Python - Addy Osmani"
    assert get_output_path("Programming 101.pdf") == "Programming 101"
    assert get_output_path("My Book.epub") == "My Book"


def test_get_output_path_no_extension():
    assert get_output_path("simple.pdf") == "simple"
    assert get_output_path("My Book Title.pdf") == "My Book Title"


def test_chapter_def_defaults():
    ch = ChapterDef(title="Intro", start_page=1, end_page=10)
    assert ch.include is True


def test_chapter_def_custom():
    ch = ChapterDef(title="Skip", start_page=5, end_page=8, include=False)
    assert ch.include is False
    assert ch.start_page == 5
    assert ch.end_page == 8


def test_book_profile_creation():
    chapters = [
        ChapterDef("Ch1", 1, 20),
        ChapterDef("Ch2", 21, 40),
    ]
    profile = BookProfile(
        path=Path("/test/book.pdf"),
        title="Test Book",
        page_count=100,
        chapters=chapters,
    )
    assert profile.title == "Test Book"
    assert len(profile.chapters) == 2
    assert profile.body_font_size == 11.0
