"""Text chunking service with section-aware splitting."""

from langchain_text_splitters import RecursiveCharacterTextSplitter
import re

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP) -> list[dict]:
    """Split text into chunks, preserving section headers.

    Returns list of dicts with 'content', 'chunk_index', and 'section_header'.
    """
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len,
    )

    chunks = splitter.split_text(text)

    results = []
    current_header = None

    for i, chunk in enumerate(chunks):
        # Detect section headers (markdown-style or all-caps lines)
        header_match = re.search(r"^(#{1,4}\s+.+|[A-Z][A-Z\s]{5,}(?:\n|$))", chunk, re.MULTILINE)
        if header_match:
            current_header = header_match.group(0).strip().lstrip("#").strip()

        results.append({
            "content": chunk,
            "chunk_index": i,
            "section_header": current_header,
        })

    return results


def chunk_tables(tables: list[list[list[str]]]) -> list[dict]:
    """Convert extracted tables into text chunks."""
    chunks = []
    for table_idx, table in enumerate(tables):
        if not table or len(table) < 2:
            continue

        # Convert table to markdown-style text
        headers = table[0] if table[0] else []
        rows_text = []
        for row in table[1:]:
            row_items = [f"{headers[j]}: {cell}" if j < len(headers) else cell
                        for j, cell in enumerate(row) if cell]
            if row_items:
                rows_text.append(" | ".join(row_items))

        if rows_text:
            table_text = f"[Table {table_idx + 1}]\n" + "\n".join(rows_text)
            chunks.append({
                "content": table_text[:CHUNK_SIZE],
                "chunk_index": -1,  # Will be reindexed
                "section_header": f"Table {table_idx + 1}",
            })

    return chunks
