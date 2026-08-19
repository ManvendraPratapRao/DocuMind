from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.base import BaseExtractionResult

class OrderItem(BaseModel):
    item_description: str = Field(description="Description of the ordered item or service.")
    quantity: Optional[float] = Field(default=None, description="Quantity ordered.")
    unit_price: Optional[float] = Field(default=None, description="Price per single unit.")
    total_price: Optional[float] = Field(default=None, description="Total price for this line item.")

class PurchaseOrderData(BaseExtractionResult):
    po_number: Optional[str] = Field(default=None, description="Unique Purchase Order number.")
    vendor_name: Optional[str] = Field(default=None, description="Name of the vendor or supplier.")
    buyer_name: Optional[str] = Field(default=None, description="Name of the company or person making the purchase.")
    order_date: Optional[str] = Field(default=None, description="Date the purchase order was issued (ISO format).")
    delivery_date: Optional[str] = Field(default=None, description="Requested or expected delivery date (ISO format).")
    
    items: List[OrderItem] = Field(default_factory=list, description="List of items ordered.")
    
    total_amount: Optional[float] = Field(default=None, description="Total amount for the entire order.")
    shipping_address: Optional[str] = Field(default=None, description="Address where the goods should be shipped.")
