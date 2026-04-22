"""Research gap analysis engine.

Analyzes the ingested corpus to identify under-researched areas
and suggest topics that need more investigation.
"""


def analyze_coverage(
    research_areas: list[dict],
    document_counts: dict[str, int],
    total_documents: int,
) -> list[dict]:
    """Analyze research coverage across defined areas.

    Args:
        research_areas: List of research area dicts with 'name' and 'keywords'
        document_counts: Dict mapping area name to document count
        total_documents: Total documents in the corpus

    Returns:
        List of coverage analysis results with recommendations
    """
    results = []

    for area in research_areas:
        name = area["name"]
        count = document_counts.get(name, 0)
        coverage = count / total_documents if total_documents > 0 else 0

        if coverage < 0.05:
            status = "CRITICAL_GAP"
            recommendation = f"Very few documents cover {name}. Prioritize literature search in this area."
        elif coverage < 0.15:
            status = "NEEDS_ATTENTION"
            recommendation = f"Limited coverage of {name}. Consider expanding the document collection."
        elif coverage < 0.30:
            status = "MODERATE"
            recommendation = f"Moderate coverage of {name}. Review for specific sub-topic gaps."
        else:
            status = "WELL_COVERED"
            recommendation = f"Good coverage of {name}. Focus on staying current with new publications."

        results.append({
            "research_area": name,
            "document_count": count,
            "coverage_percentage": round(coverage * 100, 1),
            "status": status,
            "recommendation": recommendation,
            "keywords": area.get("keywords", []),
        })

    # Sort by coverage (least covered first)
    results.sort(key=lambda x: x["coverage_percentage"])
    return results


def identify_missing_topics(
    research_areas: list[dict],
    existing_keywords: set[str],
) -> list[dict]:
    """Identify keywords/topics from research areas that have no matching documents."""
    missing = []
    for area in research_areas:
        for keyword in area.get("keywords", []):
            if keyword.lower() not in existing_keywords:
                missing.append({
                    "research_area": area["name"],
                    "missing_keyword": keyword,
                    "suggestion": f"Search for papers on '{keyword}' in {area['name']}",
                })
    return missing
