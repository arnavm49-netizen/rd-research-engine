"""Cross-source paper relevance ranking.

After we collect raw results from arXiv / Semantic Scholar / CrossRef / PubMed,
we re-rank them so the most relevant papers appear first regardless of which
source returned them.

Pipeline:
1. Quality filter — drop papers with no abstract or trivially short abstract,
   they're noise (often duplicates, retractions, or stub records).
2. Domain bias — boost papers whose abstract mentions engineering / metallurgy /
   manufacturing terms. Demote papers in unrelated fields (medicine, biology,
   social sciences) when those words don't appear in the user's query.
3. Semantic similarity — embed the user's query and each paper's
   "title + abstract" with the same local sentence-transformer used for
   document chunks. Cosine similarity between query and paper.
4. Citation-count tiebreaker — when two papers have similar semantic scores,
   prefer the one with more citations.

Returns papers sorted by final score, descending.
"""

import re

# Boost terms — papers mentioning these get a small uplift
ENGINEERING_TERMS = {
    "weld", "welding", "metallurgy", "metallurgical", "alloy", "steel",
    "electrode", "hardfacing", "wear", "abrasion", "corrosion", "fatigue",
    "fracture", "tensile", "yield strength", "microstructure", "phase",
    "deposition", "additive manufacturing", "waam", "3d printing",
    "manufacturing", "fabrication", "machining", "casting", "forging",
    "extrusion", "drawing", "rolling", "heat treatment", "tempering",
    "annealing", "quenching", "carbide", "nitride", "ceramic", "composite",
    "transformer", "switchgear", "insulation", "dielectric", "circuit breaker",
    "power system", "grid", "substation", "engineering", "industrial",
    "mechanical", "electrical", "materials science", "process",
}

# Demote terms — when these dominate the abstract AND aren't in the user query,
# the paper is probably from an unrelated field (medical, bio, social).
OFF_DOMAIN_TERMS = {
    "patient", "clinical", "tumor", "cancer", "diabetes", "pregnancy",
    "neuron", "brain", "cognitive", "psychology", "behavioral",
    "society", "policy", "economy", "market trend", "consumer",
    "ecology", "ecosystem", "biodiversity", "agriculture", "farming",
    "wildlife", "habitat", "climate change", "carbon emission",
}

MIN_ABSTRACT_LEN = 100  # characters — below this is usually noise


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _has_quality_abstract(paper: dict) -> bool:
    abstract = paper.get("abstract") or ""
    return len(abstract) >= MIN_ABSTRACT_LEN


def _domain_score(paper: dict, query_lower: str) -> float:
    """+1 for each engineering term present, -2 for each off-domain term
    that's NOT also in the user's query."""
    text = _normalize(f"{paper.get('title', '')} {paper.get('abstract', '')}")
    if not text:
        return 0.0

    boost = sum(1 for term in ENGINEERING_TERMS if term in text)

    demote = 0
    for term in OFF_DOMAIN_TERMS:
        if term in text and term not in query_lower:
            demote += 1

    # Cap to keep semantic similarity dominant
    boost = min(boost, 5)
    demote = min(demote, 5)

    return boost - 2 * demote


def _citation_score(paper: dict) -> float:
    """Log-scaled citation count, used as a small tiebreaker."""
    cites = paper.get("citation_count") or 0
    if cites <= 0:
        return 0.0
    # log10(1+cites) — 10 cites → 1.0, 1k cites → 3.0, 100k cites → 5.0
    import math
    return math.log10(1 + cites)


def rank_papers(
    papers: list[dict],
    query: str,
    embedding_service,
    top_k: int = 20,
) -> list[dict]:
    """Rank papers by combined semantic + domain + citation score.

    Args:
        papers: raw merged results from all discovery sources
        query: the user's search query
        embedding_service: EmbeddingService instance (loaded at startup)
        top_k: how many to return after ranking

    Returns:
        Sorted list of papers (best first) with a 'relevance_score' field added.
    """
    if not papers:
        return []

    # Step 1: quality filter
    filtered = [p for p in papers if _has_quality_abstract(p)]
    if not filtered:
        # Nothing passes the abstract length test — fall back to raw list
        # so the user still sees something rather than an empty page.
        filtered = papers

    # Step 2: embed the query once
    query_vec = embedding_service.embed_query(query)
    query_lower = _normalize(query)

    # Step 3: embed each paper's title + abstract in one batch (much faster)
    paper_texts = [
        f"{p.get('title', '')}\n\n{p.get('abstract', '')}"
        for p in filtered
    ]
    paper_vecs = embedding_service.embed_texts(paper_texts)

    # Step 4: combine scores
    import math

    def cosine(a, b):
        # vectors are already L2-normalized by the embedding service
        return sum(x * y for x, y in zip(a, b))

    scored = []
    for paper, vec in zip(filtered, paper_vecs):
        sem = cosine(query_vec, vec)  # range roughly [-1, 1], usually [0, 0.8]
        domain = _domain_score(paper, query_lower) * 0.05  # ~[-0.5, 0.25]
        cite = _citation_score(paper) * 0.02  # ~[0, 0.1]
        final = sem + domain + cite

        ranked_paper = dict(paper)
        ranked_paper["relevance_score"] = round(final, 4)
        ranked_paper["semantic_score"] = round(sem, 4)
        scored.append(ranked_paper)

    # Step 5: sort high → low and trim
    scored.sort(key=lambda p: p["relevance_score"], reverse=True)
    return scored[:top_k]
