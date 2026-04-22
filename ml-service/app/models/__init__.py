from pydantic import BaseModel


class IngestRequest(BaseModel):
    document_id: str
    file_url: str
    mime_type: str
    classification: str = "PUBLIC"
    metadata: dict | None = None


class IngestResponse(BaseModel):
    document_id: str
    chunks_created: int
    vectors_stored: int
    language_detected: str
    status: str


class QueryRequest(BaseModel):
    query: str
    classification_access: str = "PUBLIC"
    top_k: int = 20
    research_areas: list[str] | None = None


class QueryResult(BaseModel):
    content: str
    document_id: str
    document_title: str
    chunk_index: int
    section_header: str | None
    score: float
    classification: str


class QueryResponse(BaseModel):
    query: str
    mode: str  # "ai_synthesis" or "retrieval_only"
    answer: str | None
    results: list[QueryResult]
    total_results: int


class DiscoverRequest(BaseModel):
    query: str
    sources: list[str] = ["arxiv", "semantic_scholar", "crossref"]
    max_results: int = 20


class DiscoverResult(BaseModel):
    title: str
    authors: list[str]
    abstract: str | None
    doi: str | None
    url: str | None
    source: str
    publication_year: int | None


class TranslateRequest(BaseModel):
    text: str
    target_language: str = "en"


class TranslateResponse(BaseModel):
    original_language: str
    translated_text: str


class FormulaRequest(BaseModel):
    query: str
    domain: str | None = None


class GapAnalysisRequest(BaseModel):
    research_areas: list[dict]
    document_counts: dict[str, int]
    total_documents: int
