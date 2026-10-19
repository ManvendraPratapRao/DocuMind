from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader
from app.config import settings

# This tells Swagger UI to create a native green Authorize button for us
api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

async def verify_api_key(api_key_value: str = Security(api_key_header)):
    """
    Dependency to verify the API key provided in the Authorization header.
    """
    if not api_key_value:
        raise HTTPException(status_code=401, detail="Authorization header missing")
        
    parts = api_key_value.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'Bearer <token>'")
        
    token = parts[1]
    
    expected_key = settings.API_SECRET_KEY
    if not expected_key:
        raise HTTPException(status_code=500, detail="Server misconfigured: API_SECRET_KEY is not set.")

    if token != expected_key:
        raise HTTPException(status_code=401, detail="Invalid API Key")
        
    return token
