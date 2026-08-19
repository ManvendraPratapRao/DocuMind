# DocuMind AI 🧠

![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)
![React](https://img.shields.io/badge/React-18.x-blue.svg)
![Docker](https://img.shields.io/badge/docker-ready-blue.svg)

DocuMind AI is an intelligent, full-stack document extraction engine. It takes unstructured documents (PDFs, Images, Emails, Text) and uses advanced Large Language Models (via Groq API) to extract perfectly structured, validated JSON data based on strict Pydantic schemas. 

It features a modern React frontend for managing document schemas, uploading files, and visualizing extracted data across your workspace.

---

## 🌟 Key Features

### 🧠 Intelligent AI Extraction
- **Schema Driven**: Turn Invoices, Receipts, Resumes, and more into structured JSON by defining your exact target schema.
- **Self-Healing Loop**: Automatically catches LLM hallucinations or missing fields. If a model fails to output valid JSON, the backend feeds the error back to the LLM to fix it in real-time.
- **Custom Schemas**: Build dynamic data extraction schemas visually from the UI.
- **Model Agnostic**: Switch between powerful Groq models (`llama3-70b-8192`, `mixtral-8x7b-32768`, `qwen`, `gemma`) for speed vs accuracy tradeoffs.

### 📄 Universal File Parsing
- **PDF Layout Preservation**: Extracts PDF text while perfectly preserving columnar layouts, preventing the AI from merging distinct columns (e.g., side-by-side addresses).
- **Vision Support**: Automatically converts scanned PDFs and images (PNG, JPG, TIFF) to base64 for processing with vision models (`llama-3.2-90b-vision-preview`).
- **Multi-Format Support**: Parse `.eml`, `.msg`, `.txt`, `.md`, and `.json` effortlessly.

### ⚡ Modern Full-Stack Architecture
- **Async Processing**: Fast, non-blocking background queue for handling large documents without HTTP timeouts.
- **Visual Validation**: Side-by-side document preview and data viewer in the frontend.
- **Persistent Storage**: Uploaded files and their extracted JSON results are stored reliably in a SQLite database and disk storage.

---

## 🏗️ Architecture

```text
[ React Frontend ] ↔ [ FastAPI Backend ]
                          |
                          v
         [ SQLite DB ] ↔ [ Async Extraction Queue ]
                                  |
                                  v
[ File Parsers ] ↔ [ Pydantic Validator ] ↔ [ Groq LLMs ]
(pdfplumber, PIL)
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Python 3.11 or higher
- Node.js 18 or higher
- A [Groq API Key](https://console.groq.com/) (Required for LLM extraction)

### 2. Backend Setup
1. Clone the repository and navigate into it.
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the root directory based on `.env.example`:
   ```env
   GROQ_API_KEY=gsk_your_groq_api_key_here
   ENVIRONMENT=development
   ```

### 3. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. (Optional) Create a `.env` file inside `frontend/` to point to the backend if running on a different port:
   ```env
   VITE_API_URL=http://localhost:8000
   ```

### 4. Running the Application
We've provided a convenient batch script to launch both servers simultaneously on Windows:
```bash
# From the root directory:
start.bat
```

**Manual Startup:**
- Backend: `uvicorn app.main:app --reload --port 8000`
- Frontend: `npm run dev` (from inside `/frontend`)

---

## 📚 Documentation

- **[API Reference](/docs/API_REFERENCE.md)**: Detailed breakdown of the FastAPI endpoints and models.
- **Interactive Swagger Docs**: Available at `http://localhost:8000/docs` while the backend is running.

## 🗄️ Database Migrations
If you've pulled the latest changes that involve database schema updates (like adding the `file_path` column to store physical document links), run the idempotent migration script before starting the server:
```bash
python migrate_db.py
```

---

## 🛠️ Built With
- **Backend:** [FastAPI](https://fastapi.tiangolo.com/), [Pydantic](https://docs.pydantic.dev/), [SQLAlchemy](https://www.sqlalchemy.org/), [pdfplumber](https://github.com/jsvine/pdfplumber)
- **Frontend:** [React](https://react.dev/), [Vite](https://vitejs.dev/), [TailwindCSS](https://tailwindcss.com/), [React-PDF](https://github.com/wojtekmaj/react-pdf)
- **AI Core:** [Groq](https://groq.com/) Cloud API
