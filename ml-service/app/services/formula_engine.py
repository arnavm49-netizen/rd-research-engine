"""Formula extraction and suggestion engine.

Extracts mathematical formulas from text and suggests relevant
formulas and test methods based on research context.
"""

import re

# Common engineering formula patterns
FORMULA_PATTERNS = [
    # Standard equation format: X = Y
    r"([A-Za-z_]\w*)\s*=\s*([^,\n]{5,80})",
    # With units: X = Y [unit]
    r"([A-Za-z_]\w*)\s*=\s*([^,\n]+)\s*\[([^\]]+)\]",
    # Greek letters commonly used
    r"(σ|ε|τ|δ|Δ|γ|μ|ρ|λ)\s*=\s*([^,\n]{5,80})",
]

# Domain-specific formula database (seed data)
ENGINEERING_FORMULAS = {
    "welding": [
        {
            "name": "Heat Input",
            "expression": "HI = (V × I × 60) / (S × 1000)",
            "variables": {"V": "Voltage (V)", "I": "Current (A)", "S": "Travel speed (mm/min)"},
            "domain": "welding",
            "standard": "AWS A3.0",
            "description": "Calculates heat input per unit length of weld",
        },
        {
            "name": "Dilution Ratio",
            "expression": "D = Ab / (Ab + Ar) × 100",
            "variables": {"Ab": "Base metal area melted", "Ar": "Reinforcement area"},
            "domain": "welding",
            "description": "Percentage of base metal in the weld deposit",
        },
        {
            "name": "Deposition Rate",
            "expression": "DR = (Wf - Wi) / t",
            "variables": {"Wf": "Final weight (kg)", "Wi": "Initial weight (kg)", "t": "Time (hours)"},
            "domain": "welding",
            "description": "Rate of weld metal deposition",
        },
        {
            "name": "Carbon Equivalent (IIW)",
            "expression": "CE = C + Mn/6 + (Cr+Mo+V)/5 + (Ni+Cu)/15",
            "variables": {"C": "Carbon %", "Mn": "Manganese %", "Cr": "Chromium %", "Mo": "Molybdenum %", "V": "Vanadium %", "Ni": "Nickel %", "Cu": "Copper %"},
            "domain": "welding",
            "standard": "IIW",
            "description": "Weldability indicator — CE > 0.45 requires preheat",
        },
    ],
    "materials": [
        {
            "name": "Hall-Petch Equation",
            "expression": "σy = σ0 + k / √d",
            "variables": {"σy": "Yield stress", "σ0": "Friction stress", "k": "Hall-Petch coefficient", "d": "Grain diameter"},
            "domain": "materials",
            "description": "Relates grain size to yield strength",
        },
        {
            "name": "Hardness Conversion (HRC to HV)",
            "expression": "HV ≈ 20 × HRC + 200 (approximate for HRC 20-60)",
            "variables": {"HRC": "Rockwell C hardness", "HV": "Vickers hardness"},
            "domain": "materials",
            "description": "Approximate conversion between hardness scales",
        },
    ],
    "wear": [
        {
            "name": "Archard Wear Equation",
            "expression": "V = K × F × L / H",
            "variables": {"V": "Wear volume", "K": "Wear coefficient", "F": "Normal load", "L": "Sliding distance", "H": "Hardness"},
            "domain": "wear",
            "description": "Predicts sliding wear volume",
        },
    ],
    "electrical": [
        {
            "name": "Transformer Turns Ratio",
            "expression": "V1/V2 = N1/N2",
            "variables": {"V1": "Primary voltage", "V2": "Secondary voltage", "N1": "Primary turns", "N2": "Secondary turns"},
            "domain": "electrical",
            "description": "Relates voltage to number of turns in a transformer",
        },
    ],
}


def extract_formulas_from_text(text: str) -> list[dict]:
    """Extract potential formulas from document text."""
    formulas = []
    seen = set()

    for pattern in FORMULA_PATTERNS:
        matches = re.finditer(pattern, text)
        for match in matches:
            formula_text = match.group(0).strip()
            if formula_text not in seen and len(formula_text) > 5:
                seen.add(formula_text)
                formulas.append({
                    "expression": formula_text,
                    "context": text[max(0, match.start() - 100):match.end() + 100],
                })

    return formulas


def suggest_formulas(query: str, domain: str | None = None) -> list[dict]:
    """Suggest relevant formulas based on a query and domain."""
    query_lower = query.lower()
    suggestions = []

    domains_to_search = [domain] if domain else ENGINEERING_FORMULAS.keys()

    for d in domains_to_search:
        for formula in ENGINEERING_FORMULAS.get(d, []):
            # Simple keyword matching — can be upgraded to semantic search
            name_match = formula["name"].lower() in query_lower
            desc_match = any(word in query_lower for word in formula["description"].lower().split())
            var_match = any(v.lower() in query_lower for v in formula["variables"].values())

            if name_match or desc_match or var_match:
                suggestions.append(formula)

    return suggestions


def suggest_tests(domain: str, context: str = "") -> list[dict]:
    """Suggest test methods based on domain and context."""
    test_database = {
        "welding": [
            {"methodology": "Macro examination of weld cross-section", "standard": "AWS D1.1", "parameters": {"magnification": "5-10x", "etchant": "Nital 5%"}},
            {"methodology": "Charpy V-notch impact test", "standard": "ASTM E23", "parameters": {"temperature": "-40°C to +20°C", "specimen": "10x10x55mm"}},
            {"methodology": "All-weld-metal tensile test", "standard": "AWS B4.0", "parameters": {"gauge_length": "50mm", "strain_rate": "0.005/min"}},
            {"methodology": "Bend test (face and root)", "standard": "AWS D1.1 Clause 6.10", "parameters": {"bend_radius": "4t", "angle": "180°"}},
            {"methodology": "Ferrite Number measurement", "standard": "AWS A4.2", "parameters": {"instrument": "Fischer Feritscope", "calibration": "TWI standards"}},
        ],
        "wear": [
            {"methodology": "Pin-on-disc wear test", "standard": "ASTM G99", "parameters": {"load": "10-50N", "speed": "0.5-2 m/s", "distance": "1000m"}},
            {"methodology": "Abrasion resistance test (ASTM G65)", "standard": "ASTM G65", "parameters": {"sand": "AFS 50/70", "load": "130N", "revolutions": "6000"}},
            {"methodology": "Erosion test", "standard": "ASTM G76", "parameters": {"erodent": "Al2O3 50μm", "velocity": "70 m/s", "angle": "30° and 90°"}},
        ],
        "materials": [
            {"methodology": "Optical microscopy", "standard": "ASTM E3", "parameters": {"magnification": "100-1000x", "etchant": "domain-specific"}},
            {"methodology": "SEM/EDS analysis", "standard": "ASTM E1508", "parameters": {"voltage": "15-20kV", "coating": "carbon or gold"}},
            {"methodology": "XRD phase analysis", "standard": "ASTM E975", "parameters": {"radiation": "Cu Kα", "2θ range": "20-100°"}},
            {"methodology": "Vickers microhardness", "standard": "ASTM E384", "parameters": {"load": "100-500g", "dwell_time": "15s"}},
        ],
        "electrical": [
            {"methodology": "Insulation resistance test", "standard": "IEC 60085", "parameters": {"voltage": "500V DC", "duration": "60s"}},
            {"methodology": "Dielectric strength test", "standard": "IEC 60243", "parameters": {"ramp_rate": "500 V/s"}},
        ],
    }

    return test_database.get(domain, test_database.get("materials", []))
