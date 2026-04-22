"""Gap analysis router."""

from fastapi import APIRouter
from app.models import GapAnalysisRequest
from app.services.gap_analyzer import analyze_coverage, identify_missing_topics

router = APIRouter()


@router.post("/coverage")
async def coverage_analysis(req: GapAnalysisRequest):
    """Analyze research coverage across defined areas."""
    coverage = analyze_coverage(
        research_areas=req.research_areas,
        document_counts=req.document_counts,
        total_documents=req.total_documents,
    )
    return {"coverage": coverage}


@router.post("/missing")
async def missing_topics(data: dict):
    """Identify missing topics from research areas."""
    research_areas = data.get("research_areas", [])
    existing_keywords = set(data.get("existing_keywords", []))
    missing = identify_missing_topics(research_areas, existing_keywords)
    return {"missing_topics": missing, "count": len(missing)}
