import os, io, base64, json, time, uuid
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
from fastapi.responses import RedirectResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.db import users_col, comics_col, contact_col
from google import genai as genai_client
from google.genai import types as genai_types
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
import jwt as pyjwt
import google.generativeai as genai
from dotenv import load_dotenv
load_dotenv()
# ── Config ──────────────────────────────────────────────────────────────────
SECRET_KEY   = os.getenv("JWT_SECRET", "change-me-in-production")
ALGORITHM    = "HS256"
TOKEN_EXPIRE = 60 * 24 * 7          # 7 days in minutes

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    }
    return pyjwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

async def current_user(
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_sch),
):
    if not creds:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = pyjwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await users_col.find_one({"_id": user_id})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except pyjwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── Gemini setup ────────────────────────────────────────────────────────────
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# ── Pydantic models ─────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

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
@limiter.limit("5/minute")
async def register(body: RegisterRequest, request: Request):
    existing = await users_col.find_one({"email": body.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user = {
        "_id": user_id,
        "name": body.name,
        "email": body.email,
        "password_hash": hash_password(body.password),
        "provider": "email",
        "free_generations_used": 0,
        "plan": "free",
        "created_at": datetime.utcnow().isoformat(),
    }
    await users_col.insert_one(user)
    token = create_token(user_id, body.name, body.email)
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/auth/login")
@limiter.limit("10/minute")
async def login(body: LoginRequest, request: Request):
    user = await users_col.find_one({"email": body.email})
    if not user or not verify_password(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(user["_id"], user["name"], user["email"])
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/auth/google")
async def google_oauth_redirect():
    params = {
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    from urllib.parse import urlencode
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return RedirectResponse(url)


@app.get("/api/auth/google/callback")
async def google_oauth_callback(code: str):
    async with httpx.AsyncClient() as client:
        # Exchange code for tokens
        token_res = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        token_data = token_res.json()
        id_token_str = token_data.get("id_token", "")

        # Get user info
        userinfo_res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {token_data.get('access_token')}"}
        )
        userinfo = userinfo_res.json()

    email = userinfo.get("email")
    name  = userinfo.get("name", email.split("@")[0])
    gid   = userinfo.get("sub")

    # Upsert user
    user = await users_col.find_one({"email": email})
    if not user:
        user_id = str(uuid.uuid4())
        user = {
            "_id": user_id,
            "name": name,
            "email": email,
            "google_id": gid,
            "provider": "google",
            "free_generations_used": 0,
            "plan": "free",
            "created_at": datetime.utcnow().isoformat(),
        }
        await users_col.insert_one(user)
    elif "google_id" not in user:
        await users_col.update_one({"_id": user["_id"]}, {"$set": {"google_id": gid}})

    token = create_token(user["_id"], name, email)
    # Redirect to frontend with token in hash so the SPA can pick it up
    return RedirectResponse(f"{FRONTEND_URL}/upload?token={token}")


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

    return {
        "comic_id": body.comic_id,
        "panels": illustrated_panels,
        "free_generations_used": used + (0 if is_unlimited else 1),
        "free_generation_limit": generation_limit,
        "plan": plan,
        "is_premium": plan != "free",
    }


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
    doc = await comics_col.find_one({"_id": comic_id, "user_id": user["_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Comic not found")
    return serialise(doc)


@app.delete("/api/comics/{comic_id}")
async def delete_comic(comic_id: str, user=Depends(current_user)):
    result = await comics_col.delete_one({"_id": comic_id, "user_id": user["_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Comic not found")
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
async def razorpay_webhook(request: Request):
    raw_body = await request.body()
    body_str = raw_body.decode("utf-8")
    signature = request.headers.get("x-razorpay-signature", "")

    if not RAZORPAY_WEBHOOK_SECRET:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    try:
        razorpay_client_for_verify = razorpay_client or razorpay.Client(auth=("", ""))
        razorpay_client_for_verify.utility.verify_webhook_signature(
            body_str, signature, RAZORPAY_WEBHOOK_SECRET
        )
    except razorpay.errors.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    event = json.loads(body_str)
    event_type = event.get("event")

    if event_type == "subscription.activated" or event_type == "subscription.charged":
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
            print(f"[billing] upgraded user {user_id} to plan={plan}")

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
            print(f"[billing] downgraded user {user['_id']} to free ({event_type})")

    return {"received": True}

# ═══════════════════════════════════════════════════════════════════════════
# CONTACT
# ═══════════════════════════════════════════════════════════════════════════

@app.post("/api/contact")
async def contact(body: ContactRequest):
    await contact_col.insert_one({
        **body.dict(),
        "created_at": datetime.utcnow().isoformat(),
        "read": False,
    })
    return {"ok": True}


# ── Health check ────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}