import os

from dotenv import load_dotenv

#load env variables from .env file
load_dotenv()

class Settings:
    # API keys
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    API_SECRET_KEY: str = os.getenv("API_SECRET_KEY", "")
    
    # App Settings
    PROJECT_NAME: str =  "DocuMind API"
    VERSION: str = "1.0.0"
    
    # Extraction & Model Configuration
    MAX_FILE_SIZE_MB: int = 10
    MAX_RETRIES: int = 3
    EXTRACT_IMAGES: bool = True
    
    # Server configuration
    HOST: str = "0.0.0.0"
    PORT: int = 8000

    # Models Available (you can expand this as needed)
    SUPPORTED_MODELS: list[str] = [
        "llama-3.3-70b-versatile",
        "mixtral-8x7b-32768",
        "openai/gpt-oss-120b",
        "qwen/qwen3.6-27b"
    ]
    DEFAULT_MODEL: str = "llama-3.3-70b-versatile"

# Instantiate settings to be imported across the app
settings = Settings()