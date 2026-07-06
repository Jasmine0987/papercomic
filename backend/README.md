# Paper-to-Manga Backend

Converts research papers (PDF) into manga-style visual explainers,
with every panel linked back to its source text and rated by how
much it simplifies that source.

## Architecture

```
PDF Upload
  -> Parsing      (PDF -> structured text + sections)        [local, no API]
  -> Scripting    (structured text -> panel JSON via LLM)    [Gemini free tier / Ollama]
  -> [User review/edit of script]
  -> Image gen    (panel JSON -> images)                      [placeholder for now]
  -> Assembly     (images -> comic pages)                     [local, no API]
```

## Requirements

- Python 3.10+
- (Optional) Ollama installed locally if you want to use local models
  instead of Gemini

## Installation

```bash
# 1. Clone/navigate to the project directory
cd manga-paper-backend

# 2. Create a virtual environment
python3 -m venv venv

# 3. Activate it
source venv/bin/activate          # macOS/Linux
venv\Scripts\activate             # Windows

# 4. Install dependencies
pip install -r requirements.txt

# 5. Copy the environment template and add your API key
cp .env.example .env
```

## Configuration

Edit `.env`:

```
GEMINI_API_KEY=your_key_here     # get a free key at https://ai.google.dev (no card needed)
LLM_PROVIDER=gemini              # or "ollama" for fully local
GEMINI_MODEL=gemini-2.5-flash
```

To use Ollama instead (fully local, no API key needed):

```
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2
```

Make sure Ollama is running and the model is pulled:

```bash
ollama pull llama3.2
ollama serve
```

## Running the server

```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.
Interactive API docs (Swagger UI) at `http://localhost:8000/docs`.

## Running tests

```bash
pytest
```

Tests for parsing and script generation run with no API calls
(script generation tests use a mocked LLM provider) - safe to run
repeatedly with zero cost.

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/documents/upload` | Upload a PDF, returns parsed document with sections |
| POST | `/documents/{id}/script?template=research_paper` | Generate panel script via LLM |
| GET | `/documents/{id}/script` | Retrieve current script |
| PUT | `/documents/{id}/script` | Submit edited script |
| POST | `/documents/{id}/render` | Generate images + assemble comic pages |
| GET | `/documents/{id}/pages` | List generated page image paths |

## Example workflow (curl)

```bash
# 1. Upload a PDF
curl -X POST http://localhost:8000/documents/upload \
  -F "file=@/path/to/paper.pdf"
# -> returns { "document_id": "...", ... }

# 2. Generate script
curl -X POST "http://localhost:8000/documents/<document_id>/script?template=research_paper"

# 3. (Review/edit script via GET/PUT as needed)

# 4. Render comic
curl -X POST http://localhost:8000/documents/<document_id>/render

# 5. List pages
curl http://localhost:8000/documents/<document_id>/pages
```

## Notes on current limitations (MVP)

- **Image generation is a placeholder.** Currently generates simple
  text-on-background images so the full pipeline runs end-to-end.
  Real image generation (manga-style art, consistent character) is
  the next major piece of work - see `app/pipeline/imagegen.py`.
- **Section detection is heuristic.** Works well for papers with
  standard section headings (Abstract, Methods, Results, etc.);
  more complex layouts may need a better parser.
- **In-memory storage.** Documents/scripts are stored in memory and
  will be lost on server restart. Fine for development; replace with
  a database before any real deployment.
- **Gemini free tier note:** free-tier usage may be used by Google to
  improve their models. Fine for development with sample papers; for
  production with sensitive data, use a billing-enabled project or
  Vertex AI instead.