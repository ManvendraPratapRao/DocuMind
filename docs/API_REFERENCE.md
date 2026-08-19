# DocuMind API Reference

DocuMind uses FastAPI to provide a high-performance REST API. When the backend is running, you can access the interactive Swagger UI at [http://localhost:8000/docs](http://localhost:8000/docs).

## Base URL
`http://localhost:8000/api/v1`

## Authentication
Currently, the API utilizes the Groq API key provided in the `.env` file or passed via frontend configuration. No dedicated user authentication is implemented in this version.

---

## Asynchronous Extraction Flow

Because LLM extraction can take 10-30 seconds depending on document length and model complexity, the API is designed around an asynchronous polling mechanism.

### 1. Upload a Document
**`POST /async/extract`**
Uploads a document and queues it for background processing.
- **Content-Type**: `multipart/form-data`
- **Payload**:
  - `file`: The document (PDF, Image, Email, Text)
  - `doc_type`: (String) E.g., `invoice`, `receipt`, `email`
  - `model`: (String) Optional. The Groq model to use (e.g., `llama3-70b-8192`).
  - `folder_id`: (Integer) Optional. The folder to save this extraction under.
- **Response**:
  ```json
  {
    "job_id": "abc-123",
    "status": "processing",
    "message": "Extraction started in background"
  }
  ```

### 2. Poll for Status
**`GET /async/jobs`**
Returns a list of all jobs, including their current status (`processing`, `done`, `failed`) and their extracted JSON results if completed.

### 3. Retrieve Original File
**`GET /async/files/{job_id}`**
Returns the original physical file that was uploaded, allowing the frontend to render a side-by-side preview.

### 4. Delete a Job
**`DELETE /async/jobs/{job_id}`**
Deletes a job from the database and removes its associated physical file from the `uploads/` directory to free up disk space.

---

## Folder Management

Organize your extractions using Folders.

- **`GET /async/folders`**: List all folders.
- **`POST /async/folders`**: Create a new folder.
- **`DELETE /async/folders/{folder_id}`**: Delete a folder and all jobs contained within it.

---

## Custom Schema Builder

Users can define dynamic schemas in the UI, which are compiled into Pydantic models on the fly by the backend.

- **`GET /async/schemas`**: List all custom schemas.
- **`POST /async/schemas`**: Create a new custom schema. Requires a JSON payload defining field names, types, and descriptions.
- **`DELETE /async/schemas/{schema_id}`**: Delete a custom schema.

---

## Built-in Pydantic Schemas

DocuMind comes with several robust, pre-defined schemas in `app/schemas/`. When `doc_type` matches one of these, the backend uses them directly:

1. **`invoice`**: Vendor, Buyer, Line Items, Tax, Total, Due Date.
2. **`receipt`**: Merchant, Date, Time, Total, Tax, Line Items.
3. **`email`**: Sender, Recipient, Intent, Action Items, Dates.

The `BaseExtractionResult` automatically injects standard metadata fields into every extraction:
- `status`: `SUCCESS`, `PARTIAL`, or `MANUAL_REVIEW_REQUIRED`.
- `confidence_score`: 0.0 to 1.0.
- `warning`: Array of strings explaining any issues encountered (e.g., fallback triggered, fields missing).
- `raw_text_preview`: The first 500 characters extracted from the document.
