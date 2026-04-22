"""Claude API client for AI synthesis on PUBLIC data only."""

import os
from anthropic import Anthropic

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """You are an R&D research assistant for an engineering company.
Your expertise spans metallurgy, welding technology, electrical engineering,
manufacturing processes, and quality control.

When answering questions:
1. Base your answer ONLY on the provided context documents
2. Cite sources using [Doc N] notation
3. If the context doesn't contain enough information, say so clearly
4. Highlight any formulas, standards, or test methods mentioned
5. Flag areas where more research might be needed

Be precise, technical, and actionable."""


def generate_synthesis(
    query: str,
    context_chunks: list[dict],
) -> str:
    """Generate an AI-synthesized answer from public research context.

    IMPORTANT: Only call this with PUBLIC-classified data.
    The sensitivity gate must verify this before calling.
    """
    if not ANTHROPIC_API_KEY:
        return "[AI synthesis unavailable — ANTHROPIC_API_KEY not configured]"

    client = Anthropic(api_key=ANTHROPIC_API_KEY)

    # Build context from chunks
    context_parts = []
    for i, chunk in enumerate(context_chunks):
        payload = chunk.get("payload", {})
        title = payload.get("document_title", "Unknown")
        section = payload.get("section_header", "")
        content = payload.get("content", "")
        header = f"[Doc {i + 1}] {title}"
        if section:
            header += f" — {section}"
        context_parts.append(f"{header}\n{content}")

    context_text = "\n\n---\n\n".join(context_parts)

    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": f"Based on the following research documents, answer this question:\n\n"
                f"**Question:** {query}\n\n"
                f"**Research Context:**\n\n{context_text}",
            }
        ],
    )

    return message.content[0].text


def translate_text(text: str, target_language: str = "en") -> str:
    """Translate text to the target language using Claude."""
    if not ANTHROPIC_API_KEY:
        return text

    client = Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4000,
        messages=[
            {
                "role": "user",
                "content": f"Translate the following text to {target_language}. "
                f"Preserve all technical terminology, formulas, and formatting. "
                f"Only output the translation, nothing else.\n\n{text}",
            }
        ],
    )
    return message.content[0].text
