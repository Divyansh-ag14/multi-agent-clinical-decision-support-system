"""FastAPI application entry point."""

import os
import sys
import threading
import time
import uuid
from contextlib import asynccontextmanager

# Add project root to path for module resolution
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import config
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from rag.vectorstore import get_index_status
from utils.logger import clear_request_id, get_logger, agent_log, set_request_id

logger = get_logger()

# Rate limiter — keyed by client IP
limiter = Limiter(key_func=get_remote_address)

# Module-level health flags set during startup
rag_available = False
database_ok = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize resources on startup."""
    global rag_available, database_ok

    agent_log(logger, "api", "Starting Clinical Decision Support System...", "startup")

    # Ensure database tables exist
    from memory.long_term import LongTermMemory
    memory = LongTermMemory()
    try:
        await memory.init_db()
        database_ok = True
    except Exception as e:
        agent_log(logger, "api", f"WARNING: Failed to initialize database: {e}", "startup", "warning")

    # Load FAISS index in background thread (torch + sentence-transformers import is slow)
    def _load_rag():
        global rag_available
        try:
            from rag.vectorstore import get_retriever

            get_retriever()
            rag_available = True
            agent_log(logger, "api", "RAG retriever initialized (background)", "startup")
        except Exception as e:
            agent_log(logger, "api", f"WARNING: Failed to load FAISS vector store: {e}", "startup", "warning")
            agent_log(logger, "api", "RAG evidence retrieval will be unavailable", "startup", "warning")

    threading.Thread(target=_load_rag, daemon=True).start()
    agent_log(logger, "api", "FAISS loading in background...", "startup")

    agent_log(logger, "api", f"API ready on port {config.API_PORT}", "startup")
    agent_log(logger, "api", f"CORS allowed origins: {config.FRONTEND_URLS}", "startup")

    yield

    agent_log(logger, "api", "Shutting down Clinical Decision Support System", "shutdown")


app = FastAPI(
    title="Multi-Agent Clinical Decision Support System",
    description="AI-powered clinical diagnosis using multi-agent reasoning with LangGraph",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_URLS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    request_id = request.headers.get(config.REQUEST_ID_HEADER) or uuid.uuid4().hex[:8]
    request.state.request_id = request_id
    set_request_id(request_id)
    start = time.perf_counter()
    agent_log(
        logger,
        "api",
        f"Request started {request.method} {request.url.path}",
        "request",
        request_id=request_id,
    )
    try:
        response = await call_next(request)
    except Exception as exc:
        duration_ms = round((time.perf_counter() - start) * 1000, 1)
        agent_log(
            logger,
            "api",
            f"Request failed {request.method} {request.url.path} in {duration_ms}ms: {exc}",
            "request",
            "error",
            request_id=request_id,
        )
        clear_request_id()
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "request_id": request_id},
            headers={config.REQUEST_ID_HEADER: request_id},
        )

    duration_ms = round((time.perf_counter() - start) * 1000, 1)
    response.headers[config.REQUEST_ID_HEADER] = request_id
    agent_log(
        logger,
        "api",
        f"Request completed {request.method} {request.url.path} -> {response.status_code} in {duration_ms}ms",
        "request",
        request_id=request_id,
    )
    clear_request_id()
    return response

from api.routes import router
app.include_router(router, prefix="/api")


@app.get("/")
async def root():
    return {
        "name": "Multi-Agent Clinical Decision Support System",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /api/health",
            "interview": "POST /api/interview",
            "diagnose": "POST /api/diagnose",
            "compare": "POST /api/diagnose/compare",
            "memory": "GET /api/memory/{patient_id}",
        },
    }


@app.get("/api/health")
async def health_check():
    """Health check reporting system readiness and dependency status."""
    index_status = get_index_status()
    llm_ok = bool(config.OPENAI_API_KEY)
    supabase_ok = bool(config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY)

    all_ok = rag_available and database_ok and llm_ok and supabase_ok
    status = "ok" if all_ok else "degraded"

    issues = []
    if not rag_available:
        issues.append("RAG vector store unavailable — evidence retrieval disabled")
    if not database_ok:
        issues.append("Database connection failed — patient memory disabled")
    if not llm_ok:
        issues.append("LLM API key not configured — diagnosis will fail")
    if not supabase_ok:
        issues.append("Supabase not configured — auth and storage will fail")

    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={
            "status": status,
            "dependencies": {
                "rag_available": rag_available,
                "database_ok": database_ok,
                "llm_configured": llm_ok,
                "supabase_configured": supabase_ok,
            },
            "index_status": index_status,
            "issues": issues,
        },
    )
