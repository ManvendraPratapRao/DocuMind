from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.base import BaseExtractionResult

class LineItem(BaseModel):
    description: str = Field(description="Description of the product or service.")
    quantity: Optional[float] = Field(default=None, description="Quantity of the item.")
    unit_price: Optional[float] = Field(default=None, description="Price per single unit.")
    total: Optional[float] = Field(default=None, description="Total price for this line item.")

class InvoiceData(BaseExtractionResult):
    vendor_name: Optional[str] = Field(default=None, description="Name of the company or person issuing the invoice.")
    buyer_name: Optional[str] = Field(default=None, description="Name of the company or person receiving the invoice.")
    invoice_number: Optional[str] = Field(default=None, description="Unique identifier or number of the invoice.")
    invoice_date: Optional[str] = Field(default=None, description="Date the invoice was issued (ISO format preferred).")
    due_date: Optional[str] = Field(default=None, description="Date the invoice payment is due (ISO format preferred).")
    
    line_items: List[LineItem] = Field(default_factory=list, description="List of items or services billed.")
    
    subtotal: Optional[float] = Field(default=None, description="Total amount before taxes and discounts.")
    tax_amount: Optional[float] = Field(default=None, description="Total tax amount applied.")
    total_amount: Optional[float] = Field(default=None, description="Final total amount to be paid.")
    currency: Optional[str] = Field(default=None, description="Currency code (e.g., USD, EUR, INR).")
