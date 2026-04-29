"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Shield, Clock, Hash, Trash2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const classificationColors: Record<string, string> = {
  PUBLIC: "text-green-400 bg-green-400/10",
  INTERNAL: "text-blue-400 bg-blue-400/10",
  CONFIDENTIAL: "text-amber-400 bg-amber-400/10",
  RESTRICTED: "text-red-400 bg-red-400/10",
};

const statusColors: Record<string, string> = {
  INGESTED: "text-green-400",
  PROCESSING: "text-blue-400",
  PENDING_INGESTION: "text-amber-400",
  FAILED: "text-red-400",
};

interface Document {
  id: string;
  title: string;
  authors: string[];
  type: string;
  classification: string;
  status: string;
  language: string | null;
  createdAt: Date;
  _count: { chunks: number };
  researchAreas: { researchArea: { name: string } }[];
}

export function DocumentList({ documents }: { documents: Document[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeletingId(id);
    setError(null);
    try {
      const resp = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(data?.error || `Delete failed (HTTP ${resp.status})`);
      }
      // Refresh the server component to refetch the document list
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--muted-foreground)]">
        <FileText size={48} className="mx-auto mb-4 opacity-50" />
        <p>No documents yet. Upload your first paper or report.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 rounded-xl border border-red-700/50 bg-red-900/20 text-red-200 text-sm">
          {error}
        </div>
      )}

      {documents.map((doc) => {
        const isDeleting = deletingId === doc.id;
        const isConfirming = confirmId === doc.id;

        return (
          <div
            key={doc.id}
            className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{doc.title}</h3>
                {doc.authors.length > 0 && (
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                    {doc.authors.slice(0, 3).join(", ")}
                    {doc.authors.length > 3 && ` +${doc.authors.length - 3}`}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${classificationColors[doc.classification] || ""}`}
                >
                  <Shield size={10} className="inline mr-1" />
                  {doc.classification}
                </span>
                <span className={`text-xs ${statusColors[doc.status] || ""}`}>
                  {doc.status.replace("_", " ")}
                </span>

                {!isConfirming ? (
                  <button
                    onClick={() => setConfirmId(doc.id)}
                    disabled={isDeleting}
                    className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-red-400 hover:bg-red-900/20 disabled:opacity-50"
                    title="Delete document"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={isDeleting}
                      className="px-2 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        "Confirm delete"
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      disabled={isDeleting}
                      className="px-2 py-1 rounded text-xs bg-[var(--muted)] text-[var(--muted-foreground)] hover:bg-[var(--accent)]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 mt-3 text-xs text-[var(--muted-foreground)] flex-wrap">
              <span className="flex items-center gap-1">
                <FileText size={12} />
                {doc.type.replace("_", " ")}
              </span>
              <span className="flex items-center gap-1">
                <Hash size={12} />
                {doc._count.chunks} chunks
              </span>
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
              </span>
              {doc.researchAreas.map((ra) => (
                <span
                  key={ra.researchArea.name}
                  className="px-2 py-0.5 rounded bg-[var(--muted)] text-[var(--muted-foreground)]"
                >
                  {ra.researchArea.name}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
