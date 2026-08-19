from app.schemas.invoice import InvoiceData
from app.schemas.receipt import ReceiptData
from app.schemas.resume import ResumeData
from app.schemas.email_schema import EmailData
from app.schemas.purchase_order import PurchaseOrderData
from app.schemas.bank_statement import BankStatementData
from app.schemas.medical_bill import MedicalBillData

SCHEMA_REGISTRY = {
    "invoice": InvoiceData,
    "receipt": ReceiptData,
    "resume": ResumeData,
    "email": EmailData,
    "purchase_order": PurchaseOrderData,
    "bank_statement": BankStatementData,
    "medical_bill": MedicalBillData,
}
