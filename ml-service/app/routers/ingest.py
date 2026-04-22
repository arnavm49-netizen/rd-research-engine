"""Ingestion router — extracts, chunks, embeds, and stores documents."""

from fastapi import APIRouter, Request, HTTPException
import httpx

from app.models import IngestRequest, IngestResponse
from app.services.extraction import extract_document
from app.services.chunking import chunk_text, chunk_tables
from app.services.translation import detect_language, needs_translation
from app.services.claude_client import translate_text

router = APIRouter()


@router.post("", response_model=IngestResponse)
async def ingest_document(req: IngestRequest, request: Request):
    """Full ingestion pipeline: download → extract → chunk → embed → store."""
    embedding_service = request.app.state.embedding_service
    vector_store = request.app.state.vector_store

    # Step 1: Download file from MinIO/S3
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.get(req.file_url)
        if resp.status_code != 200:
            raise HTTPException(status_code=400, detail=f"Failed to download file: {resp.status_code}")
        file_bytes = resp.content

    # Step 2: Extract text, tables, and images
    extraction = extract_document(file_bytes, req.mime_type)

    if not extraction.text.strip():
        return IngestResponse(
            document_id=req.document_id,
            chunks_created=0,
            vectors_stored=0,
            language_detected="unknown",
            status="no_text_extracted",
        )

    # Step 3: Detect language and translate if needed
    language = detect_language(extraction.text)
    text_to_chunk = extraction.text

    if needs_translation(language) and req.classification == "PUBLIC":
        # Only translate PUBLIC docs via Claude API
        text_to_chunk = translate_text(extraction.text[:15000])  # Limit for API cost

    # Step 4: Chunk the text
    text_chunks = chunk_text(text_to_chunk)
    table_chunks = chunk_tables(extraction.tables)

    # Merge and reindex
    all_chunks = text_chunks + table_chunks
    for i, chunk in enumerate(all_chunks):
        chunk["chunk_index"] = i

    if not all_chunks:
        return IngestResponse(
            document_id=req.document_id,
            chunks_created=0,
            vectors_stored=0,
            language_detected=language,
            status="no_chunks_created",
        )

    # Step 5: Generate embeddings locally
    texts = [c["content"] for c in all_chunks]
    embeddings = embedding_service.embed_texts(texts)

    # Step 6: Store in Qdrant with metadata
    payloads = [
        {
            "document_id": req.document_id,
            "document_title": (req.metadata or {}).get("title", "Untitled"),
            "chunk_index": c["chunk_index"],
            "content": c["content"],
            "section_header": c["section_header"],
            "classification": req.classification,
            "language": language,
            "research_areas": (req.metadata or {}).get("research_areas", []),
        }
        for c in all_chunks
    ]

    point_ids = vector_store.store_vectors(embeddings, payloads)

    return IngestResponse(
        document_id=req.document_id,
        chunks_created=len(all_chunks),
        vectors_stored=len(point_ids),
        language_detected=language,
        status="success",
    )
