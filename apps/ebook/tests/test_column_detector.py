"""Tests for ColumnDetector — pure sorting logic with no PDF dependency."""

from src.pdf_to_markdown import ColumnDetector


def _make_block(x0, y0, x1, y1):
    return {"bbox": (x0, y0, x1, y1)}


def test_single_column_returns_sorted_by_y():
    blocks = [
        _make_block(50, 200, 500, 250),
        _make_block(50, 100, 500, 150),
        _make_block(50, 300, 500, 350),
    ]
    result = ColumnDetector.sort_blocks(blocks, 600)
    assert result[0]["bbox"][1] == 100
    assert result[1]["bbox"][1] == 200
    assert result[2]["bbox"][1] == 300


def test_two_columns_reading_order():
    blocks = [
        _make_block(300, 100, 500, 150),
        _make_block(50, 100, 250, 150),
        _make_block(50, 200, 250, 250),
        _make_block(300, 200, 500, 250),
    ]
    result = ColumnDetector.sort_blocks(blocks, 600)
    assert len(result) == 4
    assert result[0]["bbox"][0] < 300
    assert result[1]["bbox"][0] < 300
    assert result[2]["bbox"][0] >= 300
    assert result[3]["bbox"][0] >= 300


def test_empty_blocks():
    assert ColumnDetector.sort_blocks([], 600) == []


def test_single_block():
    block = _make_block(100, 100, 400, 150)
    assert ColumnDetector.sort_blocks([block], 600) == [block]
