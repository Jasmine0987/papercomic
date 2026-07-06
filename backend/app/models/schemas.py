"""
Core data models for the pipeline.

The Panel model is the central data structure of the whole product:
it links generated visual/narrative content back to its source location
in the original document, and rates how much it simplifies that source.
This is the "source-traceable, simplification-rated panel" architecture
described in the PRD.
"""

from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


class SimplificationLevel(str, Enum):
    """How much a panel simplifies/changes the source content."""
    DIRECT = "direct"          # green - close restatement of source
    SIMPLIFIED = "simplified"  # yellow - condensed/simplified
    ANALOGY = "analogy"        # red - metaphor/analogy used, not literal


class SourceRef(BaseModel):
    """A reference back to a specific location in the source document."""
    page_number: int = Field(..., description="1-indexed page number in source PDF")
    section: Optional[str] = Field(None, description="Section name, e.g. 'Methods'")
    text_snippet: str = Field(..., description="The exact source text this panel is based on")
    char_start: Optional[int] = Field(None, description="Character offset start in page text")
    char_end: Optional[int] = Field(None, description="Character offset end in page text")


class Panel(BaseModel):
    """A single comic/manga panel."""
    panel_id: str = Field(..., description="Unique identifier, e.g. 'p1', 'p2'")
    panel_number: int = Field(..., description="Order in the comic, 1-indexed")
    caption: str = Field(..., description="Narration/caption text shown in the panel")
    dialogue: Optional[str] = Field(None, description="Dialogue spoken by the Guide character, if any")
    visual_description: str = Field(..., description="Description of the scene for image generation")
    source_ref: SourceRef = Field(..., description="Where this panel's content came from in the source doc")
    simplification_level: SimplificationLevel = Field(
        ..., description="How much this panel simplifies the source"
    )
    image_path: Optional[str] = Field(None, description="Path to generated image, once created")


class DocumentSection(BaseModel):
    """A structural section extracted from the source PDF."""
    title: str = Field(..., description="Section title, e.g. 'Abstract', 'Methods'")
    page_start: int
    page_end: int
    text: str


class ParsedDocument(BaseModel):
    """Output of the parsing stage."""
    document_id: str
    filename: str
    total_pages: int
    sections: list[DocumentSection]
    raw_text_by_page: dict[int, str] = Field(
        default_factory=dict, description="Full text per page, keyed by page number"
    )


class Script(BaseModel):
    """Output of the script generation stage - the full panel-by-panel breakdown."""
    document_id: str
    title: str
    panels: list[Panel]


class ScriptGenerationRequest(BaseModel):
    """Input to the script generation stage."""
    document_id: str
    parsed_document: ParsedDocument
    template: str = Field(
        default="research_paper",
        description="Domain template to use, e.g. 'research_paper', 'clinical_trial'"
    )