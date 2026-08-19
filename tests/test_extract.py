import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)

# We use the actual API key from settings to ensure tests pass
HEADERS = {
    "Authorization": f"Bearer {settings.API_SECRET_KEY}"
}

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_missing_api_key():
    response = client.post(
        "/extract",
        data={"doc_type": "invoice"},
        files={"file": ("test.txt", b"dummy content", "text/plain")}
    )
    assert response.status_code == 401
    assert "Authorization header missing" in response.json()["detail"]

def test_invalid_api_key():
    response = client.post(
        "/extract",
        headers={"Authorization": "Bearer BAD_KEY"},
        data={"doc_type": "invoice"},
        files={"file": ("test.txt", b"dummy content", "text/plain")}
    )
    assert response.status_code == 401

def test_invalid_doc_type():
    response = client.post(
        "/extract",
        headers=HEADERS,
        data={"doc_type": "spaceshiplog"}, # Invalid schema
        files={"file": ("test.txt", b"dummy content", "text/plain")}
    )
    assert response.status_code == 400
    assert "Unsupported doc_type" in response.json()["detail"]

def test_async_job_creation():
    response = client.post(
        "/async/extract",
        headers=HEADERS,
        data={"doc_type": "invoice"},
        files={"file": ("test.txt", b"dummy content", "text/plain")}
    )
    assert response.status_code == 200
    data = response.json()
    assert "job_id" in data
    assert data["status"] == "processing"
    
    # Check if the job exists in the GET endpoint
    job_id = data["job_id"]
    job_response = client.get(f"/async/jobs/{job_id}", headers=HEADERS)
    assert job_response.status_code == 200
    assert job_response.json()["job_id"] == job_id
