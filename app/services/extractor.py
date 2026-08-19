import json
from pydantic import ValidationError
from typing import Dict, Any, Optional
import asyncio
import concurrent.futures

from app.schemas.base import BaseExtractionResult, ExtractionStatus
from app.schemas import SCHEMA_REGISTRY
from app.services.file_parser import ParsedDocument
from app.services.groq_client import chat_completion, GroqClientError
from app.utils.prompts import (
    SYSTEM_PROMPT,
    build_extraction_prompt,
    build_correction_prompt,
    build_partial_prompt
)
from app.utils.logger import setup_logger
from app.config import settings

logger = setup_logger("extractor")

def _clean_json_response(raw_response: str) -> str:
    """Strips markdown fences from LLM JSON responses."""
    cleaned = raw_response.strip()
    if cleaned.startswith("`json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("`"):
        cleaned = cleaned[3:]
    if cleaned.endswith("`"):
        cleaned = cleaned[:-3]
    return cleaned.strip()

def _parse_and_validate(json_str: str, model_class) -> BaseExtractionResult:
    """Parses JSON string and validates against the Pydantic model."""
    cleaned_json = _clean_json_response(json_str)
    try:
        data_dict = json.loads(cleaned_json)
        return model_class.model_validate(data_dict)
    except json.JSONDecodeError as e:
        raise ValueError(f"Failed to parse JSON from LLM: {str(e)}")

async def extract_document(parsed_doc: ParsedDocument, doc_type: str, model: str = None) -> BaseExtractionResult:
    """Core extraction engine with 3-attempt healing loop."""
    if doc_type not in SCHEMA_REGISTRY:
        raise ValueError(f"Unsupported document type: {doc_type}")

    model_class = SCHEMA_REGISTRY[doc_type]
    schema_json = json.dumps(model_class.model_json_schema(), indent=2)

    document_text = parsed_doc.text
    if not document_text:
        return model_class(
            status=ExtractionStatus.MANUAL_REVIEW_REQUIRED,
            confidence_score=0.0,
            warning=["No text could be extracted from the document."]
        )

    warnings = []
    response_str = ""
    last_error = None

    # ATTEMPT 1: Standard Extraction
    logger.info(f"Attempt 1: Extracting {doc_type}")
    try:
        prompt = build_extraction_prompt(doc_type, schema_json, document_text)
        response_str = chat_completion(SYSTEM_PROMPT, prompt, model=model)
        result = _parse_and_validate(response_str, model_class)
        result.status = ExtractionStatus.SUCCESS
        result.confidence_score = 0.95
        result.raw_text_preview = document_text[:500]
        return result
    except (ValidationError, ValueError, GroqClientError) as e1:
        logger.warning(f"Attempt 1 failed: {str(e1)}")
        warnings.append(f"Attempt 1 failed: {type(e1).__name__}")
        last_error = e1

    # ATTEMPT 2: Correction Prompt
    logger.info(f"Attempt 2: Fixing validation errors for {doc_type}")
    try:
        prompt = build_correction_prompt(response_str, str(last_error))
        response_str = chat_completion(SYSTEM_PROMPT, prompt, model=model)
        result = _parse_and_validate(response_str, model_class)
        result.status = ExtractionStatus.SUCCESS
        result.confidence_score = 0.85
        result.warning = warnings
        result.raw_text_preview = document_text[:500]
        return result
    except (ValidationError, ValueError, GroqClientError) as e2:
        logger.warning(f"Attempt 2 failed: {str(e2)}")
        warnings.append(f"Attempt 2 failed: {type(e2).__name__}")

    # ATTEMPT 3: Partial Extraction
    logger.info(f"Attempt 3: Requesting partial extraction for {doc_type}")
    try:
        prompt = build_partial_prompt(doc_type, schema_json, document_text)
        response_str = chat_completion(SYSTEM_PROMPT, prompt, model=model)
        cleaned_json = _clean_json_response(response_str)
        data_dict = json.loads(cleaned_json)
        if not any(data_dict.values()):
            raise ValueError("Partial extraction yielded empty data")
        result = model_class.model_construct(**data_dict)
        result.status = ExtractionStatus.PARTIAL
        result.confidence_score = 0.50
        result.warning = warnings + ["Data is incomplete; strict validation bypassed."]
        result.raw_text_preview = document_text[:500]
        return result
    except Exception as e3:
        logger.error(f"Attempt 3 failed: {str(e3)}")
        warnings.append("All automated extraction attempts failed.")

    # TOTAL FAILURE FALLBACK
    return model_class(
        status=ExtractionStatus.MANUAL_REVIEW_REQUIRED,
        confidence_score=0.0,
        warning=warnings,
        raw_text_preview=document_text[:500]
    )


def extract_document_sync(parsed_doc: ParsedDocument, doc_type: str, model: str = None) -> BaseExtractionResult:
    """
    Synchronous wrapper around extract_document for use in background threads.
    Uses get_running_loop to avoid asyncio.run() crash inside FastAPI's event loop.
    """
    def _run():
        return asyncio.run(extract_document(parsed_doc, doc_type, model=model))

    try:
        asyncio.get_running_loop()
        # We are inside a running event loop — use a separate thread to avoid nesting
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(_run).result()
    except RuntimeError:
        # No running loop — safe to call asyncio.run directly
        return asyncio.run(extract_document(parsed_doc, doc_type, model=model))


async def extract_document_custom(
    parsed_doc: ParsedDocument,
    schema_name: str,
    fields: list,
    model: str = None
) -> dict:
    """
    Runs the 3-attempt extraction engine with a dynamically built Pydantic model
    from user-defined custom schema fields (Option B: supports nested list fields).
    """
    from pydantic import create_model, Field as PydanticField
    from typing import Optional, List as TypingList
    import json as _json

    SCALAR_TYPE_MAP = {
        "text":    Optional[str],
        "number":  Optional[float],
        "date":    Optional[str],
        "boolean": Optional[bool],
    }

    # Build field definitions
    field_defs: dict = {}

    for f in fields:
        fname = f["name"]
        ftype = f.get("field_type", "text")
        fdesc = f.get("description") or fname

        if ftype == "list":
            raw_sub = f.get("list_item_schema")
            sub_fields = _json.loads(raw_sub) if raw_sub else []
            if sub_fields:
                sub_defs = {}
                for sf in sub_fields:
                    stype = SCALAR_TYPE_MAP.get(sf.get("field_type", "text"), Optional[str])
                    sub_defs[sf["name"]] = (
                        stype,
                        PydanticField(default=None, description=sf.get("description") or sf["name"])
                    )
                ItemModel = create_model(f"{fname}_item", **sub_defs)
                field_defs[fname] = (
                    TypingList[ItemModel],
                    PydanticField(default_factory=list, description=fdesc)
                )
            else:
                field_defs[fname] = (
                    TypingList[str],
                    PydanticField(default_factory=list, description=fdesc)
                )
        else:
            py_type = SCALAR_TYPE_MAP.get(ftype, Optional[str])
            field_defs[fname] = (
                py_type,
                PydanticField(default=None, description=fdesc)
            )

    # Add base metadata fields
    field_defs["status"] = (ExtractionStatus, PydanticField(default=ExtractionStatus.SUCCESS))
    field_defs["confidence_score"] = (float, PydanticField(default=0.95, ge=0.0, le=1.0))
    field_defs["warning"] = (list, PydanticField(default_factory=list))
    field_defs["raw_text_preview"] = (Optional[str], PydanticField(default=None))

    DynamicModel = create_model(schema_name.replace(" ", "_"), **field_defs)

    document_text = parsed_doc.text
    if not document_text:
        return DynamicModel(
            status=ExtractionStatus.MANUAL_REVIEW_REQUIRED,
            confidence_score=0.0,
            warning=["No text could be extracted from the document."]
        ).model_dump()

    schema_json = json.dumps(DynamicModel.model_json_schema(), indent=2)
    warnings = []
    response_str = ""
    last_error = None

    # Attempt 1: Standard Extraction
    logger.info(f"Custom schema attempt 1: {schema_name}")
    try:
        prompt = build_extraction_prompt(schema_name, schema_json, document_text)
        response_str = chat_completion(SYSTEM_PROMPT, prompt, model=model)
        result = _parse_and_validate(response_str, DynamicModel)
        result.status = ExtractionStatus.SUCCESS
        result.confidence_score = 0.95
        result.raw_text_preview = document_text[:500]
        return result.model_dump()
    except (ValidationError, ValueError, GroqClientError) as e1:
        logger.warning(f"Custom schema attempt 1 failed: {e1}")
        warnings.append(f"Attempt 1 failed: {type(e1).__name__}")
        last_error = e1

    # Attempt 2: Correction Prompt
    logger.info(f"Custom schema attempt 2: {schema_name}")
    try:
        prompt = build_correction_prompt(response_str, str(last_error))
        response_str = chat_completion(SYSTEM_PROMPT, prompt, model=model)
        result = _parse_and_validate(response_str, DynamicModel)
        result.status = ExtractionStatus.SUCCESS
        result.confidence_score = 0.85
        result.warning = warnings
        result.raw_text_preview = document_text[:500]
        return result.model_dump()
    except (ValidationError, ValueError, GroqClientError) as e2:
        logger.warning(f"Custom schema attempt 2 failed: {e2}")
        warnings.append(f"Attempt 2 failed: {type(e2).__name__}")

    # Attempt 3: Partial / best-effort
    logger.info(f"Custom schema attempt 3 (partial): {schema_name}")
    try:
        prompt = build_partial_prompt(schema_name, schema_json, document_text)
        response_str = chat_completion(SYSTEM_PROMPT, prompt, model=model)
        cleaned = _clean_json_response(response_str)
        data_dict = json.loads(cleaned)
        result = DynamicModel.model_construct(**data_dict)
        result.status = ExtractionStatus.PARTIAL
        result.confidence_score = 0.50
        result.warning = warnings + ["Data is incomplete; strict validation bypassed."]
        result.raw_text_preview = document_text[:500]
        return result.model_dump()
    except Exception as e3:
        logger.error(f"Custom schema attempt 3 failed: {e3}")

    # Total failure fallback
    return DynamicModel(
        status=ExtractionStatus.MANUAL_REVIEW_REQUIRED,
        confidence_score=0.0,
        warning=warnings + ["All extraction attempts failed."],
        raw_text_preview=document_text[:500]
    ).model_dump()


def extract_document_custom_sync(
    parsed_doc: ParsedDocument,
    schema_name: str,
    fields: list,
    model: str = None
) -> dict:
    """
    Synchronous version of extract_document_custom for background threads.
    """
    def _run():
        return asyncio.run(extract_document_custom(parsed_doc, schema_name, fields, model=model))

    try:
        asyncio.get_running_loop()
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            return pool.submit(_run).result()
    except RuntimeError:
        return asyncio.run(extract_document_custom(parsed_doc, schema_name, fields, model=model))
