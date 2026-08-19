# Audit Issues Fixed:
# 1. SQLAlchemy is installed but NOT in requirements.txt
# 2. Background task uses `async def` but SQLAlchemy sessions are synchronous —
#    FastAPI background tasks can use async but the DB session cannot be
#    an async generator — this is actually fine for sync SQLAlchemy, but the
#    function must not be marked async to avoid issues. Keeping as-is since it works.
# 3. model column not stored in DB (no way to know which model was used later)
# 4. No "purge stale" endpoint for stuck "processing" jobs

import uuid
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.schemas import SCHEMA_REGISTRY
from app.services.file_parser import parse_file
from app.services.extractor import extract_document, extract_document_sync, extract_document_custom, extract_document_custom_sync
from app.api.dependencies import verify_api_key
from app.utils.logger import setup_logger
from app.database import get_db, SessionLocal
from app.models import Job, Folder, CustomSchema, CustomSchemaField
from app.limiter import limiter
import os
PATH_UPLOADS = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(PATH_UPLOADS, exist_ok=True)

logger = setup_logger("async_extract")

router = APIRouter(
    prefix="/async",
    tags=["Async Extraction"],
    dependencies=[Depends(verify_api_key)]
)

# --- Pydantic Models for Response ---
class JobResult(BaseModel):
    job_id: str
    folder_id: Optional[str] = None
    schema_id: Optional[str] = None
    status: str
    doc_type: Optional[str] = None
    filename: Optional[str] = None
    model_used: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None

class FolderCreate(BaseModel):
    name: str

class FolderUpdate(BaseModel):
    folder_id: str | None

class BulkDeleteRequest(BaseModel):
    job_ids: List[str]

class SchemaFieldIn(BaseModel):
    name: str
    field_type: str = "text"   # text | number | date | boolean | list
    description: Optional[str] = None
    is_required: bool = False
    list_item_schema: Optional[str] = None  # JSON string of sub-fields for list type

class SchemaIn(BaseModel):
    name: str
    description: Optional[str] = None
    fields: List[SchemaFieldIn]

def _job_to_result(job: Job) -> JobResult:
    """Convert ORM Job to Pydantic JobResult safely."""
    result = None
    if job.result_json:
        try:
            result = json.loads(job.result_json)
        except Exception:
            result = None

    return JobResult(
        job_id=job.id,
        folder_id=job.folder_id,
        schema_id=job.schema_id,
        status=job.status,
        doc_type=job.doc_type,
        filename=job.filename,
        model_used=job.model_used,
        result=result,
        error=job.error,
        created_at=job.created_at.isoformat(),
        completed_at=job.completed_at.isoformat() if job.completed_at else None
    )


def process_extraction_task(
    job_id: str,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    doc_type: str,
    model: str = None,
    schema_id: str = None
):
    """
    Background task — runs synchronously in a thread pool.
    Handles both built-in schemas and custom schemas (Option B with nested lists).
    """
    db = SessionLocal()
    try:
        parsed_doc = parse_file(file_bytes, filename, content_type)

        if doc_type == "custom" and schema_id:
            schema_obj = db.query(CustomSchema).filter(CustomSchema.id == schema_id).first()
            raw_fields = db.query(CustomSchemaField).filter(CustomSchemaField.schema_id == schema_id).all()
            fields_list = [
                {
                    "name": f.name,
                    "field_type": f.field_type,
                    "description": f.description,
                    "list_item_schema": f.list_item_schema,
                }
                for f in raw_fields
            ]
            result_dict = extract_document_custom_sync(parsed_doc, schema_obj.name, fields_list, model=model)
        else:
            result = extract_document_sync(parsed_doc, doc_type, model=model)
            result_dict = result.model_dump()

        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "done"
            job.result_json = json.dumps(result_dict)
            job.completed_at = datetime.utcnow()
            db.commit()
            logger.info(f"Job {job_id} completed successfully.")

    except Exception as e:
        logger.error(f"Job {job_id} failed: {str(e)}", exc_info=True)
        db.rollback()
        job = db.query(Job).filter(Job.id == job_id).first()
        if job:
            job.status = "failed"
            job.error = str(e)[:1000]
            job.completed_at = datetime.utcnow()
            db.commit()
    finally:
        db.close()


@router.post("/extract", response_model=JobResult, status_code=202)
@limiter.limit("10/minute")
async def extract_data_async(
    request: Request,
    background_tasks: BackgroundTasks,
    doc_type: str = Form(..., description="The type of document"),
    model: str = Form(None, description="The LLM model to use (optional)"),
    folder_id: str = Form(None, description="Target folder ID (optional)"),
    schema_id: str = Form(None, description="Custom schema ID (required when doc_type=custom)"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Submits a document for background extraction. Returns 202 + job_id immediately.
    Poll GET /async/jobs/{job_id} to check status.
    """
    if doc_type == "custom":
        if not schema_id:
            raise HTTPException(status_code=400, detail="schema_id is required when doc_type is 'custom'")
        schema_exists = db.query(CustomSchema).filter(CustomSchema.id == schema_id).first()
        if not schema_exists:
            raise HTTPException(status_code=404, detail=f"Custom schema '{schema_id}' not found")
    elif doc_type not in SCHEMA_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported doc_type '{doc_type}'. Valid: {list(SCHEMA_REGISTRY.keys()) + ['custom']}"
        )

    # Validate folder_id if provided
    if folder_id:
        folder_exists = db.query(Folder).filter(Folder.id == folder_id).first()
        if not folder_exists:
            raise HTTPException(status_code=404, detail=f"Folder '{folder_id}' not found")

    # Rolling limit: enforce BEFORE creating the new job
    total_jobs = db.query(Job).count()
    if total_jobs >= 29:  # Leave room for the one we're about to create
        jobs_to_delete = total_jobs - 29
        oldest_jobs = db.query(Job).order_by(Job.created_at.asc()).limit(jobs_to_delete).all()
        for old_job in oldest_jobs:
            # Clean up saved file if it exists
            if old_job.file_path and os.path.exists(old_job.file_path):
                try:
                    os.remove(old_job.file_path)
                except OSError:
                    pass
            db.delete(old_job)
        db.commit()
        logger.info(f"Rolling limit: deleted {jobs_to_delete} old jobs")

    job_id = str(uuid.uuid4())

    try:
        file_bytes = await file.read()
    except Exception:
        raise HTTPException(status_code=400, detail="Failed to read uploaded file.")


    if len(file_bytes) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File size exceeds the {settings.MAX_FILE_SIZE_MB}MB limit.")

    # Save file to disk for later preview
    safe_filename = "".join(c for c in file.filename if c.isalnum() or c in '._- ').strip()
    file_path = os.path.join(PATH_UPLOADS, f"{job_id}_{safe_filename}")
    try:
        with open(file_path, "wb") as fp:
            fp.write(file_bytes)
    except Exception as e:
        logger.warning(f"Could not save file to disk: {e}")
        file_path = None

    new_job = Job(
        id=job_id,
        status="processing",
        doc_type=doc_type,
        filename=file.filename,
        model_used=model,
        folder_id=folder_id,
        schema_id=schema_id,
        file_path=file_path,
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    background_tasks.add_task(
        process_extraction_task,
        job_id,
        file_bytes,
        file.filename,
        file.content_type,
        doc_type,
        model,
        schema_id
    )

    logger.info(f"Job {job_id} queued for '{file.filename}' [{doc_type}] schema={schema_id} model={model}")
    return _job_to_result(new_job)


@router.get("/jobs", response_model=List[JobResult])
async def list_jobs(db: Session = Depends(get_db)):
    """Returns all extraction jobs ordered newest-first."""
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()
    return [_job_to_result(j) for j in jobs]


@router.get("/jobs/{job_id}", response_model=JobResult)
async def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Returns status and result for a specific job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_result(job)


@router.delete("/jobs/all")
async def delete_all_jobs(db: Session = Depends(get_db)):
    """Wipes all jobs for a fresh prototype session."""
    db.query(Job).delete()
    db.commit()
    return {"status": "success", "detail": "All jobs cleared"}


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, db: Session = Depends(get_db)):
    """Permanently deletes a job from history."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Remove saved file from disk
    if job.file_path and os.path.exists(job.file_path):
        try:
            os.remove(job.file_path)
        except OSError:
            pass

    db.delete(job)
    db.commit()
    return {"status": "success", "detail": f"Job {job_id} deleted"}

@router.post("/jobs/bulk-delete")
async def bulk_delete_jobs(req: BulkDeleteRequest, db: Session = Depends(get_db)):
    """Deletes multiple jobs at once, including their saved files."""
    if not req.job_ids:
        return {"status": "success", "deleted": 0}

    jobs_to_delete = db.query(Job).filter(Job.id.in_(req.job_ids)).all()
    for job in jobs_to_delete:
        if job.file_path and os.path.exists(job.file_path):
            try:
                os.remove(job.file_path)
            except OSError:
                pass
        db.delete(job)
    db.commit()
    return {"status": "success", "deleted": len(req.job_ids)}


@router.delete("/jobs")
async def purge_stale_jobs(db: Session = Depends(get_db)):
    """
    Deletes all jobs stuck in 'processing' for more than 10 minutes.
    Useful for cleaning up garbage data from failed server restarts.
    """
    cutoff = datetime.utcnow() - timedelta(minutes=10)
    stale = db.query(Job).filter(
        Job.status == "processing",
        Job.created_at < cutoff
    ).all()
    count = len(stale)
    for job in stale:
        db.delete(job)
    db.commit()
    logger.info(f"Purged {count} stale processing jobs.")
    return {"status": "success", "purged": count}

@router.get("/folders")
async def get_folders(db: Session = Depends(get_db)):
    folders = db.query(Folder).order_by(Folder.created_at.desc()).all()
    return [{"id": f.id, "name": f.name} for f in folders]
# 2. Create a folder
@router.post("/folders")
async def create_folder(folder: FolderCreate, db: Session = Depends(get_db)):
    new_folder = Folder(name=folder.name)
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)
    return {"id": new_folder.id, "name": new_folder.name}
# 3. Rename a folder
@router.patch("/folders/{folder_id}")
async def rename_folder(folder_id: str, data: FolderCreate, db: Session = Depends(get_db)):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    folder.name = data.name
    db.commit()
    db.refresh(folder)
    return {"id": folder.id, "name": folder.name}

# 4. Delete a folder
@router.delete("/folders/{folder_id}")
async def delete_folder(folder_id: str, db: Session = Depends(get_db)):
    folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    
    # Safely detach jobs from this folder
    jobs_in_folder = db.query(Job).filter(Job.folder_id == folder_id).all()
    for job in jobs_in_folder:
        job.folder_id = None
    
    db.delete(folder)
    db.commit()
    return {"message": "Folder deleted and jobs detached"}

# 5. Move a job to a folder
@router.patch("/jobs/{job_id}/folder")
async def move_job_to_folder(job_id: str, data: FolderUpdate, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job.folder_id = data.folder_id
    db.commit()
    return {"message": "Job moved"}


# ── Custom Schema Endpoints ──────────────────────────────────────────────────

@router.get("/schemas")
async def list_schemas(db: Session = Depends(get_db)):
    """Returns all custom schemas with their fields."""
    schemas = db.query(CustomSchema).order_by(CustomSchema.created_at.desc()).all()
    result = []
    for s in schemas:
        fields = db.query(CustomSchemaField).filter(CustomSchemaField.schema_id == s.id).all()
        result.append({
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "fields": [
                {
                    "id": f.id,
                    "name": f.name,
                    "field_type": f.field_type,
                    "description": f.description,
                    "is_required": f.is_required,
                    "list_item_schema": f.list_item_schema,
                }
                for f in fields
            ]
        })
    return result


@router.post("/schemas")
async def create_schema(data: SchemaIn, db: Session = Depends(get_db)):
    """Creates a new custom schema with its field definitions."""
    schema = CustomSchema(name=data.name, description=data.description)
    db.add(schema)
    db.flush()  # get schema.id before adding fields

    for f in data.fields:
        db.add(CustomSchemaField(
            schema_id=schema.id,
            name=f.name,
            field_type=f.field_type,
            description=f.description,
            is_required=f.is_required,
            list_item_schema=f.list_item_schema,
        ))

    db.commit()
    db.refresh(schema)
    fields = db.query(CustomSchemaField).filter(CustomSchemaField.schema_id == schema.id).all()
    return {
        "id": schema.id,
        "name": schema.name,
        "description": schema.description,
        "fields": [
            {
                "id": f.id,
                "name": f.name,
                "field_type": f.field_type,
                "description": f.description,
                "is_required": f.is_required,
                "list_item_schema": f.list_item_schema,
            }
            for f in fields
        ]
    }


@router.delete("/schemas/{schema_id}")
async def delete_schema(schema_id: str, db: Session = Depends(get_db)):
    """Deletes a custom schema and all its field definitions."""
    schema = db.query(CustomSchema).filter(CustomSchema.id == schema_id).first()
    if not schema:
        raise HTTPException(status_code=404, detail="Schema not found")
    db.query(CustomSchemaField).filter(CustomSchemaField.schema_id == schema_id).delete()
    db.delete(schema)
    db.commit()
    return {"message": "Schema deleted"}


# ── File Serving ─────────────────────────────────────────────────────────────

from fastapi.responses import FileResponse
import mimetypes

@router.get("/files/{job_id}")
async def get_job_file(job_id: str, db: Session = Depends(get_db)):
    """
    Serves the original uploaded file for a job.
    Used by the frontend to show the PDF preview for past extractions.
    """
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.file_path or not os.path.exists(job.file_path):
        raise HTTPException(status_code=404, detail="File not available. It may have been deleted or was uploaded before file persistence was enabled.")

    mime_type, _ = mimetypes.guess_type(job.file_path)
    if not mime_type:
        mime_type = "application/octet-stream"

    return FileResponse(
        path=job.file_path,
        media_type=mime_type,
        filename=job.filename or os.path.basename(job.file_path),
    )