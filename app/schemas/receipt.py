from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.base import BaseExtractionResult

class ReceiptItem(BaseModel):
    name: str = Field(description="Name or description of the purchased item.")
    quantity: Optional[float] = Field(default=None, description="Quantity of the item.")
    price: Optional[float] = Field(default=None, description="Total price for this item.")

class ReceiptData(BaseExtractionResult):
    store_name: Optional[str] = Field(default=None, description="Name of the store or merchant.")
    store_address: Optional[str] = Field(default=None, description="Physical address of the store.")
    date: Optional[str] = Field(default=None, description="Date of the purchase (ISO format preferred).")
    
    items: List[ReceiptItem] = Field(default_factory=list, description="List of items purchased.")
    
    subtotal: Optional[float] = Field(default=None, description="Total amount before taxes.")
    tax: Optional[float] = Field(default=None, description="Total tax amount.")
    total: Optional[float] = Field(default=None, description="Final total amount paid.")
    payment_method: Optional[str] = Field(default=None, description="Method of payment (e.g., Cash, Credit Card, Visa).")
