"""Language detection and translation service."""

from langdetect import detect, DetectorFactory

# Make detection deterministic
DetectorFactory.seed = 0


def detect_language(text: str) -> str:
    """Detect the language of a text."""
    try:
        # Use first 5000 chars for detection (faster, accurate enough)
        sample = text[:5000]
        return detect(sample)
    except Exception:
        return "en"


def needs_translation(language: str) -> bool:
    """Check if a document needs translation to English."""
    return language != "en"
