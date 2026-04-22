"use client";

import { useState } from "react";
import { Search, ExternalLink, Loader2, Check, X, Flag, AlertCircle } from "lucide-react";

interface Paper {
  title: string;
  authors: string[];
  abstract: string | null;
  doi: string | null;
  url: string | null;
  source: string;
  publication_year: number | null;
}

const sourceColors: Record<string, string> = {
  arxiv: "bg-red-900/30 text-red-300",
  semantic_scholar: "bg-blue-900/30 text-blue-300",
  crossref: "bg-green-900/30 text-green-300",
  pubmed: "bg-purple-900/30 text-purple-300",
};

export default function DiscoverPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState(["arxiv", "semantic_scholar", "crossref"]);

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
        const msg = data?.error || `Discovery failed (HTTP ${response.status})`;
        throw new Error(msg);
      }

      // Defensive: ML service must return an array. If not, treat as error.
      if (!Array.isArray(data)) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "Unexpected response from discovery service"
        );
      }

      setResults(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Discover Papers</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Search academic databases for relevant research
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

      {/* Source toggles */}
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
              sources.includes(src)
                ? sourceColors[src]
                : "bg-[var(--muted)] text-[var(--muted-foreground)]"
            }`}
          >
            {src.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-4 rounded-xl border border-red-700/50 bg-red-900/20 text-red-200 flex items-start gap-3">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium mb-1">Discovery failed</p>
            <p>{error}</p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && results.length === 0 && (
        <div className="text-center py-16 text-[var(--muted-foreground)]">
          <Search size={48} className="mx-auto mb-4 opacity-50" />
          <p>Enter a search query above to discover papers</p>
        </div>
      )}

      {/* Results */}
      <div className="space-y-4">
        {results.map((paper, i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-medium">{paper.title}</h3>
                <p className="text-sm text-[var(--muted-foreground)] mt-1">
                  {(paper.authors || []).slice(0, 4).join(", ")}
                  {(paper.authors || []).length > 4 && ` +${paper.authors.length - 4}`}
                  {paper.publication_year && ` (${paper.publication_year})`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${sourceColors[paper.source] || ""}`}>
                  {paper.source.replace("_", " ")}
                </span>
                {paper.url && (
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--primary)] hover:opacity-80"
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
            <div className="flex gap-2 mt-3">
              <button className="flex items-center gap-1 px-3 py-1 rounded-lg bg-green-900/30 text-green-300 text-xs hover:bg-green-900/50">
                <Check size={12} /> Approve & Ingest
              </button>
              <button className="flex items-center gap-1 px-3 py-1 rounded-lg bg-amber-900/30 text-amber-300 text-xs hover:bg-amber-900/50">
                <Flag size={12} /> Flag
              </button>
              <button className="flex items-center gap-1 px-3 py-1 rounded-lg bg-red-900/30 text-red-300 text-xs hover:bg-red-900/50">
                <X size={12} /> Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
