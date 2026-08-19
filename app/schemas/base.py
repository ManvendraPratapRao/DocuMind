from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class ExtractionStatus(str, Enum):
    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED"

class BaseExtractionResult(BaseModel):
    status: ExtractionStatus = Field(
        description="The overall status of the data extraction."
    )

    confidence_score: float = Field(
        description="Confidence score of the extraction (0.0 to 1.0)",
        ge=0.0, le=1.0
    )

    warning: List[str] = Field(
        default_factory=list,
        description="A list of warnings or issues encountered during extraction."
    )

    raw_text_preview: Optional[str] = Field(
        default=None,
        description="The first 500 characters of the raw extracted text for debugging."
    )