"""Paper discovery router — searches academic databases."""

from fastapi import APIRouter
from app.models import DiscoverRequest, DiscoverResult
from app.services.discovery.arxiv import search_arxiv
from app.services.discovery.semantic_scholar import search_semantic_scholar
from app.services.discovery.crossref import search_crossref
from app.services.discovery.pubmed import search_pubmed

router = APIRouter()


@router.post("", response_model=list[DiscoverResult])
async def discover_papers(req: DiscoverRequest):
    """Search multiple academic sources for papers."""
    all_results = []

    for source in req.sources:
        try:
            if source == "arxiv":
                papers = search_arxiv(req.query, req.max_results)
            elif source == "semantic_scholar":
                papers = await search_semantic_scholar(req.query, req.max_results)
            elif source == "crossref":
                papers = await search_crossref(req.query, req.max_results)
            elif source == "pubmed":
                papers = await search_pubmed(req.query, req.max_results)
            else:
                continue

            all_results.extend(papers)
        except Exception as e:
            print(f"Discovery error from {source}: {e}")
            continue

    # Deduplicate by DOI
    seen_dois = set()
    unique_results = []
    for paper in all_results:
        doi = paper.get("doi")
        if doi and doi in seen_dois:
            continue
        if doi:
            seen_dois.add(doi)
        unique_results.append(
            DiscoverResult(
                title=paper.get("title", ""),
                authors=paper.get("authors", []),
                abstract=paper.get("abstract"),
                doi=paper.get("doi"),
                url=paper.get("url"),
                source=paper.get("source", "unknown"),
                publication_year=paper.get("publication_year"),
            )
        )

    return unique_results
