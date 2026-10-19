from fastapi import Security, HTTPException
from fastapi.security import APIKeyHeader
from app.config import settings

# Native green Authorize button in Swagger UI
api_key_header = APIKeyHeader(name="Authorization", auto_error=False)

DEFAULT_DEMO_KEY = "documind_demo_access"

async def verify_api_key(api_key_value: str = Security(api_key_header)):
    """
    Dependency to verify the API key provided in the Authorization header.
    Accepts the configured server API_SECRET_KEY or the built-in demo key.
    """
    if not api_key_value:
        raise HTTPException(status_code=401, detail="Authorization header missing")
        
    parts = api_key_value.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid authorization header format. Expected 'Bearer <token>'")
        
    token = parts[1]
    
    valid_tokens = {settings.API_SECRET_KEY, DEFAULT_DEMO_KEY}
    valid_tokens = {t for t in valid_tokens if t}

    if token not in valid_tokens:
        raise HTTPException(status_code=401, detail="Invalid API Key")
        
    return token
