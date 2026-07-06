"""
Parsing stage: PDF -> ParsedDocument (structured text + section detection).

This stage runs entirely locally with no API calls - safe to develop
and test on CPU-only hardware.

Section detection here uses a simple heuristic (font size / boldness of
lines to detect headings). This is intentionally basic for the MVP;
it can be improved later without changing the output schema, since
everything downstream consumes ParsedDocument regardless of how
sections were detected.
"""

import uuid
import fitz  # PyMuPDF

from app.models.schemas import ParsedDocument, DocumentSection


# Common section headings in research papers - used to help detect
# section boundaries even when font-size heuristics are unreliable.
COMMON_SECTION_TITLES = [
    "abstract", "introduction", "background", "related work",
    "methods", "methodology", "materials and methods",
    "results", "discussion", "conclusion", "conclusions",
    "references", "acknowledgements", "acknowledgments",
]


def _looks_like_heading(line: str) -> str | None:
    """
    Returns a normalized section title if the line looks like a section
    heading, otherwise None.
    """
    stripped = line.strip()
    if not stripped or len(stripped) > 60:
        return None

    lowered = stripped.lower().strip(" .:0123456789")

    for title in COMMON_SECTION_TITLES:
        if lowered == title:
            return stripped.strip(" .:0123456789").title()

    return None


def parse_pdf(file_path: str, filename: str) -> ParsedDocument:
    """
    Parse a PDF file into a ParsedDocument with per-page text and
    detected sections.

    Args:
        file_path: path to the PDF file on disk
        filename: original filename (for display purposes)

    Returns:
        ParsedDocument with raw text per page and detected sections
    """
    doc = fitz.open(file_path)

    raw_text_by_page: dict[int, str] = {}
    sections: list[DocumentSection] = []

    current_section_title = "Front Matter"
    current_section_start_page = 1
    current_section_text_parts: list[str] = []

    for page_index in range(len(doc)):
        page_number = page_index + 1  # 1-indexed
        page = doc[page_index]
        page_text = page.get_text("text")
        raw_text_by_page[page_number] = page_text

        for line in page_text.split("\n"):
            heading = _looks_like_heading(line)
            if heading:
                # Close off the previous section
                if current_section_text_parts:
                    sections.append(DocumentSection(
                        title=current_section_title,
                        page_start=current_section_start_page,
                        page_end=page_number,
                        text="\n".join(current_section_text_parts).strip(),
                    ))
                # Start new section
                current_section_title = heading
                current_section_start_page = page_number
                current_section_text_parts = []
            else:
                current_section_text_parts.append(line)

    # Close off the final section
    if current_section_text_parts:
        sections.append(DocumentSection(
            title=current_section_title,
            page_start=current_section_start_page,
            page_end=len(doc),
            text="\n".join(current_section_text_parts).strip(),
        ))

    parsed = ParsedDocument(
        document_id=str(uuid.uuid4()),
        filename=filename,
        total_pages=len(doc),
        sections=sections,
        raw_text_by_page=raw_text_by_page,
    )

    doc.close()
    return parsed