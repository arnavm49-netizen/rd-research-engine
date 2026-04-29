"use client";

import { useState } from "react";
import {
  Search,
  ExternalLink,
  Loader2,
  Check,
  X,
  Flag,
  AlertCircle,
  Info,
} from "lucide-react";

interface Paper {
  id: string;
  title: string;
  authors: string[];
  abstract: string | null;
  doi: string | null;
  url: string | null;
  source: string;
  publication_year: number | null;
  relevance_score?: number | null;
  status: "NEW" | "FLAGGED" | "APPROVED" | "REJECTED" | "INGESTED";
}

const sourceColors: Record<string, string> = {
  arxiv: "bg-red-900/30 text-red-300",
  semantic_scholar: "bg-blue-900/30 text-blue-300",
  crossref: "bg-green-900/30 text-green-300",
  pubmed: "bg-purple-900/30 text-purple-300",
};

const statusBadge: Record<string, { color: string; label: string }> = {
  NEW: { color: "bg-[var(--muted)] text-[var(--muted-foreground)]", label: "New" },
  FLAGGED: { color: "bg-amber-900/30 text-amber-300", label: "Flagged" },
  APPROVED: { color: "bg-blue-900/30 text-blue-300", label: "Approved" },
  REJECTED: { color: "bg-red-900/30 text-red-300", label: "Rejected" },
  INGESTED: { color: "bg-green-900/30 text-green-300", label: "Ingested" },
};

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "ok" | "info" | "err"; msg: string } | null>(null);
  const [sources, setSources] = useState(["arxiv", "semantic_scholar", "crossref"]);

  function flashToast(kind: "ok" | "info" | "err", msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 6000);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query, sources, max_results: 20 }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || `Discovery failed (HTTP ${response.status})`);
      }

      if (!Array.isArray(data)) {
        throw new Error(data?.error || "Unexpected response from discovery service");
      }

      setResults(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleAction(paperId: string, action: "approve" | "flag" | "reject") {
    setActionInFlight(`${paperId}:${action}`);
    try {
      const response = await fetch(`/api/discover/${paperId}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || `${action} failed (HTTP ${response.status})`);
      }

      // Update the row in-place so the UI reflects the new status without a refetch
      const newStatus =
        action === "flag"
          ? "FLAGGED"
          : action === "reject"
            ? "REJECTED"
            : data.status === "ingestion_queued"
              ? "INGESTED"
              : "APPROVED";

      setResults((prev) =>
        prev.map((p) => (p.id === paperId ? { ...p, status: newStatus as Paper["status"] } : p))
      );

      const kind: "ok" | "info" =
        action === "approve" && data.status === "manual_upload_required" ? "info" : "ok";
      flashToast(kind, data.message || `${action} succeeded`);
    } catch (err: unknown) {
      flashToast("err", err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionInFlight(null);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Discover Papers</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Search academic databases for relevant research. Results are ranked by semantic similarity to your query.
      </p>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. chromium carbide hardfacing wear resistance"
          className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50"
        >
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
          Search
        </button>
      </form>

      <div className="flex gap-2 mb-6">
        {["arxiv", "semantic_scholar", "crossref", "pubmed"].map((src) => (
          <button
            key={src}
            onClick={() =>
              setSources((prev) =>
                prev.includes(src) ? prev.filter((s) => s !== src) : [...prev, src]
              )
            }
            className={`px-3 py-1 rounded-full text-xs ${
              sources.includes(src) ? sourceColors[src] : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}
          >
            {src.replace("_", " ")}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl border border-red-700/50 bg-red-900/20 text-red-200 flex items-start gap-3">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">Discovery failed</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={`mb-4 p-3 rounded-xl border text-sm flex items-start gap-3 ${
            toast.kind === "ok"
              ? "border-green-700/50 bg-green-900/20 text-green-200"
              : toast.kind === "info"
                ? "border-blue-700/50 bg-blue-900/20 text-blue-200"
                : "border-red-700/50 bg-red-900/20 text-red-200"
          }`}
        >
          {toast.kind === "err" ? (
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
          ) : (
            <Info size={18} className="flex-shrink-0 mt-0.5" />
          )}
          <p>{toast.msg}</p>
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="text-center py-16 text-[var(--muted-foreground)]">
          <Search size={48} className="mx-auto mb-4 opacity-50" />
          <p>Enter a search query above to discover papers</p>
        </div>
      )}

      <div className="space-y-4">
        {results.map((paper) => {
          const status = statusBadge[paper.status] ?? statusBadge.NEW;
          const isTerminal = paper.status === "REJECTED" || paper.status === "INGESTED";
          const isApproving = actionInFlight === `${paper.id}:approve`;
          const isFlagging = actionInFlight === `${paper.id}:flag`;
          const isRejecting = actionInFlight === `${paper.id}:reject`;

          return (
            <div key={paper.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">{paper.title}</h3>
                  <p className="text-sm text-[var(--muted-foreground)] mt-1">
                    {(paper.authors || []).slice(0, 4).join(", ")}
                    {(paper.authors || []).length > 4 && ` +${paper.authors.length - 4}`}
                    {paper.publication_year && ` (${paper.publication_year})`}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sourceColors[paper.source] || ""}`}>
                    {paper.source.replace("_", " ")}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>
                    {status.label}
                  </span>
                  {paper.url && (
                    <a
                      href={paper.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--primary)] hover:opacity-80"
                      title="Open source page"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </div>

              {paper.abstract && (
                <p className="text-sm text-[var(--muted-foreground)] mt-3 line-clamp-3">
                  {paper.abstract}
                </p>
              )}

              {typeof paper.relevance_score === "number" && (
                <p className="text-xs text-[var(--muted-foreground)] mt-2">
                  Relevance: {(paper.relevance_score * 100).toFixed(0)}%
                </p>
              )}

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => handleAction(paper.id, "approve")}
                  disabled={isTerminal || isApproving}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-green-900/30 text-green-300 text-xs hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isApproving ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Check size={12} />
                  )}
                  Approve & Ingest
                </button>
                <button
                  onClick={() => handleAction(paper.id, "flag")}
                  disabled={isTerminal || isFlagging}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-900/30 text-amber-300 text-xs hover:bg-amber-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isFlagging ? <Loader2 size={12} className="animate-spin" /> : <Flag size={12} />}
                  Flag
                </button>
                <button
                  onClick={() => handleAction(paper.id, "reject")}
                  disabled={isTerminal || isRejecting}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-900/30 text-red-300 text-xs hover:bg-red-900/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRejecting ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                  Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
