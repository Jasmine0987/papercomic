"""
Test the script generation stage using a mocked LLM provider.

This test does NOT call any real API - it mocks the LLM provider to
return a fixed JSON response, so it validates the prompt-building,
JSON parsing, and Pydantic validation logic in isolation.
"""

import json
from unittest.mock import patch

from app.models.schemas import ParsedDocument, DocumentSection, ScriptGenerationRequest
from app.pipeline.scripting import generate_script


FAKE_LLM_RESPONSE = json.dumps({
    "title": "The Mystery of the Significant Effect",
    "panels": [
        {
            "panel_number": 1,
            "caption": "Scientists wondered why this effect happens.",
            "dialogue": "Let's find out together!",
            "visual_description": "A researcher looking thoughtfully at a chart, lab background",
            "source_ref": {
                "page_number": 1,
                "section": "Introduction",
                "text_snippet": "The problem has been studied before but not in this context."
            },
            "simplification_level": "simplified"
        },
        {
            "panel_number": 2,
            "caption": "They gathered data from 100 participants over six months.",
            "dialogue": None,
            "visual_description": "A montage of diverse participants over a calendar timeline",
            "source_ref": {
                "page_number": 1,
                "section": "Methods",
                "text_snippet": "We collected data from 100 participants over six months."
            },
            "simplification_level": "direct"
        }
    ]
})


def _make_parsed_document() -> ParsedDocument:
    return ParsedDocument(
        document_id="test-doc-1",
        filename="sample.pdf",
        total_pages=1,
        sections=[
            DocumentSection(
                title="Introduction",
                page_start=1,
                page_end=1,
                text="The problem has been studied before but not in this context.",
            ),
            DocumentSection(
                title="Methods",
                page_start=1,
                page_end=1,
                text="We collected data from 100 participants over six months.",
            ),
        ],
        raw_text_by_page={1: "Introduction\n...\nMethods\n..."},
    )


@patch("app.pipeline.scripting.get_llm_provider")
def test_generate_script_parses_valid_response(mock_get_provider):
    mock_provider = mock_get_provider.return_value
    mock_provider.generate_json.return_value = FAKE_LLM_RESPONSE

    request = ScriptGenerationRequest(
        document_id="test-doc-1",
        parsed_document=_make_parsed_document(),
        template="research_paper",
    )

    script = generate_script(request)

    assert script.document_id == "test-doc-1"
    assert script.title == "The Mystery of the Significant Effect"
    assert len(script.panels) == 2

    panel1 = script.panels[0]
    assert panel1.panel_id == "p1"
    assert panel1.simplification_level == "simplified"
    assert panel1.source_ref.section == "Introduction"

    panel2 = script.panels[1]
    assert panel2.dialogue is None
    assert panel2.simplification_level == "direct"


@patch("app.pipeline.scripting.get_llm_provider")
def test_generate_script_handles_markdown_fences(mock_get_provider):
    mock_provider = mock_get_provider.return_value
    mock_provider.generate_json.return_value = f"```json\n{FAKE_LLM_RESPONSE}\n```"

    request = ScriptGenerationRequest(
        document_id="test-doc-1",
        parsed_document=_make_parsed_document(),
        template="research_paper",
    )

    script = generate_script(request)
    assert len(script.panels) == 2


@patch("app.pipeline.scripting.get_llm_provider")
def test_verify_simplification_levels_applies_corrections(mock_get_provider):
    from app.pipeline.scripting import verify_simplification_levels
    from app.models.schemas import Script, Panel, SourceRef

    script = Script(
        document_id="test-doc-1",
        title="Test",
        panels=[
            Panel(
                panel_id="p1", panel_number=1,
                caption="There's hope - this tool is fighting back!",
                dialogue=None,
                visual_description="x",
                source_ref=SourceRef(page_number=1, section="Intro", text_snippet="The tool detects fakes."),
                simplification_level="direct",  # incorrectly self-rated
            ),
        ],
    )

    mock_provider = mock_get_provider.return_value
    mock_provider.generate_json.return_value = json.dumps({
        "verifications": [
            {"panel_number": 1, "corrected_simplification_level": "analogy", "reason": "added hope/fighting framing not in source"}
        ]
    })

    corrected = verify_simplification_levels(script)

    assert corrected.panels[0].simplification_level == "analogy"


@patch("app.pipeline.scripting.get_llm_provider")
def test_generate_script_raises_on_invalid_json(mock_get_provider):
    mock_provider = mock_get_provider.return_value
    mock_provider.generate_json.return_value = "not valid json at all"

    request = ScriptGenerationRequest(
        document_id="test-doc-1",
        parsed_document=_make_parsed_document(),
        template="research_paper",
    )

    try:
        generate_script(request)
        assert False, "Expected ValueError"
    except ValueError as e:
        assert "not valid JSON" in str(e)