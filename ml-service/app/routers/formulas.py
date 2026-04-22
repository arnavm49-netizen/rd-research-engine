"""Formula suggestion and test recommendation router."""

from fastapi import APIRouter
from app.models import FormulaRequest
from app.services.formula_engine import suggest_formulas, suggest_tests, extract_formulas_from_text

router = APIRouter()


@router.post("/suggest")
async def suggest(req: FormulaRequest):
    """Suggest relevant formulas based on query and domain."""
    formulas = suggest_formulas(req.query, req.domain)
    return {"query": req.query, "domain": req.domain, "formulas": formulas}


@router.post("/tests")
async def tests(req: FormulaRequest):
    """Suggest test methods for a given domain."""
    domain = req.domain or "materials"
    test_methods = suggest_tests(domain, req.query)
    return {"domain": domain, "tests": test_methods}


@router.post("/extract")
async def extract(data: dict):
    """Extract formulas from provided text."""
    text = data.get("text", "")
    formulas = extract_formulas_from_text(text)
    return {"formulas_found": len(formulas), "formulas": formulas}
