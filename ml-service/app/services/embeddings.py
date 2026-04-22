import os
from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
CACHE_DIR = os.environ.get("MODEL_CACHE_DIR", "./model-cache")
EMBEDDING_DIM = 384


class EmbeddingService:
    """Local embedding service using sentence-transformers.
    All data stays on-host — nothing is sent to external APIs.
    """

    def __init__(self):
        self.model = SentenceTransformer(MODEL_NAME, cache_folder=CACHE_DIR)
        self.dimension = EMBEDDING_DIM

    def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for a list of texts."""
        embeddings = self.model.encode(texts, show_progress_bar=False, normalize_embeddings=True)
        return embeddings.tolist()

    def embed_query(self, query: str) -> list[float]:
        """Generate embedding for a single query."""
        embedding = self.model.encode(query, normalize_embeddings=True)
        return embedding.tolist()
