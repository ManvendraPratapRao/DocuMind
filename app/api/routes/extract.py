from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Request
from typing import Dict, Any
from app.config import settings
from app.schemas import SCHEMA_REGISTRY
from app.services.file_parser import parse_file
from app.services.extractor import extract_document
from app.api.dependencies import verify_api_key
from app.utils.logger import setup_logger
from app.limiter import limiter

logger = setup_logger("extract_route")

# Note the dependencies=[Depends(verify_api_key)]! 
# This protects every route inside this router.
router = APIRouter(
    prefix="/extract",
    tags=["Extraction"],
    dependencies=[Depends(verify_api_key)]
)

@router.post("")
@limiter.limit("10/minute")
async def extract_data_from_document(
    request: Request,
    doc_type: str = Form(..., description="The type of document (e.g., invoice, receipt, resume)"),
    file: UploadFile = File(...)
) -> Dict[str, Any]:
    """
    Extracts structured data from an uploaded document using LLM parsing.
    Requires an API key in the Authorization header.
    """
    # 1. Validate doc_type
    if doc_type not in SCHEMA_REGISTRY:
        supported = ", ".join(SCHEMA_REGISTRY.keys())
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported doc_type: '{doc_type}'. Supported types are: {supported}"
        )
        
    # 2. Read and parse file
    try:
        file_bytes = await file.read()
        
        if len(file_bytes) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
            raise HTTPException(status_code=413, detail=f"File size exceeds the {settings.MAX_FILE_SIZE_MB}MB limit.")
            
        parsed_doc = parse_file(file_bytes, file.filename, file.content_type)
    except ValueError as e:
        logger.warning(f"File parsing error for {file.filename}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected file parsing error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error during file processing.")
        
    # 3. Extract data using LLM
    try:
        result = await extract_document(parsed_doc, doc_type)
        return result.model_dump()
    except Exception as e:
        logger.error(f"Extraction engine failed completely: {str(e)}")
        raise HTTPException(status_code=500, detail="Extraction engine failed to process the document.")
