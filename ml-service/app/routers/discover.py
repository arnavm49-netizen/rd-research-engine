"""Paper discovery router.

Searches multiple academic databases, deduplicates, then re-ranks by semantic
similarity to the user's query (using the same local embedding model that
powers RAG retrieval). This gives much better relevance than the raw merged
order returned by individual APIs.
"""

from fastapi import APIRouter, Request
from app.models import DiscoverRequest, DiscoverResult
from app.services.discovery.arxiv import search_arxiv
from app.services.discovery.semantic_scholar import search_semantic_scholar
from app.services.discovery.crossref import search_crossref
from app.services.discovery.pubmed import search_pubmed
from app.services.discovery.ranking import rank_papers

router = APIRouter()

# Each source returns this many raw candidates. We pull more than we need
# so the ranker has a meaningful pool to choose from across sources.
PER_SOURCE_CANDIDATE_POOL = 30


@router.post("", response_model=list[DiscoverResult])
async def discover_papers(req: DiscoverRequest, request: Request):
    """Search → deduplicate → semantically re-rank → return top N."""
    embedding_service = request.app.state.embedding_service

    all_results = []
    # Pull a wider net per source so the ranker can pick winners across them
    pool_per_source = max(req.max_results, PER_SOURCE_CANDIDATE_POOL)

    for source in req.sources:
        try:
            if source == "arxiv":
                papers = search_arxiv(req.query, pool_per_source)
            elif source == "semantic_scholar":
                papers = await search_semantic_scholar(req.query, pool_per_source)
            elif source == "crossref":
                papers = await search_crossref(req.query, pool_per_source)
            elif source == "pubmed":
                papers = await search_pubmed(req.query, pool_per_source)
            else:
                continue
            all_results.extend(papers)
        except Exception as e:
            print(f"Discovery error from {source}: {e}")
            continue

    # Dedupe by DOI first, then by normalized title (some sources return
    # the same paper without a DOI under slightly different metadata)
    seen_dois = set()
    seen_titles = set()
    unique = []
    for paper in all_results:
        doi = paper.get("doi")
        title_key = (paper.get("title") or "").strip().lower()[:120]

        if doi and doi in seen_dois:
            continue
        if not doi and title_key and title_key in seen_titles:
            continue

        if doi:
            seen_dois.add(doi)
        if title_key:
            seen_titles.add(title_key)
        unique.append(paper)

    # Semantic re-rank using local embeddings
    ranked = rank_papers(
        papers=unique,
        query=req.query,
        embedding_service=embedding_service,
        top_k=req.max_results,
    )

    return [
        DiscoverResult(
            title=p.get("title", ""),
            authors=p.get("authors", []),
            abstract=p.get("abstract"),
            doi=p.get("doi"),
            url=p.get("url"),
            source=p.get("source", "unknown"),
            publication_year=p.get("publication_year"),
        )
        for p in ranked
    ]
