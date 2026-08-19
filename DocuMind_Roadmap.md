# DocuMind API — Full Project Roadmap

> **Production Data Extraction & Schema Validation Microservice**
> A FastAPI-based REST API that ingests raw documents (PDFs, invoices, receipts, emails, resumes) and returns strictly validated JSON using Pydantic — powered by Groq LLM.

---

## Project Identity

| Field | Value |
|---|---|
| **Project Name** | DocuMind API |
| **Tagline** | *Turn any document into structured data — instantly.* |
| **Stack** | Python · FastAPI · Pydantic · Groq · Docker |
| **Location** | `D:\Portfolio projects\DocuMind-API` |
| **Target Audience** | SMBs, freelancers, SaaS companies, accounting firms |

---

## What is AI / LLM Doing Here?

This is the core question — and the answer is what makes this project **non-trivial**.

### The Problem with Traditional Parsing
Traditional rule-based parsers (regex, PDF libraries) are **brittle**. Every invoice looks different. Every resume has a unique layout. A parser built for one format breaks on another.

### What the LLM Does
The LLM (running on **Groq** for blazing-fast inference) acts as a **universal document reader with a contract**.

Here's the flow:
```
Raw Document (PDF / Image / Email text)
        ↓
  Text/Image Extraction Layer
        ↓
  Prompt to Groq LLM:
  "Extract this data and return it ONLY in this exact JSON schema:"
  {schema injected here}
        ↓
  Groq returns JSON
        ↓
  Pydantic validates the output
        ↓
  ✅ Valid → Return to user
  ❌ Invalid → Auto-retry with corrective prompt (up to 3x)
        ↓
  If still failing → Return "manual_review_required" response
```

### Why Groq Specifically?
- **Speed:** Groq's LPU hardware delivers ~500 tokens/second vs ~50 for standard APIs. For a document parsing service, this means near-instant responses.
- **Cost:** Groq's free tier is generous for prototyping. Paid tier is significantly cheaper than OpenAI at scale.
- **Models Available:** `llama-3.3-70b-versatile`, `mixtral-8x7b` — both excellent for structured extraction tasks.

---

## Supported Document Types

| Document Type | Key Fields Extracted | Complexity |
|---|---|---|
| **Invoice** | Vendor, buyer, invoice #, date, line items, subtotal, tax, total | Medium |
| **Receipt** | Store name, date, items, total, payment method | Low |
| **Resume / CV** | Name, contact, skills, experience, education, certifications | High |
| **Email** | Sender, recipient, subject, intent, action items, dates mentioned | Medium |
| **Purchase Order** | PO number, vendor, items ordered, quantities, prices, delivery date | Medium |
| **Bank Statement** | Account holder, account #, transaction list (date, description, amount) | High |
| **Medical Bill** | Patient, provider, service dates, procedure codes, charges, insurance | High |

---

## Project Folder Structure

```
DocuMind-API/
│
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app entry point
│   ├── config.py                  # Settings (API keys, model names, retry config)
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── extract.py         # POST /extract endpoint
│   │   │   └── health.py          # GET /health endpoint
│   │   └── dependencies.py        # API key auth dependency
│   │
│   ├── schemas/                   # Pydantic models (the data contracts)
│   │   ├── __init__.py
│   │   ├── invoice.py
│   │   ├── receipt.py
│   │   ├── resume.py
│   │   ├── email_schema.py
│   │   ├── purchase_order.py
│   │   ├── bank_statement.py
│   │   ├── medical_bill.py
│   │   └── base.py                # Shared base models (confidence, status)
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── extractor.py           # Core LLM extraction logic + retry loop
│   │   ├── file_parser.py         # PDF/image → text/base64 conversion
│   │   └── groq_client.py         # Groq API wrapper
│   │
│   └── utils/
│       ├── __init__.py
│       ├── prompts.py             # System/user prompt templates per doc type
│       └── logger.py              # Structured logging setup
│
├── tests/
│   ├── __init__.py
│   ├── test_extract.py            # Endpoint tests
│   ├── test_schemas.py            # Pydantic validation tests
│   └── sample_docs/               # Sample PDFs/images for testing
│       ├── sample_invoice.pdf
│       ├── sample_resume.pdf
│       └── sample_receipt.jpg
│
├── .env.example                   # Template for environment variables
├── .env                           # Your actual keys (gitignored)
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md
```

---

## Phase-by-Phase Build Roadmap

### 🔵 Phase 0 — Environment Setup (1–2 hours)

- [ ] Create virtual environment (`python -m venv venv`)
- [ ] Install core dependencies: `fastapi`, `uvicorn`, `pydantic`, `groq`, `python-multipart`, `python-dotenv`, `pypdf2` or `pdfplumber`, `Pillow`
- [ ] Create `.env` with `GROQ_API_KEY` and `API_SECRET_KEY`
- [ ] Initialize `requirements.txt`
- [ ] Setup basic project folder structure as shown above
- [ ] Test Groq API connection with a simple hello-world call

---

### 🔵 Phase 1 — Core Pydantic Schemas (3–4 hours)

> This is the most important phase. Your schemas are your product's **data contract**.

- [ ] Create `base.py` with shared fields:
  - `ExtractionStatus` enum: `SUCCESS`, `PARTIAL`, `MANUAL_REVIEW_REQUIRED`
  - `BaseExtractionResult` with `status`, `confidence_score`, `warnings` list
- [ ] Build `Invoice` schema with full nested `LineItem` model
- [ ] Build `Receipt` schema
- [ ] Build `Resume` schema (most complex — nested `Experience`, `Education`, `Skill` models)
- [ ] Build `EmailData` schema
- [ ] Build `PurchaseOrder` schema
- [ ] Build `BankStatement` schema with `Transaction` list
- [ ] Build `MedicalBill` schema
- [ ] Write unit tests for each schema in `test_schemas.py` using raw dicts

**Key Design Decisions for Schemas:**
- All monetary fields should be `float`, not `str`
- All date fields should be `Optional[str]` (let the LLM return ISO format, validate later)
- All fields should be `Optional` where possible — partial extractions are better than failures
- Add `Field(description="...")` to every field — this description gets injected into the LLM prompt

---

### 🔵 Phase 2 — File Parsing Layer (2–3 hours)

- [ ] Build `file_parser.py` service:
  - PDF → extract raw text using `pdfplumber` (handles tables much better than PyPDF2)
  - PDF → convert pages to images using `pdf2image` (for multimodal/vision route)
  - Images (JPG, PNG) → read as bytes, encode to base64
  - Plain text / `.txt` → read directly
  - Email (`.eml`) → parse headers and body using `email` stdlib
- [ ] Handle file size limits (reject files > 10MB with a clear error)
- [ ] Handle unsupported file types gracefully
- [ ] Add document type auto-detection helper (check file extension + MIME type)

---

### 🔵 Phase 3 — Groq LLM Integration & Extraction Engine (4–5 hours)

> This is the brain of the service.

- [ ] Build `groq_client.py`:
  - Initialize Groq client from env variable
  - Create a `chat_completion()` wrapper function
  - Handle Groq-specific exceptions (`RateLimitError`, `APIError`)

- [ ] Build `prompts.py`:
  - Create a `build_extraction_prompt(doc_type, schema_json, document_text)` function
  - System prompt: *"You are a precise data extraction engine. You ONLY output valid JSON matching the given schema. Do not add commentary."*
  - User prompt: Inject the schema's JSON representation + the raw document text

- [ ] Build `extractor.py` — the retry/healing loop:
  ```
  Attempt 1: Standard extraction prompt
  ↓ Pydantic validation fails?
  Attempt 2: Add error message to prompt: "Your previous output failed validation because: {error}. Fix it."
  ↓ Still fails?
  Attempt 3: Simplified prompt, ask for partial data only
  ↓ Still fails?
  Return ExtractionStatus.MANUAL_REVIEW_REQUIRED with whatever was extracted
  ```

- [ ] Use Groq's **JSON mode** (`response_format={"type": "json_object"}`) for cleaner outputs
- [ ] Test each document type with real sample files

---

### 🔵 Phase 4 — FastAPI Endpoints (2–3 hours)

- [ ] Build `main.py`:
  - Initialize FastAPI app with title, description, version
  - Configure CORS middleware
  - Include routers from `api/routes/`
  - Add startup/shutdown events for logging

- [ ] Build `health.py` route:
  - `GET /health` → returns `{"status": "ok", "version": "1.0.0"}`

- [ ] Build `extract.py` route:
  - `POST /extract` — accepts multipart file upload + `doc_type` query param
  - Returns extracted JSON matching the appropriate Pydantic schema
  - Returns proper HTTP status codes: `200`, `400`, `422`, `500`

- [ ] Build `dependencies.py`:
  - API key authentication via `Authorization: Bearer <token>` header
  - FastAPI `Depends()` pattern for clean route-level auth

- [ ] Add proper error response models for consistent error shapes

---

### 🔵 Phase 5 — Async Background Processing (2–3 hours)

> Optional for MVP, but highly recommended for production.

- [ ] Add a `jobs` in-memory store (dict or Redis if you want to go further)
- [ ] `POST /extract/async` → starts background task, returns `{"job_id": "uuid"}`
- [ ] `GET /jobs/{job_id}` → returns `{"status": "processing|done|failed", "result": {...}}`
- [ ] Use FastAPI `BackgroundTasks` for this
- [ ] Add job expiry (clean up results older than 1 hour)

---

### 🔵 Phase 6 — Testing (2–3 hours)

- [ ] Collect real sample documents for all 7 types
- [ ] Write `test_extract.py` using FastAPI's `TestClient`
- [ ] Test happy path for each document type
- [ ] Test validation failure → retry → success
- [ ] Test validation failure → manual review fallback
- [ ] Test bad file type upload
- [ ] Test missing/invalid API key
- [ ] Test large file rejection
- [ ] Test concurrent requests (basic load test)

---

### 🔵 Phase 7 — Docker & Deployment (2–3 hours)

- [ ] Write `Dockerfile`:
  - Base image: `python:3.11-slim`
  - Copy requirements, install deps
  - Copy app code
  - Expose port 8000
  - CMD: `uvicorn app.main:app --host 0.0.0.0 --port 8000`

- [ ] Write `docker-compose.yml`:
  - `api` service (your app)
  - Pass environment variables from `.env`
  - Volume mount for uploads (optional)

- [ ] Test: `docker build -t documind-api .`
- [ ] Test: `docker run -p 8000:8000 --env-file .env documind-api`
- [ ] Verify Swagger UI at `http://localhost:8000/docs`
- [ ] Verify ReDoc at `http://localhost:8000/redoc`

---

### 🔵 Phase 8 — Documentation & Polish (2–3 hours)

- [ ] Write a professional `README.md` with:
  - Project description + badges (Python version, Docker, License)
  - Architecture diagram (simple ASCII or Mermaid)
  - Quick start: `docker run` one-liner
  - API reference table (endpoints, params, responses)
  - Sample request/response for each doc type (curl examples)
  - Environment variables table
  - How the retry logic works
- [ ] Add docstrings to all major functions
- [ ] Add FastAPI response examples in all endpoint decorators (shows in Swagger)
- [ ] Create a Postman collection or `.http` file for manual testing
- [ ] Record a short demo (optional but high impact for portfolio)

---

## Time Estimate (Realistic)

| Phase | Task | Time |
|---|---|---|
| 0 | Environment Setup | 1–2 hrs |
| 1 | Pydantic Schemas | 3–4 hrs |
| 2 | File Parsing Layer | 2–3 hrs |
| 3 | Groq LLM Integration + Retry Engine | 4–5 hrs |
| 4 | FastAPI Endpoints | 2–3 hrs |
| 5 | Async Background Jobs | 2–3 hrs |
| 6 | Testing | 2–3 hrs |
| 7 | Docker & Deployment | 2–3 hrs |
| 8 | Docs & Polish | 2–3 hrs |
| **Total** | | **~20–29 hrs (3–4 days)** |

> **Note:** The original 4–8 hour estimate was for a minimal single-doc-type MVP.
> Supporting 7 document types with async processing, auth, Docker, and full testing puts this in the **20–29 hour** range — which is still fast for the value delivered.

---

## Freelance / Commercial Value Assessment

### What This Project Signals to a Client

A client looking at DocuMind API sees:
- You understand **API design** (REST, auth, error handling, status codes)
- You can work with **LLMs reliably** (not just chatbots — production-grade extraction)
- You understand **data validation** (Pydantic schemas = data contracts)
- You can **containerize and ship** (Docker means zero friction for deployment)
- You handle **edge cases** (retry logic, manual review fallback, bad inputs)

This is NOT a tutorial project. This is something a real company would pay for.

---

### Freelance Gig Pricing (Real Market Rates)

#### Scenario A: Building This From Scratch for a Client
*Client brief: "We have 500 invoices per month we process manually. Build us an API."*

| Market | Expected Price |
|---|---|
| Upwork / Fiverr (competitive) | $500 – $1,500 |
| Direct outreach (SMB clients) | $1,500 – $4,000 |
| Agencies / Referrals | $3,000 – $8,000 |
| Enterprise / Contracts | $8,000 – $25,000+ |

---

#### Scenario B: Selling Ongoing API Access (Micro-SaaS)
*You host it yourself, charge per document or per month.*

| Plan | Pricing Model | Monthly Revenue Potential |
|---|---|---|
| Starter | $29/mo (500 docs) | Scales with users |
| Pro | $99/mo (5,000 docs) | $990 at 10 users |
| Business | $299/mo (unlimited) | Significant at 20+ users |

---

#### Scenario C: Adding This to Your Developer Profile
*"I built this" on LinkedIn / GitHub / portfolio site.*

- Gets you noticed for **AI Engineer**, **Backend Developer**, **API Developer** roles
- Opens doors to contract work at $50–$150/hour depending on location and client
- Works as a proof of skill when pitching **AI automation consulting**

---

### Who Will Pay You and Why

| Target Client | Their Pain | Why They'll Pay |
|---|---|---|
| Accounting Firms | 20+ hrs/week of manual invoice entry | Immediate time savings |
| E-commerce Stores | Manually reconciling receipts | Scales with their volume |
| Recruiting Agencies | Reading resumes one by one | Huge time drain |
| Legal Firms | Extracting data from contracts | High hourly billing rate |
| Healthcare Providers | Medical bill coding | Regulatory compliance pressure |
| Logistics Companies | Purchase order processing | High volume, repetitive |

---

> [!TIP]
> **Fastest path to first paid gig:** Post on LinkedIn with a demo video of DocuMind processing a real invoice. Caption: *"I built an AI-powered document extraction API that turns any invoice/resume/receipt into structured JSON in under 2 seconds. Drop a comment if you're processing documents manually — let's talk."* You will get DMs.

> [!IMPORTANT]
> **Portfolio Power Move:** Host the API publicly (Railway, Render, or Fly.io offer free tiers), add a live demo link on GitHub. Recruiters and clients can actually test it — this alone separates you from 90% of portfolio projects.
