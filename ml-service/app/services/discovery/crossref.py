"""CrossRef paper discovery client."""

import httpx

BASE_URL = "https://api.crossref.org/works"


async def search_crossref(query: str, max_results: int = 20) -> list[dict]:
    """Search CrossRef for papers matching the query."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            BASE_URL,
            params={
                "query": query,
                "rows": max_results,
                "sort": "relevance",
                "select": "DOI,title,author,abstract,published-print,URL,subject",
            },
            headers={"User-Agent": "RDResearchEngine/0.1 (research@dhsecheron.com)"},
        )
        response.raise_for_status()
        data = response.json()

    results = []
    for item in data.get("message", {}).get("items", []):
        title = item.get("title", [""])[0] if item.get("title") else ""
        authors = []
        for author in item.get("author", []):
            name = f"{author.get('given', '')} {author.get('family', '')}".strip()
            if name:
                authors.append(name)

        pub_date = item.get("published-print", {}).get("date-parts", [[None]])[0]
        year = pub_date[0] if pub_date else None

        results.append({
            "title": title,
            "authors": authors,
            "abstract": item.get("abstract", ""),
            "doi": item.get("DOI"),
            "url": item.get("URL", ""),
            "source": "crossref",
            "publication_year": year,
            "subjects": item.get("subject", []),
        })

    return results
