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
import csv
import io
import mimetypes
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks, Request, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import settings
from app.schemas import SCHEMA_REGISTRY
from app.services.file_parser import parse_file
from app.services.extractor import extract_document, extract_document_sync, extract_document_custom, extract_document_custom_sync
from app.services.webhook import format_job_payload, send_webhook_sync, send_webhook_async
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
    batch_id: Optional[str] = None
    status: str
    doc_type: Optional[str] = None
    filename: Optional[str] = None
    model_used: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    created_at: str
    completed_at: Optional[str] = None

class BatchCreateResponse(BaseModel):
    batch_id: str
    total: int
    status: str
    job_ids: List[str]

class BatchSummary(BaseModel):
    batch_id: str
    doc_type: str
    total: int
    completed: int
    failed: int
    pending: int
    percent_complete: float
    status: str
    created_at: str
    jobs: List[JobResult]

class WebhookTestRequest(BaseModel):
    url: str
    payload: Optional[Dict[str, Any]] = None

class WebhookSendRequest(BaseModel):
    url: str
    job_ids: List[str]

class FolderCreate(BaseModel):
    name: str

class FolderUpdate(BaseModel):
    folder_id: str | None

class JobUpdateResult(BaseModel):
    result: Dict[str, Any]

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
        batch_id=job.batch_id,
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
    schema_id: str = None,
    webhook_url: str = None
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

            # Automatic Webhook Delivery
            if webhook_url:
                try:
                    wh_payload = format_job_payload(job)
                    send_webhook_sync(webhook_url, wh_payload)
                except Exception as wh_err:
                    logger.warning(f"Webhook dispatch failed for job {job_id}: {wh_err}")

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


def process_batch_task(
    batch_id: str,
    job_ids: List[str],
    doc_type: str,
    model: str = None,
    schema_id: str = None,
    webhook_url: str = None
):
    """
    Background batch task processor.
    Sequentially processes each file in the batch:
    1. Loads the saved file from disk (disk-spooling to save RAM)
    2. Runs layout parsing and LLM extraction
    3. Saves structured result to database
    4. Handles per-document failures without halting the rest of the batch
    """
    logger.info(f"Starting batch worker for batch {batch_id} with {len(job_ids)} jobs.")
    db = SessionLocal()
    try:
        for index, j_id in enumerate(job_ids, start=1):
            job = db.query(Job).filter(Job.id == j_id).first()
            if not job or not job.file_path or not os.path.exists(job.file_path):
                logger.warning(f"Batch {batch_id}: Job {j_id} file not found on disk.")
                if job:
                    job.status = "failed"
                    job.error = "Uploaded file not found on server disk."
                    job.completed_at = datetime.utcnow()
                    db.commit()
                continue

            try:
                job.status = "processing"
                db.commit()

                with open(job.file_path, "rb") as fp:
                    file_bytes = fp.read()

                content_type, _ = mimetypes.guess_type(job.file_path)
                content_type = content_type or "application/pdf"

                parsed_doc = parse_file(file_bytes, job.filename or "file.pdf", content_type)

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

                job.status = "done"
                job.result_json = json.dumps(result_dict)
                job.completed_at = datetime.utcnow()
                db.commit()
                logger.info(f"Batch {batch_id} [{index}/{len(job_ids)}]: Successfully extracted {job.filename}")

                # Automatic Webhook Delivery per item
                if webhook_url:
                    try:
                        wh_payload = format_job_payload(job)
                        send_webhook_sync(webhook_url, wh_payload)
                    except Exception as wh_err:
                        logger.warning(f"Batch webhook dispatch failed for job {job.id}: {wh_err}")

            except Exception as item_err:
                logger.error(f"Batch {batch_id} [{index}/{len(job_ids)}]: Error extracting {job.filename}: {item_err}", exc_info=True)
                db.rollback()
                job = db.query(Job).filter(Job.id == j_id).first()
                if job:
                    job.status = "failed"
                    job.error = str(item_err)[:1000]
                    job.completed_at = datetime.utcnow()
                    db.commit()
    finally:
        db.close()
        logger.info(f"Batch worker finished for batch {batch_id}.")


@router.post("/extract", response_model=JobResult, status_code=202)
@limiter.limit("30/minute")
async def extract_data_async(
    request: Request,
    background_tasks: BackgroundTasks,
    doc_type: str = Form(..., description="The type of document"),
    model: str = Form(None, description="The LLM model to use (optional)"),
    folder_id: str = Form(None, description="Target folder ID (optional)"),
    schema_id: str = Form(None, description="Custom schema ID (required when doc_type=custom)"),
    webhook_url: str = Form(None, description="Webhook URL to POST extraction results to (optional)"),
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
    if total_jobs >= 150:  # Expanded limit for high-volume workflows
        jobs_to_delete = total_jobs - 149
        oldest_jobs = db.query(Job).order_by(Job.created_at.asc()).limit(jobs_to_delete).all()
        for old_job in oldest_jobs:
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
        schema_id,
        webhook_url
    )

    logger.info(f"Job {job_id} queued for '{file.filename}' [{doc_type}] schema={schema_id} model={model}")
    return _job_to_result(new_job)


@router.get("/jobs", response_model=List[JobResult])
async def list_jobs(db: Session = Depends(get_db)):
    """Returns all extraction jobs ordered newest-first."""
    jobs = db.query(Job).order_by(Job.created_at.desc()).all()
    return [_job_to_result(j) for j in jobs]


# ── Batch Extraction Endpoints ──────────────────────────────────────────────

@router.post("/batch-extract", response_model=BatchCreateResponse, status_code=202)
@limiter.limit("20/minute")
async def extract_batch_async(
    request: Request,
    background_tasks: BackgroundTasks,
    doc_type: str = Form(..., description="The type of document"),
    model: str = Form(None, description="The LLM model to use (optional)"),
    folder_id: str = Form(None, description="Target folder ID (optional)"),
    schema_id: str = Form(None, description="Custom schema ID (required when doc_type=custom)"),
    webhook_url: str = Form(None, description="Webhook URL to POST extraction results to (optional)"),
    files: List[UploadFile] = File(..., description="Up to 50 documents to process in batch"),
    db: Session = Depends(get_db)
):
    """
    Submits up to 50 documents for batch background extraction.
    Creates job records linked by a common batch_id and starts sequential processing in the background.
    Poll GET /async/batch/{batch_id} to track real-time progress.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided for batch processing.")

    if len(files) > 50:
        raise HTTPException(status_code=400, detail=f"Maximum 50 files allowed per batch (received {len(files)}).")

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

    if folder_id:
        folder_exists = db.query(Folder).filter(Folder.id == folder_id).first()
        if not folder_exists:
            raise HTTPException(status_code=404, detail=f"Folder '{folder_id}' not found")

    batch_id = str(uuid.uuid4())
    job_ids = []

    # Enforce rolling limit for space
    total_jobs = db.query(Job).count()
    if total_jobs + len(files) > 200:
        jobs_to_delete = (total_jobs + len(files)) - 200
        oldest_jobs = db.query(Job).order_by(Job.created_at.asc()).limit(jobs_to_delete).all()
        for old_job in oldest_jobs:
            if old_job.file_path and os.path.exists(old_job.file_path):
                try:
                    os.remove(old_job.file_path)
                except OSError:
                    pass
            db.delete(old_job)
        db.commit()

    for file in files:
        job_id = str(uuid.uuid4())
        try:
            file_bytes = await file.read()
        except Exception:
            continue

        if len(file_bytes) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
            continue

        safe_filename = "".join(c for c in (file.filename or "file") if c.isalnum() or c in '._- ').strip()
        file_path = os.path.join(PATH_UPLOADS, f"{job_id}_{safe_filename}")
        try:
            with open(file_path, "wb") as fp:
                fp.write(file_bytes)
        except Exception as e:
            logger.warning(f"Could not save batch file to disk: {e}")
            file_path = None

        new_job = Job(
            id=job_id,
            batch_id=batch_id,
            status="pending",
            doc_type=doc_type,
            filename=file.filename or safe_filename,
            model_used=model,
            folder_id=folder_id,
            schema_id=schema_id,
            file_path=file_path,
        )
        db.add(new_job)
        job_ids.append(job_id)

    db.commit()

    if not job_ids:
        raise HTTPException(status_code=400, detail="None of the uploaded files could be processed.")

    background_tasks.add_task(
        process_batch_task,
        batch_id,
        job_ids,
        doc_type,
        model,
        schema_id,
        webhook_url
    )

    logger.info(f"Batch {batch_id} queued with {len(job_ids)} jobs.")
    return BatchCreateResponse(
        batch_id=batch_id,
        total=len(job_ids),
        status="processing",
        job_ids=job_ids
    )


@router.get("/batch/{batch_id}", response_model=BatchSummary)
async def get_batch_status(batch_id: str, db: Session = Depends(get_db)):
    """
    Returns real-time aggregated progress of a batch extraction.
    Includes percent completion, job statuses, and individual results.
    """
    jobs = db.query(Job).filter(Job.batch_id == batch_id).order_by(Job.created_at.asc()).all()
    if not jobs:
        raise HTTPException(status_code=404, detail=f"Batch '{batch_id}' not found")

    total = len(jobs)
    completed = sum(1 for j in jobs if j.status == "done")
    failed = sum(1 for j in jobs if j.status == "failed")
    pending = sum(1 for j in jobs if j.status in ["processing", "pending"])
    percent = round(((completed + failed) / total) * 100, 1) if total > 0 else 0.0
    overall_status = "completed" if pending == 0 else "processing"

    doc_type = jobs[0].doc_type if jobs else "invoice"
    created_at = jobs[0].created_at.isoformat() if jobs else datetime.utcnow().isoformat()

    return BatchSummary(
        batch_id=batch_id,
        doc_type=doc_type,
        total=total,
        completed=completed,
        failed=failed,
        pending=pending,
        percent_complete=percent,
        status=overall_status,
        created_at=created_at,
        jobs=[_job_to_result(j) for j in jobs]
    )


@router.get("/batch/{batch_id}/export-csv")
async def export_batch_csv(batch_id: str, db: Session = Depends(get_db)):
    """
    Combines extracted structured data from all completed jobs in a batch into a unified CSV.
    Handles invoices, receipts, and general schemas with line items or flat key-value pairs.
    """
    jobs = db.query(Job).filter(Job.batch_id == batch_id, Job.status == "done").order_by(Job.created_at.asc()).all()
    if not jobs:
        raise HTTPException(status_code=404, detail=f"No completed jobs found for batch {batch_id}")

    output = io.StringIO()
    all_rows = []

    for job in jobs:
        if not job.result_json:
            continue
        try:
            data = json.loads(job.result_json)
        except Exception:
            continue

        base_meta = {
            "batch_id": batch_id,
            "filename": job.filename,
            "doc_type": job.doc_type,
            "confidence_score": data.get("confidence_score", ""),
            "status": job.status,
            "created_at": job.created_at.strftime("%Y-%m-%d %H:%M:%S") if job.created_at else "",
        }

        # Check for list of line items or transactions
        line_items = None
        for key in ["line_items", "items", "transactions", "experience"]:
            if key in data and isinstance(data[key], list) and len(data[key]) > 0:
                line_items = (key, data[key])
                break

        # Flat scalar fields (excluding long previews/warnings)
        scalar_fields = {
            k: v for k, v in data.items()
            if not isinstance(v, (dict, list)) and k not in ["raw_text_preview", "warning", "confidence_score", "status"]
        }

        if line_items:
            key_name, items_list = line_items
            for item in items_list:
                row = {**base_meta, **scalar_fields}
                if isinstance(item, dict):
                    for ik, iv in item.items():
                        row[f"item_{ik}"] = iv
                else:
                    row["item_value"] = str(item)
                all_rows.append(row)
        else:
            row = {**base_meta, **scalar_fields}
            all_rows.append(row)

    if not all_rows:
        raise HTTPException(status_code=404, detail="No extracted data available to export.")

    # Determine unique headers preserving order
    fieldnames = []
    for r in all_rows:
        for k in r.keys():
            if k not in fieldnames:
                fieldnames.append(k)

    writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
    writer.writeheader()
    for r in all_rows:
        writer.writerow(r)

    csv_content = output.getvalue()
    filename = f"batch_{batch_id[:8]}_export.csv"
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/jobs/{job_id}", response_model=JobResult)
async def get_job_status(job_id: str, db: Session = Depends(get_db)):
    """Returns status and result for a specific job."""
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_result(job)


@router.patch("/jobs/{job_id}", response_model=JobResult)
async def update_job_result(job_id: str, payload: JobUpdateResult, db: Session = Depends(get_db)):
    '''Updates the extracted result JSON for a specific job (interactive field editing).'''
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.result_json = json.dumps(payload.result)
    db.commit()
    db.refresh(job)
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


# ── Webhook Endpoints ────────────────────────────────────────────────────────

@router.post("/webhook/test")
async def test_webhook_endpoint(data: WebhookTestRequest):
    """
    Tests connectivity to a user-provided webhook URL (e.g. Google Sheets Web App or Zapier).
    Returns HTTP status code, latency in ms, and preview of destination response.
    """
    if not data.url or not data.url.strip().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid URL. Must start with http:// or https://")

    sample_payload = data.payload or {
        "event": "test.ping",
        "timestamp": datetime.utcnow().isoformat(),
        "filename": "DocuMind_Sample_Invoice.pdf",
        "doc_type": "invoice",
        "confidence_score": 0.98,
        "data": {
            "invoice_number": "INV-TEST-001",
            "invoice_date": datetime.utcnow().strftime("%Y-%m-%d"),
            "vendor_name": "DocuMind Global Logistics",
            "buyer_name": "Acme Corporation",
            "total_amount": 1250.00,
            "status": "verified"
        }
    }

    result = await send_webhook_async(data.url, sample_payload)
    if not result.get("success"):
        err_msg = result.get("error") or f"Webhook endpoint returned HTTP status {result.get('status_code')}"
        if result.get("status_code") == 401 and "script.google.com" in data.url:
            err_msg = "Google Apps Script 401 Unauthorized: Your script is blocking anonymous webhooks. In Apps Script: 1) Click Deploy -> New deployment, 2) Set 'Who has access' to 'Anyone' (not 'Only myself'), and 3) Copy the URL ending in '/exec' (not '/dev')."
        raise HTTPException(
            status_code=400,
            detail=err_msg
        )

    return {
        "status": "success",
        "status_code": result.get("status_code"),
        "latency_ms": result.get("latency_ms"),
        "response_text": result.get("response_text")
    }


@router.post("/webhook/send")
async def send_jobs_to_webhook(data: WebhookSendRequest, db: Session = Depends(get_db)):
    """
    Dispatches selected jobs to a webhook URL via the backend server.
    Bypasses browser CORS restrictions when sending to Google Apps Script.
    """
    if not data.url or not data.url.strip().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="Invalid webhook URL.")

    jobs = db.query(Job).filter(Job.id.in_(data.job_ids)).all()
    if not jobs:
        raise HTTPException(status_code=404, detail="No matching jobs found.")

    payloads = [format_job_payload(j) for j in jobs]
    body = payloads[0] if len(payloads) == 1 else payloads

    result = await send_webhook_async(data.url, body)
    if not result.get("success"):
        raise HTTPException(
            status_code=400,
            detail=result.get("error") or f"Webhook delivery failed with HTTP {result.get('status_code')}"
        )

    return {
        "status": "success",
        "records_sent": len(jobs),
        "status_code": result.get("status_code"),
        "latency_ms": result.get("latency_ms")
    }