"use client";

import { FileText, Shield, Clock, Hash } from "lucide-react";
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
      {documents.map((doc) => (
        <div
          key={doc.id}
          className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/30 transition-colors"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium truncate">{doc.title}</h3>
              {doc.authors.length > 0 && (
                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                  {doc.authors.slice(0, 3).join(", ")}
                  {doc.authors.length > 3 && ` +${doc.authors.length - 3}`}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 ml-4">
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${classificationColors[doc.classification] || ""}`}
              >
                <Shield size={10} className="inline mr-1" />
                {doc.classification}
              </span>
              <span className={`text-xs ${statusColors[doc.status] || ""}`}>
                {doc.status.replace("_", " ")}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-3 text-xs text-[var(--muted-foreground)]">
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
      ))}
    </div>
  );
}
