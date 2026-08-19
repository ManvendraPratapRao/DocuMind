from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.base import BaseExtractionResult

class ActionItem(BaseModel):
    description: str = Field(description="Description of the task or action item.")
    due_date: Optional[str] = Field(default=None, description="Due date for the action item, if mentioned.")
    assignee: Optional[str] = Field(default=None, description="Person assigned to the action item.")

class EmailData(BaseExtractionResult):
    sender: Optional[str] = Field(default=None, description="Name or email address of the sender.")
    recipient: Optional[str] = Field(default=None, description="Name or email address of the primary recipient(s).")
    subject: Optional[str] = Field(default=None, description="Subject line of the email.")
    body_summary: Optional[str] = Field(default=None, description="A brief 1-2 sentence summary of the email content.")
    intent: Optional[str] = Field(default=None, description="The primary intent of the email (e.g., Meeting Request, Invoice Attached, Inquiry).")
    
    action_items: List[ActionItem] = Field(default_factory=list, description="List of action items or tasks mentioned.")
    dates_mentioned: List[str] = Field(default_factory=list, description="Any specific dates or deadlines mentioned in the body.")
    urgency: Optional[str] = Field(default=None, description="Perceived urgency of the email (e.g., Low, Normal, High).")
