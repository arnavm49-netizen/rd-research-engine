"""Sensitivity gate — determines whether to use AI synthesis or retrieval-only mode.

Rule: If ANY retrieved chunk is classified above PUBLIC, the entire response
must be retrieval-only (no data sent to Claude API).
"""

CLASSIFICATION_HIERARCHY = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]


def check_sensitivity(results: list[dict]) -> str:
    """Check if any result contains non-public data.

    Returns:
        "ai_synthesis" if all results are PUBLIC
        "retrieval_only" if any result is INTERNAL or higher
    """
    for result in results:
        classification = result.get("payload", {}).get("classification", "PUBLIC")
        if classification != "PUBLIC":
            return "retrieval_only"
    return "ai_synthesis"


def get_highest_classification(results: list[dict]) -> str:
    """Get the highest classification level among results."""
    highest_idx = 0
    for result in results:
        classification = result.get("payload", {}).get("classification", "PUBLIC")
        try:
            idx = CLASSIFICATION_HIERARCHY.index(classification)
            highest_idx = max(highest_idx, idx)
        except ValueError:
            pass
    return CLASSIFICATION_HIERARCHY[highest_idx]


def filter_public_results(results: list[dict]) -> list[dict]:
    """Return only PUBLIC results (safe to send to Claude API)."""
    return [r for r in results if r.get("payload", {}).get("classification", "PUBLIC") == "PUBLIC"]
