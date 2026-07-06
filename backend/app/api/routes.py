"""
API routes.

Endpoints:
  POST /documents/upload          - upload a PDF, returns parsed document
  POST /documents/{id}/script     - generate script from a parsed document
  PUT  /documents/{id}/script      - submit edited script (user review step)
  POST /documents/{id}/render     - generate images + assemble comic pages
  GET  /documents/{id}/pages      - list generated page image paths

In-memory storage is used for MVP simplicity (documents/scripts stored
in dicts). Replace with a real database when moving past prototyping.
"""

import os
import uuid
import shutil

from fastapi import APIRouter, UploadFile, File, HTTPException

from app.models.schemas import ParsedDocument, Script, ScriptGenerationRequest
from app.pipeline.parsing import parse_pdf
from app.pipeline.scripting import generate_script, verify_simplification_levels
from app.pipeline.imagegen import generate_images
from app.pipeline.assembly import assemble_pages
from app.config import settings


router = APIRouter()

# In-memory stores (MVP only - replace with DB later)
_parsed_documents: dict[str, ParsedDocument] = {}
_scripts: dict[str, Script] = {}


@router.post("/documents/upload")
async def upload_document(file: UploadFile = File(...)) -> ParsedDocument:
    """Upload a PDF and parse it into structured sections."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    os.makedirs(settings.upload_dir, exist_ok=True)
    temp_filename = f"{uuid.uuid4()}.pdf"
    file_path = os.path.join(settings.upload_dir, temp_filename)

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    parsed = parse_pdf(file_path, filename=file.filename)
    _parsed_documents[parsed.document_id] = parsed

    return parsed


@router.post("/documents/{document_id}/script")
async def create_script(document_id: str, template: str = "research_paper") -> Script:
    """Generate a panel-by-panel script for a parsed document."""
    parsed = _parsed_documents.get(document_id)
    if not parsed:
        raise HTTPException(status_code=404, detail="Document not found")

    request = ScriptGenerationRequest(
        document_id=document_id,
        parsed_document=parsed,
        template=template,
    )

    try:
        script = generate_script(request)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"Script generation failed: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error during script generation: {e}")

    # Independent verification pass: re-check simplification_level ratings
    # against source text. If verification itself fails, keep the original
    # (unverified) script rather than failing the whole request - the
    # ratings are then less trustworthy but the script is still usable.
    try:
        script = verify_simplification_levels(script)
    except ValueError:
        pass

    _scripts[document_id] = script
    return script


@router.get("/documents/{document_id}/script")
async def get_script(document_id: str) -> Script:
    """Retrieve the current script (for review/editing)."""
    script = _scripts.get(document_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")
    return script


@router.put("/documents/{document_id}/script")
async def update_script(document_id: str, script: Script) -> Script:
    """Submit an edited script (user review step)."""
    if document_id not in _scripts:
        raise HTTPException(status_code=404, detail="Script not found")
    _scripts[document_id] = script
    return script


@router.post("/documents/{document_id}/render")
async def render_comic(document_id: str) -> dict:
    """Generate images for each panel and assemble comic pages."""
    script = _scripts.get(document_id)
    if not script:
        raise HTTPException(status_code=404, detail="Script not found")

    script = generate_images(script)
    page_paths = assemble_pages(script)

    _scripts[document_id] = script

    return {"document_id": document_id, "pages": page_paths}


@router.get("/documents/{document_id}/pages")
async def list_pages(document_id: str) -> dict:
    """List generated comic page paths for a document."""
    pages_dir = os.path.join(settings.output_dir, document_id, "pages")
    if not os.path.exists(pages_dir):
        return {"document_id": document_id, "pages": []}

    pages = sorted(os.listdir(pages_dir))
    return {"document_id": document_id, "pages": [os.path.join(pages_dir, p) for p in pages]}