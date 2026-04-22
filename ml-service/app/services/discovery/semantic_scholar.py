"""Semantic Scholar paper discovery client."""

import httpx

BASE_URL = "https://api.semanticscholar.org/graph/v1"
FIELDS = "title,authors,abstract,externalIds,year,url,citationCount,fieldsOfStudy"


async def search_semantic_scholar(query: str, max_results: int = 20) -> list[dict]:
    """Search Semantic Scholar for papers matching the query."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            f"{BASE_URL}/paper/search",
            params={
                "query": query,
                "limit": max_results,
                "fields": FIELDS,
            },
        )
        response.raise_for_status()
        data = response.json()

    results = []
    for paper in data.get("data", []):
        doi = None
        external_ids = paper.get("externalIds", {})
        if external_ids:
            doi = external_ids.get("DOI")

        results.append({
            "title": paper.get("title", ""),
            "authors": [a.get("name", "") for a in paper.get("authors", [])],
            "abstract": paper.get("abstract", ""),
            "doi": doi,
            "url": paper.get("url", ""),
            "source": "semantic_scholar",
            "publication_year": paper.get("year"),
            "citation_count": paper.get("citationCount", 0),
            "fields_of_study": paper.get("fieldsOfStudy", []),
        })

    return results
