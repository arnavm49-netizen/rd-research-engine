"""Translation router."""

from fastapi import APIRouter
from app.models import TranslateRequest, TranslateResponse
from app.services.translation import detect_language
from app.services.claude_client import translate_text

router = APIRouter()


@router.post("", response_model=TranslateResponse)
async def translate(req: TranslateRequest):
    """Detect language and translate to target language."""
    original_language = detect_language(req.text)

    if original_language == req.target_language:
        return TranslateResponse(
            original_language=original_language,
            translated_text=req.text,
        )

    translated = translate_text(req.text, req.target_language)

    return TranslateResponse(
        original_language=original_language,
        translated_text=translated,
    )
