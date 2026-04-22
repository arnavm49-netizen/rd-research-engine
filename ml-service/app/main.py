from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.services.embeddings import EmbeddingService
from app.services.vector_store import VectorStoreService
from app.routers import ingest, query, discover, translate, formulas, gaps


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize services on startup."""
    # Load embedding model
    app.state.embedding_service = EmbeddingService()
    app.state.vector_store = VectorStoreService()
    await app.state.vector_store.ensure_collection()
    print("ML Service ready — embedding model loaded, Qdrant collection verified")
    yield
    print("ML Service shutting down")


app = FastAPI(
    title="R&D Research Engine — ML Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(ingest.router, prefix="/ingest", tags=["ingestion"])
app.include_router(query.router, prefix="/query", tags=["query"])
app.include_router(discover.router, prefix="/discover", tags=["discovery"])
app.include_router(translate.router, prefix="/translate", tags=["translation"])
app.include_router(formulas.router, prefix="/formulas", tags=["formulas"])
app.include_router(gaps.router, prefix="/gaps", tags=["gaps"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ml-service"}


@app.get("/stats")
async def stats():
    vs = app.state.vector_store
    info = await vs.collection_info()
    return {
        "vectors_count": info.get("vectors_count", 0),
        "status": info.get("status", "unknown"),
    }
