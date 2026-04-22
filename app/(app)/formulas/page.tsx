"use client";

import { useState } from "react";
import { FlaskConical, Search, TestTubes } from "lucide-react";

const DOMAINS = ["welding", "materials", "wear", "electrical"];

export default function FormulasPage() {
  const [query, setQuery] = useState("");
  const [domain, setDomain] = useState<string>("welding");
  const [formulas, setFormulas] = useState<any[]>([]);
  const [tests, setTests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);

    try {
      const [formulaRes, testRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_ML_URL || ""}/api/formulas/suggest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, domain }),
        }),
        fetch(`${process.env.NEXT_PUBLIC_ML_URL || ""}/api/formulas/tests`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, domain }),
        }),
      ]);

      if (formulaRes.ok) {
        const data = await formulaRes.json();
        setFormulas(data.formulas || []);
      }
      if (testRes.ok) {
        const data = await testRes.json();
        setTests(data.tests || []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Formulas & Tests</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Find relevant formulas and validation test methods
      </p>

      <form onSubmit={handleSearch} className="flex gap-3 mb-6">
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)]"
        >
          {DOMAINS.map((d) => (
            <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
          ))}
        </select>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. heat input, wear coefficient, hardness"
          className="flex-1 px-4 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <button type="submit" disabled={loading} className="px-6 py-3 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
          <Search size={18} />
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulas */}
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
            <FlaskConical size={20} className="text-amber-400" />
            Formulas ({formulas.length})
          </h2>
          <div className="space-y-3">
            {formulas.map((f, i) => (
              <div key={i} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <h3 className="font-medium">{f.name}</h3>
                <code className="block mt-2 px-3 py-2 rounded bg-[var(--muted)] text-sm font-mono text-[var(--primary)]">
                  {f.expression}
                </code>
                <p className="text-sm text-[var(--muted-foreground)] mt-2">{f.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(f.variables || {}).map(([key, val]) => (
                    <span key={key} className="text-xs px-2 py-0.5 rounded bg-[var(--muted)]">
                      {key}: {val as string}
                    </span>
                  ))}
                </div>
                {f.standard && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-2">Standard: {f.standard}</p>
                )}
              </div>
            ))}
            {formulas.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">
                Search to find relevant formulas
              </p>
            )}
          </div>
        </div>

        {/* Test Methods */}
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold mb-4">
            <TestTubes size={20} className="text-blue-400" />
            Test Methods ({tests.length})
          </h2>
          <div className="space-y-3">
            {tests.map((t, i) => (
              <div key={i} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <h3 className="font-medium">{t.methodology}</h3>
                {t.standard && (
                  <p className="text-sm text-[var(--primary)] mt-1">{t.standard}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(t.parameters || {}).map(([key, val]) => (
                    <span key={key} className="text-xs px-2 py-0.5 rounded bg-[var(--muted)]">
                      {key.replace("_", " ")}: {val as string}
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {tests.length === 0 && (
              <p className="text-sm text-[var(--muted-foreground)]">
                Search to find relevant test methods
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
