import os, io, base64, json, time, uuid
import secrets  # For generating random tokens
import hashlib  # For hashing
import hmac     # For signature verification
from datetime import datetime, timedelta
from typing import Optional, List
import razorpay
import httpx
from fastapi import (
    FastAPI, File, Form, UploadFile, HTTPException,
    Depends, status, BackgroundTasks, Request
)
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, JSONResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db import users_col, comics_col, contact_col, webhook_logs_col
from google import genai as genai_client
from google.genai import types as genai_types
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import jwt as pyjwt
import google.generativeai as genai
from pydantic import constr, validator
import re
from dotenv import load_dotenv
load_dotenv()

import logging

# Logging setup
logger = logging.getLogger("papercomic")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler.setFormatter(formatter)
logger.addHandler(handler)

# ── Config ──────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET")
if not SECRET_KEY:
    raise ValueError("JWT_SECRET environment variable is required!")
ALGORITHM    = "HS256"
TOKEN_EXPIRE = 60        # 7 days in minutes
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB max PDF size
GEMINI_API_KEY        = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
GOOGLE_CLIENT_ID      = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET  = os.getenv("GOOGLE_CLIENT_SECRET", "")
GOOGLE_REDIRECT_URI   = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback")
FRONTEND_URL          = os.getenv("FRONTEND_URL", "http://localhost:3000")
RAZORPAY_KEY_ID        = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET    = os.getenv("RAZORPAY_KEY_SECRET", "")
RAZORPAY_WEBHOOK_SECRET = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
RAZORPAY_PRO_PLAN_ID   = os.getenv("RAZORPAY_PRO_PLAN_ID", "")
RAZORPAY_TEAM_PLAN_ID  = os.getenv("RAZORPAY_TEAM_PLAN_ID", "")
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)) if RAZORPAY_KEY_ID else None

PLAN_LIMITS = {
    "free": {"generation_limit": 3, "use_premium_art": False},
    "pro":  {"generation_limit": None, "use_premium_art": True},
    "team": {"generation_limit": None, "use_premium_art": True},
}
# ── FastAPI app ─────────────────────────────────────────────────────────────
app = FastAPI(title="PaperComic API", version="1.0.0")

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

ENV = os.getenv("ENV", "development")
if ENV == "production":
    cors_origins = [FRONTEND_URL]
else:
    cors_origins = ["http://localhost:3000", FRONTEND_URL]

# Set allowed origins based on environment
allowed_origins = [FRONTEND_URL]
if ENV != "production":
    allowed_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # Explicit, not *
    allow_headers=["Content-Type", "Authorization"],  # Explicit, not *
    expose_headers=["Content-Length"],
    max_age=600,
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    if ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
    
    response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';"
    
    return response

# ── Auth helpers ────────────────────────────────────────────────────────────
pwd_ctx    = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_sch = HTTPBearer(auto_error=False)

def hash_password(pw: str) -> str:
    return pwd_ctx.hash(pw)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

def create_token(user_id: str, name: str, email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=TOKEN_EXPIRE)
    payload = {
        "sub": user_id,
        "name": name,
        "email": email,
        "exp": expire,
        "iat": datetime.utcnow(),  # Issue time
        "type": "access"  # Token type
    }
    token = pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    logger.info(f"token_created for user {user_id}")
    return token

async def current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_sch),
):
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id or payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await users_col.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except pyjwt.ExpiredSignatureError:
        logger.warning("token_expired")
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.PyJWTError as e:
        logger.warning(f"token_invalid: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

# ── Gemini setup ────────────────────────────────────────────────────────────
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# ── Pydantic models ─────────────────────────────────────────────────────────


class RegisterRequest(BaseModel):
    name: constr(min_length=2, max_length=100)
    email: EmailStr
    password: constr(min_length=12, max_length=128)
    
    @validator("name")
    def validate_name(cls, v):
        if not re.match(r"^[a-zA-Z0-9\s\-'\.]+$", v):
            raise ValueError("Name contains invalid characters")
        return v
    
    @validator("password")
    def validate_password(cls, v):
        errors = []
        if not re.search(r"[A-Z]", v):
            errors.append("uppercase letter")
        if not re.search(r"[a-z]", v):
            errors.append("lowercase letter")
        if not re.search(r"[0-9]", v):
            errors.append("digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            errors.append("special character")
        if errors:
            raise ValueError(f"Password must contain: {', '.join(errors)}")
        return v

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class PanelScript(BaseModel):
    caption: str
    dialogue: str
    image_prompt: str
    scene_description: Optional[str] = None

class IllustrateRequest(BaseModel):
    comic_id: str
    panels: List[PanelScript]

class ContactRequest(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str

# ═══════════════════════════════════════════════════════════════════════════
# AUTH ROUTES
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/auth/register")
@limiter.limit("3/minute")
@limiter.limit("20/hour")
async def register(body: RegisterRequest, request: Request):
    existing = await users_col.find_one({"email": body.email})
    if existing:
        logger.warning(f"register_duplicate: {body.email}")
        # Don't reveal if email exists
        raise HTTPException(status_code=400, detail="Registration failed. Please try again.")
    
    user_id = str(uuid.uuid4())
    user = {
        "_id": user_id,
        "name": body.name,
        "email": body.email,
        "password_hash": hash_password(body.password),
        "provider": "email",
        "free_generations_used": 0,
        "plan": "free",
        "mfa_enabled": False,
        "created_at": datetime.utcnow().isoformat(),
    }
    await users_col.insert_one(user)
    
    logger.info(f"register_success: {user_id}")
    token = create_token(user_id, body.name, body.email)
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/auth/login")
@limiter.limit("3/minute")
@limiter.limit("10/hour")
async def login(body: LoginRequest, request: Request):
    user = await users_col.find_one({"email": body.email})
    
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        logger.warning(f"login_failed: {body.email} from {request.client.host}")
        # Generic message prevents enumeration
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    logger.info(f"login_success: {user['_id']} from {request.client.host}")
    token = create_token(user["_id"], user["name"], user["email"])
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/auth/google/start")
@limiter.limit("10/minute")
async def google_oauth_start(request: Request, response: Response):
    """Start OAuth flow with CSRF protection (state parameter)"""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="OAuth not configured")
    
    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    
    # Store state in secure HTTP-only cookie
    response.set_cookie(
        "oauth_state",
        state,
        httponly=True,
        secure=ENV == "production",
        samesite="lax",
        max_age=600  # 10 minutes
    )
    response.set_cookie(
        "oauth_nonce",
        nonce,
        httponly=True,
        secure=ENV == "production",
        samesite="lax",
        max_age=600
    )
    
    return {"state": state, "nonce": nonce}


@app.get("/api/auth/google/callback")
@limiter.limit("20/minute")
async def google_oauth_callback(
    code: str,
    state: str,
    request: Request
):
    """Handle OAuth callback with state validation and ID token verification"""
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="OAuth not configured")
    
    # Validate state
    cookies = request.cookies
    stored_state = cookies.get("oauth_state")
    if not stored_state or stored_state != state:
        logger.warning(f"oauth_state_mismatch from {request.client.host}")
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
    
    try:
        async with httpx.AsyncClient() as client:
            # Exchange code for tokens
            token_res = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
                timeout=10.0
            )
            
            if token_res.status_code != 200:
                logger.error(f"oauth_token_error: {token_res.text}")
                raise HTTPException(status_code=400, detail="OAuth token exchange failed")
            
            token_data = token_res.json()
            id_token_str = token_data.get("id_token", "")
            
            if not id_token_str:
                raise HTTPException(status_code=400, detail="No ID token received")
            
            # ✅ VERIFY ID TOKEN SIGNATURE (critical!)
            from google.auth.transport import requests as google_requests
            from google.oauth2 import id_token
            
            try:
                idinfo = id_token.verify_oauth2_token(
                    id_token_str,
                    google_requests.Request(),
                    GOOGLE_CLIENT_ID
                )
            except ValueError as e:
                logger.error(f"oauth_id_token_invalid: {str(e)}")
                raise HTTPException(status_code=400, detail="Invalid ID token")
            
            email = idinfo.get("email")
            name = idinfo.get("name", email.split("@")[0])
            gid = idinfo.get("sub")
            
            if not email or not gid:
                raise HTTPException(status_code=400, detail="Missing OAuth info")
    
    except httpx.TimeoutException:
        logger.error("oauth_timeout")
        raise HTTPException(status_code=500, detail="OAuth timeout")
    except httpx.HTTPError as e:
        logger.error(f"oauth_http_error: {str(e)}")
        raise HTTPException(status_code=500, detail="OAuth service error")
    
    # Upsert user
    user = await users_col.find_one({"email": email})
    if not user:
        user_id = str(uuid.uuid4())
        user = {
            "_id": user_id,
            "name": name,
            "email": email,
            "provider": "google",
            "google_id": gid,
            "free_generations_used": 0,
            "plan": "free",
            "mfa_enabled": False,
            "created_at": datetime.utcnow().isoformat(),
        }
        await users_col.insert_one(user)
        logger.info(f"oauth_user_created: {user_id}")
    else:
        logger.info(f"oauth_user_login: {user['_id']}")
    
    token = create_token(user["_id"], user["name"], user["email"])
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/auth/me")
async def whoami(user=Depends(current_user)):
    plan = user.get("plan", "free")
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    return {
        "id": user["_id"],
        "name": user["name"],
        "email": user["email"],
        "plan": plan,
        "free_generations_used": user.get("free_generations_used", 0),
        "free_generation_limit": limits["generation_limit"],
        "is_premium": plan != "free",
    }

# ═══════════════════════════════════════════════════════════════════════════
# CONVERT ROUTES
# ═══════════════════════════════════════════════════════════════════════════

SCRIPT_SYSTEM_PROMPT = """You are a comic scriptwriter. Given the text of an academic paper, 
write a comic script that makes the paper's key ideas easy to understand.

Return ONLY a JSON array (no markdown, no preamble) of panel objects, each with:
- caption: (string) a short descriptive narration for this panel, max 25 words
- dialogue: (string) spoken words from a character in this panel, max 20 words
- image_prompt: (string) a detailed illustration prompt for an AI image generator, 
  describing the scene, characters, and visual style. Use manga/sketch style.
- scene_description: (string) brief description of what happens in this scene

Target a mix of explanation, drama, and humour. Keep jargon minimal. 
Output exactly the number of panels requested."""

OUTLINE_SYSTEM_PROMPT = """You are analyzing an academic paper or document to break it into
major topics for a multi-part comic series. 

Return ONLY a JSON array (no markdown, no preamble) of topic objects, each with:
- topic_id: (string) short slug, e.g. "introduction", "methodology", "results"
- title: (string) short human-readable title for this topic, max 6 words
- summary: (string) one-sentence summary of what this topic covers, max 25 words

Identify between 3 and 8 major topics depending on the document's length and structure.
Order them in the same sequence they appear in the document."""


@app.post("/api/convert/outline")
@limiter.limit("10/hour")
async def convert_outline(
    request: Request,
    file: UploadFile = File(...),
    user=Depends(current_user),
):
    """Analyze a PDF and return a list of major topics, each of which can
    later be turned into its own mini-comic via /api/convert/script."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")

    source_id = str(uuid.uuid4())

    if not GEMINI_API_KEY:
        topics = [
            {"topic_id": f"topic-{i+1}", "title": f"Topic {i+1}", "summary": f"Mock summary for topic {i+1}."}
            for i in range(4)
        ]
        return {"source_id": source_id, "filename": file.filename, "topics": topics, "pdf_b64": None}

    try:
        b64_pdf = base64.b64encode(pdf_bytes).decode()
        model = genai.GenerativeModel(GEMINI_MODEL)
        response = model.generate_content([
            OUTLINE_SYSTEM_PROMPT,
            {"mime_type": "application/pdf", "data": b64_pdf},
        ])
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        topics = json.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Outline generation failed: {str(e)}")

    return {
        "source_id": source_id,
        "filename": file.filename,
        "topics": topics,
        "pdf_b64": base64.b64encode(pdf_bytes).decode(),
    }

@app.post("/api/convert/script")
@limiter.limit("10/hour")
async def convert_script(
    request: Request,
    file: UploadFile = File(None),
    pdf_b64: str = Form(None),
    filename: str = Form(None),
    style: str = Form("manga"),
    panel_count: int = Form(8),
    language: str = Form("en"),
    topic_title: str = Form(None),
    topic_summary: str = Form(None),
    source_id: str = Form(None),
    user=Depends(current_user),
):
    if file is not None:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are accepted")
        pdf_bytes = await file.read()
        source_filename = file.filename
    elif pdf_b64:
        pdf_bytes = base64.b64decode(pdf_b64)
        source_filename = filename or "document.pdf"
    else:
        raise HTTPException(status_code=400, detail="Provide either a file or pdf_b64")

    if len(pdf_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50 MB)")

    topic_scope = ""
    if topic_title:
        topic_scope = (
            f"\n\nIMPORTANT: Only cover this specific topic from the document, "
            f"not the whole thing: \"{topic_title}\" — {topic_summary or ''}\n"
            f"Skip unrelated sections entirely."
        )

    if not GEMINI_API_KEY:
        comic_id = str(uuid.uuid4())
        mock_panels = [
            {
                "caption": f"Panel {i+1}: A key concept from the paper emerges.",
                "dialogue": "This is fascinating research!",
                "image_prompt": f"Manga-style panel showing a researcher discovering insight #{i+1}",
                "scene_description": f"Scene {i+1} of the paper's main argument",
            }
            for i in range(panel_count)
        ]
        await comics_col.insert_one({
            "_id": comic_id,
            "user_id": user["_id"],
            "title": topic_title or source_filename.replace(".pdf", ""),
            "source_filename": source_filename,
            "source_id": source_id or comic_id,
            "topic_title": topic_title,
            "panel_count": panel_count,
            "style": style,
            "language": language,
            "status": "scripted",
            "panels": mock_panels,
            "created_at": datetime.utcnow().isoformat(),
        })
        return {"comic_id": comic_id, "panels": mock_panels}

    try:
        b64_pdf = base64.b64encode(pdf_bytes).decode()
        model = genai.GenerativeModel(GEMINI_MODEL)
        prompt = (
            f"{SCRIPT_SYSTEM_PROMPT}\n\n"
            f"Style: {style}\n"
            f"Panel count: {panel_count}\n"
            f"Output language: {language}"
            f"{topic_scope}\n\n"
            "Here is the PDF content:"
        )
        response = model.generate_content([
            prompt,
            {"mime_type": "application/pdf", "data": b64_pdf},
        ])
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        panels = json.loads(raw)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Script generation failed: {str(e)}")

    comic_id = str(uuid.uuid4())
    await comics_col.insert_one({
        "_id": comic_id,
        "user_id": user["_id"],
        "title": topic_title or source_filename.replace(".pdf", ""),
        "source_filename": source_filename,
        "source_id": source_id or comic_id,
        "topic_title": topic_title,
        "panel_count": len(panels),
        "style": style,
        "language": language,
        "status": "scripted",
        "panels": panels,
        "created_at": datetime.utcnow().isoformat(),
    })
    return {"comic_id": comic_id, "panels": panels}

IMAGE_SYSTEM_PROMPT = (
    "Create a comic panel illustration in {style} style. "
    "Black ink linework with pastel color fills. "
    "Bold outlines, expressive characters, clear visual storytelling. "
    "Scene: {prompt}"
)

@app.post("/api/convert/illustrate")
async def convert_illustrate(
    body: IllustrateRequest,
    user=Depends(current_user),
):
    comic = await comics_col.find_one({"_id": body.comic_id, "user_id": user["_id"]})
    if not comic:
        logger.warning(f"illustration_comic_not_found: {user['_id']}")
        raise HTTPException(status_code=404, detail="Comic not found")

    plan = user.get("plan", "free")
    limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])
    generation_limit = limits["generation_limit"]
    used = user.get("free_generations_used", 0)
    is_unlimited = generation_limit is None

    if not is_unlimited and used >= generation_limit:
        raise HTTPException(
            status_code=402,
            detail={
                "message": "You've used all your free comic generations.",
                "free_generations_used": used,
                "free_generation_limit": generation_limit,
                "upgrade_required": True,
            },
        )

    illustrated_panels = []

    USE_FREE_IMAGES = not limits["use_premium_art"]
    if limits["use_premium_art"] and not GEMINI_API_KEY:
        USE_FREE_IMAGES = True
    if USE_FREE_IMAGES:
        # ── Free image generation via Pollinations.ai (no key, no cost) ──
        from urllib.parse import quote
        for panel in body.panels:
            image_url = None
            try:
                full_prompt = IMAGE_SYSTEM_PROMPT.format(
                    style=comic.get("style", "manga"),
                    prompt=panel.image_prompt,
                )
                encoded = quote(full_prompt[:500])  # keep URL reasonably short
                url = (
                    f"https://image.pollinations.ai/prompt/{encoded}"
                    f"?width=768&height=768&nologo=true"
                )
                async with httpx.AsyncClient(timeout=60.0) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        b64 = base64.b64encode(resp.content).decode()
                        image_url = f"data:image/jpeg;base64,{b64}"
                    else:
                        print(f"[illustrate] pollinations returned {resp.status_code}")
            except Exception as e:
                print(f"[illustrate] free image generation failed: {e}")
            illustrated_panels.append({
                **panel.dict(),
                "image_url": image_url,
            })
    elif not GEMINI_API_KEY:
        # Dev fallback — return panels without images
        for i, panel in enumerate(body.panels):
            illustrated_panels.append({
                **panel.dict(),
                "image_url": None,
            })
    else:
        # ── Real Gemini image generation via google-genai SDK (paid) ─────
        try:
            client = genai_client.Client(api_key=GEMINI_API_KEY)
            for panel in body.panels:
                full_prompt = IMAGE_SYSTEM_PROMPT.format(
                    style=comic.get("style", "manga"),
                    prompt=panel.image_prompt,
                )
                img_response = client.models.generate_content(
                    model="gemini-2.5-flash-image",
                    contents=full_prompt,
                    config=genai_types.GenerateContentConfig(
                        response_modalities=["IMAGE", "TEXT"],
                    ),
                )
                image_url = None
                for part in img_response.candidates[0].content.parts:
                    if part.inline_data:
                        b64 = base64.b64encode(part.inline_data.data).decode()
                        mime = part.inline_data.mime_type or "image/png"
                        image_url = f"data:{mime};base64,{b64}"
                        break
                illustrated_panels.append({
                    **panel.dict(),
                    "image_url": image_url,
                })
        except Exception as e:
            import traceback
            print(f"[illustrate] image generation failed: {e}")
            traceback.print_exc()
            illustrated_panels = [{**p.dict(), "image_url": None} for p in body.panels]

    # Update comic in DB with final illustrated panels
    reading_time = max(1, len(illustrated_panels) // 3)
    await comics_col.update_one(
        {"_id": body.comic_id},
        {"$set": {
            "panels": illustrated_panels,
            "status": "done",
            "reading_time_min": reading_time,
        }}
    )

    if not is_unlimited:
        await users_col.update_one(
            {"_id": user["_id"]},
            {"$set": {"free_generations_used": used + 1}},
        )

    logger.info(f"illustration_generated: {user['_id']} - {body.comic_id}")

    return {
        "comic_id": body.comic_id,
        "panels": illustrated_panels,
        "free_generations_used": used + (0 if is_unlimited else 1),
        "free_generation_limit": generation_limit,
        "plan": plan,
    }

@app.post("/api/extract-sections")
@limiter.limit("10/hour")  # Aggressive rate limit
async def extract_sections(
    request: Request,
    file: UploadFile = File(...),
    user=Depends(current_user),
):
    """Upload PDF with comprehensive validation"""
    
    # 1. Check file size BEFORE reading
    if file.size and file.size > MAX_FILE_SIZE:
        logger.warning(f"upload_too_large: {file.filename} ({file.size} bytes)")
        raise HTTPException(status_code=413, detail="File too large (max 50MB)")
    
    # 2. Validate MIME type
    if file.content_type != "application/pdf":
        logger.warning(f"upload_invalid_mime: {file.filename} ({file.content_type})")
        raise HTTPException(status_code=400, detail="Only PDF files allowed")
    
    # 3. Validate filename (prevent path traversal)
    if "/" in file.filename or "\\" in file.filename or ".." in file.filename:
        logger.warning(f"upload_path_traversal_attempt: {file.filename}")
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # 4. Read with size limit
    content = b""
    try:
        async for chunk in file.file:
            content += chunk
            if len(content) > MAX_FILE_SIZE:
                logger.warning(f"upload_exceeded_limit: {user['_id']}")
                raise HTTPException(status_code=413, detail="File exceeds size limit")
    except Exception as e:
        logger.error(f"upload_read_error: {str(e)}")
        raise HTTPException(status_code=400, detail="File read error")
    
    # 5. Validate magic bytes (PDF signature)
    if not content.startswith(b"%PDF"):
        logger.warning(f"upload_invalid_pdf: {user['_id']}")
        raise HTTPException(status_code=400, detail="Invalid PDF file")
    
    # 6. Check for malicious patterns
    if b"JavaScript" in content or b"OpenAction" in content:
        logger.warning(f"upload_suspicious_pdf: {user['_id']}")
        raise HTTPException(status_code=400, detail="PDF contains suspicious elements")
    
    logger.info(f"upload_success: {user['_id']} - document uploaded")
    
# ═══════════════════════════════════════════════════════════════════════════
# COMICS CRUD
# ═══════════════════════════════════════════════════════════════════════════

def serialise(doc: dict) -> dict:
    """Make MongoDB doc JSON-serialisable."""
    doc = {k: v for k, v in doc.items() if k != "user_id"}
    doc["id"] = doc.pop("_id")
    return doc


@app.get("/api/comics")
async def list_comics(user=Depends(current_user)):
    cursor = comics_col.find({"user_id": user["_id"]}).sort("created_at", -1)
    comics = []
    async for doc in cursor:
        # Return lightweight list (no full panel data)
        comics.append({
            "id": doc["_id"],
            "title": doc.get("title", ""),
            "source_filename": doc.get("source_filename", ""),
            "source_id": doc.get("source_id", doc["_id"]),
            "topic_title": doc.get("topic_title"),
            "panel_count": doc.get("panel_count", 0),
            "style": doc.get("style", "manga"),
            "status": doc.get("status", "done"),
            "reading_time_min": doc.get("reading_time_min"),
            "cover_url": doc.get("cover_url"),
            "created_at": doc.get("created_at", ""),
        })
    return {"comics": comics}


@app.get("/api/comics/{comic_id}")
async def get_comic(comic_id: str, user=Depends(current_user)):
    """Get specific comic with validation"""
    try:
        # Validate comic_id format
        if not all(c.isalnum() or c in "-_" for c in comic_id) or len(comic_id) > 100:
            raise HTTPException(status_code=400, detail="Invalid comic_id format")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid comic_id")
    
    doc = await comics_col.find_one({"_id": comic_id, "user_id": user["_id"]})
    if not doc:
        logger.warning(f"comic_not_found: {user['_id']} - {comic_id}")
        raise HTTPException(status_code=404, detail="Comic not found")
    
    return serialise(doc)


@app.delete("/api/comics/{comic_id}")
async def delete_comic(comic_id: str, user=Depends(current_user)):
    """Delete comic with validation"""
    try:
        if not all(c.isalnum() or c in "-_" for c in comic_id) or len(comic_id) > 100:
            raise HTTPException(status_code=400, detail="Invalid comic_id")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid comic_id")
    
    result = await comics_col.delete_one({"_id": comic_id, "user_id": user["_id"]})
    if result.deleted_count == 0:
        logger.warning(f"comic_delete_failed: {user['_id']} - {comic_id}")
        raise HTTPException(status_code=404, detail="Comic not found")
    
    logger.info(f"comic_deleted: {user['_id']} - {comic_id}")
    return {"deleted": comic_id}

# ═══════════════════════════════════════════════════════════════════════════
# BILLING (Razorpay)
# ═══════════════════════════════════════════════════════════════════════════

class CreateSubscriptionRequest(BaseModel):
    plan: str  # "pro" or "team"


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str


RAZORPAY_PLAN_IDS = {
    "pro": RAZORPAY_PRO_PLAN_ID,
    "team": RAZORPAY_TEAM_PLAN_ID,
}


@app.post("/api/billing/create-subscription")
@limiter.limit("10/minute")
async def create_subscription(
    request: Request,
    body: CreateSubscriptionRequest,
    user=Depends(current_user),
):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Billing is not configured on this server yet")

    plan_id = RAZORPAY_PLAN_IDS.get(body.plan)
    if not plan_id:
        raise HTTPException(status_code=400, detail=f"Unknown plan: {body.plan}")

    try:
        subscription = razorpay_client.subscription.create({
            "plan_id": plan_id,
            "customer_notify": 1,
            "total_count": 12,
            "notes": {"user_id": user["_id"], "plan": body.plan},
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Razorpay error: {str(e)}")

    return {
        "subscription_id": subscription["id"],
        "razorpay_key_id": RAZORPAY_KEY_ID,
    }


@app.post("/api/billing/verify")
@limiter.limit("20/minute")
async def verify_payment(
    request: Request,
    body: VerifyPaymentRequest,
    user=Depends(current_user),
):
    if not razorpay_client:
        raise HTTPException(status_code=500, detail="Billing is not configured on this server yet")

    params = {
        "razorpay_payment_id": body.razorpay_payment_id,
        "razorpay_subscription_id": body.razorpay_subscription_id,
        "razorpay_signature": body.razorpay_signature,
    }
    try:
        razorpay_client.utility.verify_subscription_payment_signature(params)
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Payment signature verification failed")

    return {"verified": True}


@app.post("/api/billing/webhook")
@limiter.limit("100/minute")
async def razorpay_webhook(request: Request):
    """Razorpay webhook with signature verification and idempotency"""
    import hmac
    
    raw_body = await request.body()
    body_str = raw_body.decode("utf-8")
    signature = request.headers.get("x-razorpay-signature", "")
    
    if not RAZORPAY_WEBHOOK_SECRET:
        logger.error("webhook_secret_not_configured")
        raise HTTPException(status_code=500, detail="Webhook secret not configured")
    
    # ✅ VERIFY SIGNATURE with hmac.compare_digest
    expected_signature = hmac.new(
        RAZORPAY_WEBHOOK_SECRET.encode(),
        body_str.encode(),
        hashlib.sha256
    ).hexdigest()
    
    if not hmac.compare_digest(signature, expected_signature):
        logger.warning(f"webhook_signature_invalid from {request.client.host}")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    
    try:
        event = json.loads(body_str)
    except json.JSONDecodeError:
        logger.error("webhook_json_invalid")
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    event_id = event.get("id")
    event_type = event.get("event")
    
    # ✅ IDEMPOTENCY - Check if already processed
    # TODO: Add webhook_logs_col to db.py
    existing = await webhook_logs_col.find_one({"event_id": event_id})
    if existing:
        logger.info(f"webhook_duplicate: {event_id}")
        return {"received": True}
    
    # Process webhook
    try:
        if event_type in ("subscription.activated", "subscription.charged"):
            payload = event.get("payload", {})
            subscription = payload.get("subscription", {}).get("entity", {})
            notes = subscription.get("notes", {})
            user_id = notes.get("user_id")
            plan = notes.get("plan", "pro")
            subscription_id = subscription.get("id")
            
            if user_id:
                await users_col.update_one(
                    {"_id": user_id},
                    {"$set": {
                        "plan": plan,
                        "razorpay_subscription_id": subscription_id,
                        "free_generations_used": 0,
                    }},
                )
                logger.info(f"webhook_upgrade: {user_id} to {plan}")
        
        elif event_type in ("subscription.cancelled", "subscription.completed", "subscription.halted"):
            payload = event.get("payload", {})
            subscription = payload.get("subscription", {}).get("entity", {})
            subscription_id = subscription.get("id")
            user = await users_col.find_one({"razorpay_subscription_id": subscription_id})
            if user:
                await users_col.update_one(
                    {"_id": user["_id"]},
                    {"$set": {"plan": "free"}},
                )
                logger.info(f"webhook_downgrade: {user['_id']} ({event_type})")
        
        # Log successful processing (uncomment when webhook_logs_col added)
        await webhook_logs_col.insert_one({
            "event_id": event_id,
            "event_type": event_type,
            "processed_at": datetime.utcnow(),
            "status": "success"
        })
        
    except Exception as e:
        logger.error(f"webhook_error: {str(e)}")
        # Log failed processing (uncomment when webhook_logs_col added)
        await webhook_logs_col.insert_one({
            "event_id": event_id,
            "event_type": event_type,
            "processed_at": datetime.utcnow(),
            "status": "failed",
            "error": str(e)
        })
        raise HTTPException(status_code=500, detail="Webhook processing failed")
    
    return {"received": True}

# ═══════════════════════════════════════════════════════════════════════════
# CONTACT
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/contact")
@limiter.limit("5/minute")
async def contact(body: ContactRequest, request: Request):
    """Contact form submission"""
    await contact_col.insert_one({
        **body.dict(),
        "ip": request.client.host,
        "user_agent": request.headers.get("user-agent", ""),
        "created_at": datetime.utcnow().isoformat(),
        "read": False,
    })
    logger.info(f"contact_submitted: {body.email}")
    return {"ok": True}


# ── Health check ────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}