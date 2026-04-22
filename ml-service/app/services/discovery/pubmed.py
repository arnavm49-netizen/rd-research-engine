"""PubMed paper discovery client (via NCBI E-utilities)."""

import httpx
import xml.etree.ElementTree as ET

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
EFETCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"


async def search_pubmed(query: str, max_results: int = 20) -> list[dict]:
    """Search PubMed for papers matching the query."""
    async with httpx.AsyncClient(timeout=30) as client:
        # Step 1: Search for IDs
        search_resp = await client.get(
            ESEARCH_URL,
            params={
                "db": "pubmed",
                "term": query,
                "retmax": max_results,
                "retmode": "json",
                "sort": "relevance",
            },
        )
        search_resp.raise_for_status()
        ids = search_resp.json().get("esearchresult", {}).get("idlist", [])

        if not ids:
            return []

        # Step 2: Fetch details
        fetch_resp = await client.get(
            EFETCH_URL,
            params={
                "db": "pubmed",
                "id": ",".join(ids),
                "rettype": "xml",
                "retmode": "xml",
            },
        )
        fetch_resp.raise_for_status()

    root = ET.fromstring(fetch_resp.text)
    results = []

    for article in root.findall(".//PubmedArticle"):
        medline = article.find(".//MedlineCitation")
        if medline is None:
            continue

        art = medline.find(".//Article")
        if art is None:
            continue

        title_el = art.find(".//ArticleTitle")
        title = title_el.text if title_el is not None else ""

        abstract_el = art.find(".//Abstract/AbstractText")
        abstract = abstract_el.text if abstract_el is not None else ""

        authors = []
        for author in art.findall(".//AuthorList/Author"):
            last = author.findtext("LastName", "")
            first = author.findtext("ForeName", "")
            if last:
                authors.append(f"{first} {last}".strip())

        year_el = art.find(".//Journal/JournalIssue/PubDate/Year")
        year = int(year_el.text) if year_el is not None and year_el.text else None

        doi = None
        for eid in article.findall(".//PubmedData/ArticleIdList/ArticleId"):
            if eid.get("IdType") == "doi":
                doi = eid.text
                break

        pmid = medline.findtext("PMID", "")

        results.append({
            "title": title,
            "authors": authors,
            "abstract": abstract,
            "doi": doi,
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/" if pmid else "",
            "source": "pubmed",
            "publication_year": year,
        })

    return results
