"""arXiv paper discovery client."""

import arxiv


def search_arxiv(query: str, max_results: int = 20) -> list[dict]:
    """Search arXiv for papers matching the query."""
    client = arxiv.Client()
    search = arxiv.Search(
        query=query,
        max_results=max_results,
        sort_by=arxiv.SortCriterion.Relevance,
    )

    results = []
    for paper in client.results(search):
        results.append({
            "title": paper.title,
            "authors": [a.name for a in paper.authors],
            "abstract": paper.summary,
            "doi": paper.doi,
            "url": paper.entry_id,
            "source": "arxiv",
            "publication_year": paper.published.year if paper.published else None,
            "categories": paper.categories,
        })

    return results
