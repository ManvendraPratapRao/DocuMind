import json
import logging
import time
from typing import Dict, Any, List, Optional
import httpx

logger = logging.getLogger(__name__)


def flatten_result_data(result: Dict[str, Any]) -> Dict[str, Any]:
    """
    Extracts high-level scalar fields from extraction results into a clean, flat dictionary.
    Excludes large nested arrays (like raw line items or bounding boxes) so they fit cleanly in spreadsheet columns.
    """
    if not isinstance(result, dict):
        return {}

    flat = {}
    for k, v in result.items():
        if k in ("raw_text_preview", "warnings", "warning", "status", "confidence_score"):
            continue
        if isinstance(v, (str, int, float, bool)) or v is None:
            flat[k] = v
        elif isinstance(v, dict):
            # Nested 1-level dictionary (e.g. vendor: {name: 'Acme'})
            for sub_k, sub_v in v.items():
                if isinstance(sub_v, (str, int, float, bool)):
                    flat[f"{k}_{sub_k}"] = sub_v
    return flat


def format_job_payload(job, event_type: str = "extraction.completed") -> Dict[str, Any]:
    """
    Standardizes job data into an event-driven webhook payload.
    """
    result_dict = {}
    if job.result_json:
        try:
            result_dict = json.loads(job.result_json)
        except Exception:
            result_dict = {}

    confidence = result_dict.get("confidence_score")
    if confidence is None:
        confidence = 1.0

    return {
        "event": event_type,
        "job_id": job.id,
        "batch_id": job.batch_id,
        "filename": job.filename,
        "doc_type": job.doc_type,
        "status": job.status,
        "confidence_score": confidence,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "data": flatten_result_data(result_dict),
        "raw_data": result_dict,
    }


def send_webhook_sync(url: str, payload: Any, timeout: float = 12.0) -> Dict[str, Any]:
    """
    Sends an HTTP POST webhook request synchronously.
    Uses follow_redirects=True to handle Google Apps Script 302 redirects automatically.
    """
    if not url or not url.strip().startswith(("http://", "https://")):
        return {"success": False, "error": "Invalid webhook URL"}

    start_time = time.time()
    try:
        with httpx.Client(timeout=timeout, follow_redirects=True) as client:
            response = client.post(
                url.strip(),
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "DocuMind-AI-Webhook/1.0"
                }
            )
            latency_ms = int((time.time() - start_time) * 1000)
            is_success = 200 <= response.status_code < 300
            
            logger.info(f"Webhook to {url[:40]}... returned status {response.status_code} in {latency_ms}ms")
            return {
                "success": is_success,
                "status_code": response.status_code,
                "latency_ms": latency_ms,
                "response_text": response.text[:400] if response.text else "",
            }
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        logger.error(f"Webhook delivery failed for {url}: {e}")
        return {
            "success": False,
            "status_code": 0,
            "latency_ms": latency_ms,
            "error": str(e)
        }


async def send_webhook_async(url: str, payload: Any, timeout: float = 12.0) -> Dict[str, Any]:
    """
    Asynchronous version of webhook sender for FastAPI async routes.
    """
    if not url or not url.strip().startswith(("http://", "https://")):
        return {"success": False, "error": "Invalid webhook URL"}

    start_time = time.time()
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.post(
                url.strip(),
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "DocuMind-AI-Webhook/1.0"
                }
            )
            latency_ms = int((time.time() - start_time) * 1000)
            is_success = 200 <= response.status_code < 300
            return {
                "success": is_success,
                "status_code": response.status_code,
                "latency_ms": latency_ms,
                "response_text": response.text[:400] if response.text else "",
            }
    except Exception as e:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "success": False,
            "status_code": 0,
            "latency_ms": latency_ms,
            "error": str(e)
        }
