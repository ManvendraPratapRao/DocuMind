import pytest
from pydantic import ValidationError
from app.schemas.base import ExtractionStatus
from app.schemas.invoice import InvoiceData

def test_invoice_valid_data():
    data = {
        "status": ExtractionStatus.SUCCESS,
        "confidence_score": 0.95,
        "warning": [], # Note: matching your base schema field name "warning" instead of "warnings"
        "vendor_name": "Acme Corp",
        "total_amount": 100.50,
        "line_items": [
            {"description": "Widget", "quantity": 2, "unit_price": 50.25, "total": 100.50}
        ]
    }
    invoice = InvoiceData(**data)
    assert invoice.vendor_name == "Acme Corp"
    assert invoice.total_amount == 100.50
    assert len(invoice.line_items) == 1

def test_invoice_missing_status():
    data = {
        "confidence_score": 0.95,
        "vendor_name": "Acme Corp"
    }
    with pytest.raises(ValidationError):
        InvoiceData(**data)

def test_invoice_invalid_type_conversion():
    data = {
        "status": ExtractionStatus.SUCCESS,
        "confidence_score": 0.95,
        "total_amount": "one hundred"  # This should be a float!
    }
    with pytest.raises(ValidationError):
        InvoiceData(**data)
