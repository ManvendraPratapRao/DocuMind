from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import health, extract, async_extract
from app.config import settings
from app.utils.logger import setup_logger
from app.database import engine
from app import models
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.limiter import limiter

logger = setup_logger("main")

# Startup table verification for test runners & workers
models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: ensure tables exist
    models.Base.metadata.create_all(bind=engine)
    logger.info(f"Starting up {settings.PROJECT_NAME} API v{settings.VERSION}...")
    yield
    # Shutdown
    logger.info("API shutting down gracefully...")

app = FastAPI(
    title="DocuMind API",
    description="Intelligent document extraction API",
    version="1.0.0",
    lifespan=lifespan
)

# Setup Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",   # Vite fallback port
    "http://127.0.0.1:5174",
    "http://localhost:3000",
]

if settings.FRONTEND_URL:
    for url in settings.FRONTEND_URL.split(","):
        cleaned = url.strip().rstrip("/")
        if cleaned and cleaned not in origins:
            origins.append(cleaned)

# Allow CORS for React Frontend (local + Vercel deployment)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Wire up the routers
app.include_router(health.router)
app.include_router(extract.router)
app.include_router(async_extract.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=str(settings.HOST),
        port=settings.PORT,
        reload=True
    )
