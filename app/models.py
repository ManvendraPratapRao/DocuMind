from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Boolean
from datetime import datetime, timezone
from app.database import Base
import uuid

def _utcnow():
    """Return current UTC time — timezone-aware compatible helper."""
    return datetime.now(timezone.utc).replace(tzinfo=None)  # Store as naive UTC

class Folder(Base):
    __tablename__ = "folders"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

class CustomSchema(Base):
    __tablename__ = "custom_schemas"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)

class CustomSchemaField(Base):
    __tablename__ = "custom_schema_fields"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    schema_id = Column(String, ForeignKey("custom_schemas.id"), nullable=False)
    name = Column(String, nullable=False)
    # field_type: "text" | "number" | "date" | "boolean" | "list"
    field_type = Column(String, nullable=False, default="text")
    description = Column(String, nullable=True)
    is_required = Column(Boolean, default=False, nullable=False)
    # For field_type="list": JSON string of sub-field definitions
    list_item_schema = Column(Text, nullable=True)

class Job(Base):
    __tablename__ = "jobs"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    folder_id = Column(String, ForeignKey("folders.id"), nullable=True)
    schema_id = Column(String, ForeignKey("custom_schemas.id"), nullable=True)
    status = Column(String, default="processing", nullable=False)
    doc_type = Column(String, nullable=True)
    filename = Column(String, nullable=True)
    file_path = Column(String, nullable=True)  # Path to saved uploaded file on disk
    model_used = Column(String, nullable=True)
    result_json = Column(Text, nullable=True)
    error = Column(String(1000), nullable=True)
    created_at = Column(DateTime, default=_utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
