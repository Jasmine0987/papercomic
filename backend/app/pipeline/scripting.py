"""
Script generation stage: ParsedDocument -> Script (panel-by-panel breakdown).

This is the core "intelligence" stage. It takes the structured text from
parsing and asks an LLM to produce a panel-by-panel script, where each
panel:
  - has a caption/dialogue
  - has a visual description (for image generation later)
  - references the exact source section/text it came from
  - is rated by how much it simplifies that source

The output is validated against the Panel/Script Pydantic models, so
malformed LLM output fails loudly here rather than corrupting later stages.
"""

import json
import re

from app.models.schemas import ParsedDocument, Script, Panel, ScriptGenerationRequest
from app.llm import get_llm_provider


TEMPLATES = {
    "research_paper": {
        "structure": "Background -> Method -> Results -> Implications",
        "guidance": (
            "Structure the comic in four acts: (1) Background - why this research "
            "matters and what problem it addresses, (2) Method - what the "
            "researchers did, (3) Results - what they found, (4) Implications - "
            "what it means and why it matters. Aim for 6-12 panels total."
        ),
    },
    "clinical_trial": {
        "structure": "Who was studied -> What was tested -> What happened -> What it means for patients",
        "guidance": (
            "Structure the comic around the patient experience: (1) Who was "
            "studied - the patient population and eligibility, (2) What was "
            "tested - the treatment/intervention and comparison, (3) What "
            "happened - results and any safety findings, (4) What it means for "
            "patients - practical implications. Use plain, accessible language "
            "suitable for a general patient audience. Aim for 6-12 panels."
        ),
    },
}


def _build_prompt(parsed_doc: ParsedDocument, template: str) -> str:
    template_config = TEMPLATES.get(template, TEMPLATES["research_paper"])

    # Build a compact representation of sections for the prompt
    sections_text = ""
    for section in parsed_doc.sections:
        # Truncate very long sections to keep prompt size manageable
        text = section.text[:3000]
        sections_text += (
            f"\n--- SECTION: {section.title} (pages {section.page_start}-{section.page_end}) ---\n"
            f"{text}\n"
        )

    prompt = f"""You are converting a research document into a manga/comic script.

DOCUMENT SECTIONS:
{sections_text}

TASK:
{template_config['guidance']}

For EACH panel, you must provide:
- panel_number: integer, sequential starting at 1
- caption: short narration text shown in the panel (1-2 sentences max)
- dialogue: optional line spoken by a recurring "Guide" narrator character explaining the concept (or null)
- visual_description: a description of the scene for an image generator (characters, setting, action, mood)
- source_ref: an object with:
    - page_number: the page number this content is based on (integer)
    - section: the section title this content is based on
    - text_snippet: the EXACT short quote (max ~200 chars) from the source text this panel is based on
- simplification_level: rate each panel using these STRICT tests, in order:

  "direct" - ONLY use this if you could point to a near-identical sentence in
  the source text that states the same fact. The caption must not add mood,
  emotion, outcome, or framing that isn't explicitly written in the source.

  "simplified" - use this when you condense, reorder, or restate source
  content in plainer language, but every concrete claim still traces back
  to something the source actually says.

  "analogy" - use this when you add ANY of the following that is not
  literally stated in the source: emotional framing ("hopeful", "relieved",
  "determined"), narrative outcomes not stated in the source (e.g. implying
  a case was resolved, a person felt a certain way, or a process succeeded,
  when the source does not say so), motivational/inspirational language
  ("there's hope", "fighting back", "empowering"), or invented dialogue
  expressing opinions/conclusions the source does not state.

  DO NOT rate a panel "direct" just because it is based on a real section of
  the source - check whether YOU added interpretation, mood, or narrative
  spin on top of that section. If in doubt between two levels, choose the
  LOWER-fidelity one (closer to "analogy"), not the higher one.

  Example of what NOT to mark as "direct": if the source says a tool
  "provides detection reports" and your caption says "there's hope, this
  tool is fighting back against injustice" - that is "analogy", because the
  hope/fighting-back framing is your addition, not the source's claim.

Respond with ONLY valid JSON in this exact format, no markdown fences, no extra text:
{{
  "title": "<short title for this comic>",
  "panels": [
    {{
      "panel_number": 1,
      "caption": "...",
      "dialogue": "...",
      "visual_description": "...",
      "source_ref": {{
        "page_number": 1,
        "section": "Introduction",
        "text_snippet": "..."
      }},
      "simplification_level": "direct"
    }}
  ]
}}
"""
    return prompt


def _strip_markdown_fences(text: str) -> str:
    """Some LLMs wrap JSON in ```json ... ``` fences despite instructions not to."""
    text = text.strip()
    fence_match = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.DOTALL)
    if fence_match:
        return fence_match.group(1)
    return text


def _build_verification_prompt(panels: list[Panel]) -> str:
    """
    Build a prompt for an independent verification pass: given each panel's
    caption/dialogue and the exact source snippet it claims to be based on,
    check whether the panel adds anything not present in the source.

    This is a separate call from generation so the model is evaluating
    content fresh, rather than re-confirming a rating it already gave itself
    in the same context as writing the panel.
    """
    panels_text = ""
    for panel in panels:
        panels_text += (
            f"\n--- PANEL {panel.panel_number} ---\n"
            f"SOURCE TEXT: \"{panel.source_ref.text_snippet}\"\n"
            f"PANEL CAPTION: \"{panel.caption}\"\n"
            f"PANEL DIALOGUE: \"{panel.dialogue or ''}\"\n"
            f"CURRENT RATING: {panel.simplification_level.value}\n"
        )

    prompt = f"""You are fact-checking a set of comic panels against the exact
source text each one claims to be based on.

For each panel below, compare the PANEL CAPTION and PANEL DIALOGUE against
the SOURCE TEXT only. Determine the correct simplification_level:

- "direct": caption/dialogue states only what the source text states, no
  added mood, emotion, outcome, or framing.
- "simplified": caption/dialogue condenses or rephrases the source, but
  every concrete claim still traces back to the source.
- "analogy": caption/dialogue adds emotional framing, narrative outcomes,
  motivational language, or claims/conclusions NOT present in the source
  text.

Be strict: if the panel adds any feeling, judgment, or implied outcome that
the source text does not literally state, it must be "analogy" regardless
of what CURRENT RATING says.

PANELS:
{panels_text}

Respond with ONLY valid JSON, no markdown fences, no extra text, in this format:
{{
  "verifications": [
    {{"panel_number": 1, "corrected_simplification_level": "direct", "reason": "short reason"}}
  ]
}}
"""
    return prompt


def verify_simplification_levels(script: Script) -> Script:
    """
    Run an independent verification pass over a generated script, correcting
    any simplification_level ratings that don't hold up against the source
    text. Mutates and returns the script with corrected ratings.

    This is intentionally a separate LLM call from generate_script() - see
    _build_verification_prompt for why a fresh evaluation catches more
    embellishment than self-grading in the same generation pass.
    """
    provider = get_llm_provider()
    prompt = _build_verification_prompt(script.panels)

    raw_response = provider.generate_json(prompt)
    cleaned = _strip_markdown_fences(raw_response)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        # Verification failing shouldn't break the pipeline - log and
        # return the script with its original (unverified) ratings.
        raise ValueError(
            f"Verification response was not valid JSON: {e}\nRaw response:\n{raw_response}"
        )

    corrections = {
        v["panel_number"]: v["corrected_simplification_level"]
        for v in data.get("verifications", [])
    }

    for panel in script.panels:
        if panel.panel_number in corrections:
            panel.simplification_level = corrections[panel.panel_number]

    return script


def generate_script(request: ScriptGenerationRequest) -> Script:
    """
    Generate a panel-by-panel script from a parsed document.

    Raises:
        ValueError: if the LLM response can't be parsed/validated into a Script
    """
    provider = get_llm_provider()
    prompt = _build_prompt(request.parsed_document, request.template)

    raw_response = provider.generate_json(prompt)
    cleaned = _strip_markdown_fences(raw_response)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(
            f"LLM response was not valid JSON: {e}\nRaw response:\n{raw_response}"
        )

    panels: list[Panel] = []
    for i, panel_data in enumerate(data.get("panels", []), start=1):
        try:
            panel = Panel(
                panel_id=f"p{i}",
                panel_number=panel_data.get("panel_number", i),
                caption=panel_data["caption"],
                dialogue=panel_data.get("dialogue"),
                visual_description=panel_data["visual_description"],
                source_ref=panel_data["source_ref"],
                simplification_level=panel_data["simplification_level"],
            )
            panels.append(panel)
        except (KeyError, ValueError) as e:
            raise ValueError(f"Panel {i} failed validation: {e}\nPanel data: {panel_data}")

    return Script(
        document_id=request.document_id,
        title=data.get("title", request.parsed_document.filename),
        panels=panels,
    )