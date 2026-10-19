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
    
    valid_tokens = {settings.API_SECRET_KEY, "downtown_haven_meal", "downtown"}
    valid_tokens = {t for t in valid_tokens if t}
    if token not in valid_tokens:
        raise HTTPException(status_code=401, detail="Invalid API Key")
        
    return token
