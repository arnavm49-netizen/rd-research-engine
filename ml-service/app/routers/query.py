"""RAG query router — search, sensitivity check, optional AI synthesis."""

from fastapi import APIRouter, Request

from app.models import QueryRequest, QueryResponse, QueryResult
from app.services.sensitivity_gate import check_sensitivity, get_highest_classification
from app.services.claude_client import generate_synthesis

router = APIRouter()


@router.post("", response_model=QueryResponse)
async def query_documents(req: QueryRequest, request: Request):
    """RAG query with sensitivity-aware response mode.

    - If all retrieved docs are PUBLIC → AI synthesis via Claude API
    - If any retrieved doc is INTERNAL+ → retrieval-only (raw chunks)
    """
    embedding_service = request.app.state.embedding_service
    vector_store = request.app.state.vector_store

    # Step 1: Embed the query locally
    query_vector = embedding_service.embed_query(req.query)

    # Step 2: Search Qdrant with classification filtering
    raw_results = vector_store.search(
        query_vector=query_vector,
        top_k=req.top_k,
        classification_access=req.classification_access,
        research_areas=req.research_areas,
    )

    if not raw_results:
        return QueryResponse(
            query=req.query,
            mode="retrieval_only",
            answer="No matching documents found. Try broadening your search or uploading relevant documents.",
            results=[],
            total_results=0,
        )

    # Step 3: Check sensitivity gate
    mode = check_sensitivity(raw_results)
    classification = get_highest_classification(raw_results)

    # Step 4: Build results
    results = [
        QueryResult(
            content=r["payload"].get("content", ""),
            document_id=r["payload"].get("document_id", ""),
            document_title=r["payload"].get("document_title", "Unknown"),
            chunk_index=r["payload"].get("chunk_index", 0),
            section_header=r["payload"].get("section_header"),
            score=r["score"],
            classification=r["payload"].get("classification", "PUBLIC"),
        )
        for r in raw_results
    ]

    # Step 5: Generate answer
    answer = None
    if mode == "ai_synthesis":
        # All results are PUBLIC — safe to send to Claude
        top_chunks = raw_results[:8]  # Top 8 for context
        answer = generate_synthesis(req.query, top_chunks)
    else:
        # Retrieval-only mode — return chunks without AI synthesis
        answer = (
            f"[Retrieval-only mode — results contain {classification} data. "
            f"Showing {len(results)} relevant excerpts without AI synthesis.]"
        )

    return QueryResponse(
        query=req.query,
        mode=mode,
        answer=answer,
        results=results[:10],  # Return top 10
        total_results=len(results),
    )
