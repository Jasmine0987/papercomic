"""
Test the parsing stage with a generated sample PDF.

This test runs entirely locally with no API calls - safe to run
on CPU-only hardware as part of basic CI/development checks.
"""

import os
import fitz  # PyMuPDF

from app.pipeline.parsing import parse_pdf


def _create_sample_pdf(path: str):
    """Create a minimal sample PDF with section-like headings for testing."""
    doc = fitz.open()
    page = doc.new_page()

    text = (
        "Abstract\n"
        "This paper studies an interesting phenomenon in a small sample.\n\n"
        "Introduction\n"
        "The problem has been studied before but not in this context.\n\n"
        "Methods\n"
        "We collected data from 100 participants over six months.\n\n"
        "Results\n"
        "We found a statistically significant effect (p < 0.05).\n\n"
        "Conclusion\n"
        "This effect has implications for future research.\n"
    )

    page.insert_text((50, 50), text, fontsize=11)
    doc.save(path)
    doc.close()


def test_parse_pdf_extracts_sections(tmp_path):
    pdf_path = os.path.join(tmp_path, "sample.pdf")
    _create_sample_pdf(pdf_path)

    parsed = parse_pdf(pdf_path, filename="sample.pdf")

    assert parsed.filename == "sample.pdf"
    assert parsed.total_pages == 1
    assert len(parsed.sections) > 0

    section_titles = [s.title for s in parsed.sections]
    # At minimum, we should detect some of the common headings
    assert any(title in ["Abstract", "Introduction", "Methods", "Results", "Conclusion"]
               for title in section_titles)


def test_parse_pdf_raw_text_by_page(tmp_path):
    pdf_path = os.path.join(tmp_path, "sample.pdf")
    _create_sample_pdf(pdf_path)

    parsed = parse_pdf(pdf_path, filename="sample.pdf")

    assert 1 in parsed.raw_text_by_page
    assert "Abstract" in parsed.raw_text_by_page[1]