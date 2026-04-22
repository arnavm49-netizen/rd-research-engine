"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { useRouter } from "next/navigation";

const CLASSIFICATION_OPTIONS = ["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"];
const DOCUMENT_TYPES = ["PAPER", "JOURNAL", "BOOK", "REPORT", "DATASET", "IMAGE", "TEST_REPORT", "PATENT", "STANDARD", "OTHER"];

export function UploadDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [classification, setClassification] = useState("PUBLIC");
  const [docType, setDocType] = useState("PAPER");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title || file.name);
      formData.append("classification", classification);
      formData.append("type", docType);

      const response = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      setOpen(false);
      setTitle("");
      setFile(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-medium hover:opacity-90 transition-opacity"
      >
        <Upload size={16} />
        Upload Document
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="w-full max-w-lg p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Upload Document</h2>
          <button onClick={() => setOpen(false)} className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">File</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              accept=".pdf,.docx,.xlsx,.csv,.png,.jpg,.jpeg,.txt"
              required
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-[var(--muted)] file:text-[var(--foreground)] hover:file:bg-[var(--accent)]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Auto-detected from file if empty"
              className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Classification</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)]"
              >
                {CLASSIFICATION_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Type</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--muted)] text-[var(--foreground)]"
              >
                {DOCUMENT_TYPES.map((opt) => (
                  <option key={opt} value={opt}>{opt.replace("_", " ")}</option>
                ))}
              </select>
            </div>
          </div>

          {classification !== "PUBLIC" && (
            <div className="px-3 py-2 rounded-lg bg-amber-900/30 border border-amber-700/50 text-amber-200 text-sm">
              This document will be stored locally only. AI synthesis will be
              disabled for queries that retrieve this content.
            </div>
          )}

          {error && <p className="text-[var(--destructive)] text-sm">{error}</p>}

          <button
            type="submit"
            disabled={uploading || !file}
            className="w-full py-2 px-4 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {uploading ? "Uploading & Processing..." : "Upload & Ingest"}
          </button>
        </form>
      </div>
    </div>
  );
}
