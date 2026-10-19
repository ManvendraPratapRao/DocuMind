import json
from groq import Groq
from app.utils.logger import setup_logger
from app.config import settings

logger = setup_logger("groq_client")

# Initialize the Groq client
client = Groq(api_key=settings.GROQ_API_KEY)

# Models that do NOT support response_format=json_object via Groq
# These will rely on prompt-level JSON instructions only
JSON_MODE_UNSUPPORTED_MODELS = {
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.6-27b",
    "qwen/qwen3.8-27b",
}

class GroqClientError(Exception):
    """Custom exception for Groq API errors."""
    pass

def chat_completion(system_prompt: str, user_prompt: str, json_mode: bool = True, model: str = None) -> str:
    """
    Sends a prompt to the Groq LLM and returns the response content.
    Synchronous — safe to call from background threads without asyncio.
    """
    effective_model = model or settings.DEFAULT_MODEL
    try:
        kwargs = {
            "model": effective_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.0,  # Deterministic extraction
        }

        # Only apply json_object response_format for models that support it
        if json_mode and effective_model not in JSON_MODE_UNSUPPORTED_MODELS:
            kwargs["response_format"] = {"type": "json_object"}

        response = client.chat.completions.create(**kwargs)

        content = response.choices[0].message.content
        if not content:
            raise GroqClientError("Groq returned an empty response.")

        return content

    except Exception as e:
        logger.error(f"Groq API Error: {str(e)}")
        raise GroqClientError(f"Failed to communicate with Groq: {str(e)}")

