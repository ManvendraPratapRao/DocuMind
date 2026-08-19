from typing import List, Optional
from pydantic import BaseModel, Field
from app.schemas.base import BaseExtractionResult

class Transaction(BaseModel):
    date: str = Field(description="Date of the transaction.")
    description: str = Field(description="Description or merchant name.")
    amount: float = Field(description="Amount of the transaction.")
    transaction_type: str = Field(description="Type of transaction: 'debit' or 'credit'.")
    balance: Optional[float] = Field(default=None, description="Account balance after the transaction.")

class BankStatementData(BaseExtractionResult):
    account_holder_name: Optional[str] = Field(default=None, description="Name of the account holder.")
    account_number: Optional[str] = Field(default=None, description="Account number (last 4 digits if partially masked).")
    bank_name: Optional[str] = Field(default=None, description="Name of the bank or financial institution.")
    statement_period_start: Optional[str] = Field(default=None, description="Start date of the statement period.")
    statement_period_end: Optional[str] = Field(default=None, description="End date of the statement period.")
    
    opening_balance: Optional[float] = Field(default=None, description="Opening balance for the period.")
    closing_balance: Optional[float] = Field(default=None, description="Closing balance for the period.")
    
    transactions: List[Transaction] = Field(default_factory=list, description="List of transactions in the statement.")
