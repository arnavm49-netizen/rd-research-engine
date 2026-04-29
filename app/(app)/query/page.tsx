"use client";

import { useState } from "react";
import { Send, Shield, FileText, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface QueryResult {
  content: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  section_header: string | null;
  score: number;
  classification: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  mode?: string;
  results?: QueryResult[];
}

const classificationColors: Record<string, string> = {
  PUBLIC: "text-green-400",
  INTERNAL: "text-blue-400",
  CONFIDENTIAL: "text-amber-400",
  RESTRICTED: "text-red-400",
};

export default function QueryPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ query: userMessage }),
      });

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer || "No results found.",
          mode: data.mode,
          results: data.results,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error connecting to the research engine." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Research Query</h1>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Ask questions about your research knowledge base
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center py-16 text-[var(--muted-foreground)]">
            <p className="text-lg mb-2">Ask a research question</p>
            <p className="text-sm">
              Examples: "What are the latest developments in WAAM?"
              <br />
              "Compare hardfacing alloys for high-temperature wear"
              <br />
              "What test methods validate chromium carbide deposits?"
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-3xl rounded-xl p-4 ${
                msg.role === "user"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "bg-[var(--card)] border border-[var(--border)]"
              }`}
            >
              {msg.mode && (
                <div className="flex items-center gap-2 mb-2 text-xs">
                  <Shield size={12} />
                  <span>
                    {msg.mode === "ai_synthesis"
                      ? "AI Synthesis (PUBLIC data)"
                      : "Retrieval Only (contains sensitive data)"}
                  </span>
                </div>
              )}

              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>

              {/* Source documents */}
              {msg.results && msg.results.length > 0 && (
                <div className="mt-4 pt-3 border-t border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--muted-foreground)] mb-2">
                    Sources ({msg.results.length})
                  </p>
                  <div className="space-y-2">
                    {msg.results.slice(0, 5).map((r, j) => (
                      <div
                        key={j}
                        className="text-xs p-2 rounded bg-[var(--muted)]"
                      >
                        <div className="flex items-center gap-2">
                          <FileText size={12} />
                          <span className="font-medium">{r.document_title}</span>
                          <span className={`${classificationColors[r.classification]}`}>
                            {r.classification}
                          </span>
                          <span className="text-[var(--muted-foreground)]">
                            Score: {(r.score * 100).toFixed(0)}%
                          </span>
                        </div>
                        {r.section_header && (
                          <p className="text-[var(--muted-foreground)] mt-1">
                            Section: {r.section_header}
                          </p>
                        )}
                        {msg.mode === "retrieval_only" && (
                          <p className="mt-1 text-[var(--foreground)] line-clamp-3">
                            {r.content}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl p-4 bg-[var(--card)] border border-[var(--border)]">
              <Loader2 size={20} className="animate-spin text-[var(--primary)]" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-3 pt-4 border-t border-[var(--border)]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a research question..."
          className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="px-4 py-3 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}
