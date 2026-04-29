const ML_SERVICE_URL = process.env.ML_SERVICE_URL ?? "http://localhost:8000";

interface IngestRequest {
  document_id: string;
  file_url: string;
  mime_type: string;
  classification: string;
  metadata?: Record<string, unknown>;
}

interface IngestResponse {
  document_id: string;
  chunks_created: number;
  vectors_stored: number;
  language_detected: string;
  status: string;
}

interface QueryRequest {
  query: string;
  classification_access: string;
  top_k?: number;
  research_areas?: string[];
}

interface QueryResult {
  content: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  section_header: string | null;
  score: number;
  classification: string;
}

interface QueryResponse {
  query: string;
  mode: "ai_synthesis" | "retrieval_only";
  answer: string | null;
  results: QueryResult[];
  total_results: number;
}

async function mlFetch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${ML_SERVICE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ML Service error (${response.status}): ${error}`);
  }
  return response.json() as T;
}

export async function ingestDocument(data: IngestRequest): Promise<IngestResponse> {
  return mlFetch<IngestResponse>("/ingest", data);
}

export async function queryDocuments(data: QueryRequest): Promise<QueryResponse> {
  return mlFetch<QueryResponse>("/query", data);
}

export async function getCollectionStats(): Promise<{ vectors_count: number; documents_count: number }> {
  const response = await fetch(`${ML_SERVICE_URL}/stats`);
  if (!response.ok) throw new Error("Failed to fetch collection stats");
  return response.json();
}
