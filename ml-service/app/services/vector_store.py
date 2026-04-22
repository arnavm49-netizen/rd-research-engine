"""Qdrant vector store service."""

import os
import uuid
from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    VectorParams,
    PointStruct,
    Filter,
    FieldCondition,
    MatchValue,
    MatchAny,
)

QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
COLLECTION_NAME = os.environ.get("QDRANT_COLLECTION", "research_documents")
EMBEDDING_DIM = 384


class VectorStoreService:
    def __init__(self):
        self.client = QdrantClient(url=QDRANT_URL)
        self.collection = COLLECTION_NAME

    async def ensure_collection(self):
        """Create collection if it doesn't exist."""
        collections = self.client.get_collections().collections
        exists = any(c.name == self.collection for c in collections)
        if not exists:
            self.client.create_collection(
                collection_name=self.collection,
                vectors_config=VectorParams(
                    size=EMBEDDING_DIM,
                    distance=Distance.COSINE,
                ),
            )
            # Create payload indexes for filtering
            self.client.create_payload_index(
                collection_name=self.collection,
                field_name="classification",
                field_schema="keyword",
            )
            self.client.create_payload_index(
                collection_name=self.collection,
                field_name="document_id",
                field_schema="keyword",
            )
            self.client.create_payload_index(
                collection_name=self.collection,
                field_name="research_areas",
                field_schema="keyword",
            )
            print(f"Created Qdrant collection: {self.collection}")

    def store_vectors(
        self,
        embeddings: list[list[float]],
        payloads: list[dict],
    ) -> list[str]:
        """Store embeddings with metadata in Qdrant."""
        point_ids = [str(uuid.uuid4()) for _ in embeddings]
        points = [
            PointStruct(
                id=pid,
                vector=embedding,
                payload=payload,
            )
            for pid, embedding, payload in zip(point_ids, embeddings, payloads)
        ]
        self.client.upsert(collection_name=self.collection, points=points)
        return point_ids

    def search(
        self,
        query_vector: list[float],
        top_k: int = 20,
        classification_access: str = "PUBLIC",
        research_areas: list[str] | None = None,
    ) -> list[dict]:
        """Search for similar vectors with classification filtering."""
        # Build classification filter — user can access their level and below
        access_levels = self._get_accessible_levels(classification_access)

        must_conditions = [
            FieldCondition(
                key="classification",
                match=MatchAny(any=access_levels),
            )
        ]

        if research_areas:
            must_conditions.append(
                FieldCondition(
                    key="research_areas",
                    match=MatchAny(any=research_areas),
                )
            )

        results = self.client.search(
            collection_name=self.collection,
            query_vector=query_vector,
            query_filter=Filter(must=must_conditions),
            limit=top_k,
            with_payload=True,
        )

        return [
            {
                "id": str(r.id),
                "score": r.score,
                "payload": r.payload,
            }
            for r in results
        ]

    def delete_by_document(self, document_id: str):
        """Delete all vectors for a document."""
        self.client.delete(
            collection_name=self.collection,
            points_selector=Filter(
                must=[
                    FieldCondition(
                        key="document_id",
                        match=MatchValue(value=document_id),
                    )
                ]
            ),
        )

    async def collection_info(self) -> dict:
        """Get collection statistics."""
        info = self.client.get_collection(self.collection)
        return {
            "vectors_count": info.vectors_count,
            "points_count": info.points_count,
            "status": str(info.status),
        }

    @staticmethod
    def _get_accessible_levels(classification: str) -> list[str]:
        """Return classification levels a user can access."""
        hierarchy = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]
        try:
            idx = hierarchy.index(classification)
            return hierarchy[: idx + 1]
        except ValueError:
            return ["PUBLIC"]
