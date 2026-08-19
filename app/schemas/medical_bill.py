from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.base import BaseExtractionResult

class ServiceLine(BaseModel):
    service_date: str = Field(description="Date the service or procedure was performed.")
    procedure_code: Optional[str] = Field(default=None, description="CPT or medical procedure code.")
    description: str = Field(description="Description of the service or procedure.")
    charges: float = Field(description="Amount charged for this specific service.")

class MedicalBillData(BaseExtractionResult):
    patient_name: Optional[str] = Field(default=None, description="Name of the patient receiving care.")
    patient_id: Optional[str] = Field(default=None, description="Patient account or medical record number.")
    provider_name: Optional[str] = Field(default=None, description="Name of the doctor, hospital, or clinic.")
    provider_npi: Optional[str] = Field(default=None, description="National Provider Identifier (NPI) of the provider.")
    
    service_lines: List[ServiceLine] = Field(default_factory=list, description="List of services provided.")
    
    total_charges: Optional[float] = Field(default=None, description="Total amount billed for all services.")
    insurance_paid: Optional[float] = Field(default=None, description="Amount covered or paid by insurance.")
    patient_responsibility: Optional[float] = Field(default=None, description="Final amount the patient is responsible to pay.")
