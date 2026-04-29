import { db } from "@/lib/db";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

const statusIcons: Record<string, { icon: typeof Info; color: string }> = {
  CRITICAL_GAP: { icon: AlertTriangle, color: "text-red-400" },
  NEEDS_ATTENTION: { icon: Info, color: "text-amber-400" },
  MODERATE: { icon: Info, color: "text-blue-400" },
  WELL_COVERED: { icon: CheckCircle, color: "text-green-400" },
};

interface CoverageRow {
  research_area: string;
  document_count: number;
  coverage_percentage: number;
  status: string;
  recommendation: string;
}

async function getCoverage(): Promise<{
  totalDocuments: number;
  researchAreasCount: number;
  coverage: CoverageRow[];
  error: string | null;
}> {
  // Pull research areas + their document counts directly from the DB.
  // We can't use fetch('/api/analysis') from a server component without auth
  // headers, so we just call the same logic inline.
  const researchAreas = await db.researchArea.findMany({
    where: { isActive: true },
    include: { _count: { select: { documents: true } } },
    orderBy: { name: "asc" },
  });
  const totalDocuments = await db.document.count();

  const documentCounts: Record<string, number> = {};
  const areasForMl: { name: string; keywords: string[] }[] = [];
  for (const area of researchAreas) {
    documentCounts[area.name] = area._count.documents;
    areasForMl.push({ name: area.name, keywords: area.keywords });
  }

  if (researchAreas.length === 0) {
    return { totalDocuments, researchAreasCount: 0, coverage: [], error: null };
  }

  try {
    const response = await fetch(`${ML_SERVICE_URL}/gaps/coverage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        research_areas: areasForMl,
        document_counts: documentCounts,
        total_documents: totalDocuments,
      }),
      cache: "no-store",
    });
    if (!response.ok) {
      return {
        totalDocuments,
        researchAreasCount: researchAreas.length,
        coverage: [],
        error: `Analysis service returned ${response.status}`,
      };
    }
    const data = await response.json();
    return {
      totalDocuments,
      researchAreasCount: researchAreas.length,
      coverage: data.coverage ?? [],
      error: null,
    };
  } catch (err: unknown) {
    return {
      totalDocuments,
      researchAreasCount: researchAreas.length,
      coverage: [],
      error: err instanceof Error ? err.message : "Failed to reach analysis service",
    };
  }
}

export default async function AnalysisPage() {
  const { totalDocuments, researchAreasCount, coverage, error } = await getCoverage();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Gap Analysis</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Coverage assessment across {researchAreasCount} configured research areas
        {totalDocuments > 0 && ` (${totalDocuments} documents in corpus)`}
      </p>

      {error && (
        <div className="mb-4 p-4 rounded-xl border border-red-700/50 bg-red-900/20 text-red-200 text-sm">
          Analysis service unavailable: {error}
        </div>
      )}

      {!error && coverage.length === 0 && (
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)] text-sm text-[var(--muted-foreground)]">
          {researchAreasCount === 0
            ? "No research areas configured yet. Add research areas in Admin to start tracking coverage."
            : totalDocuments === 0
              ? "No documents ingested yet. Upload papers in the Library to populate the analysis."
              : "Loading coverage data..."}
        </div>
      )}

      <div className="space-y-4">
        {coverage.map((item, i) => {
          const config = statusIcons[item.status] ?? statusIcons.NEEDS_ATTENTION;
          const Icon = config.icon;
          return (
            <div key={i} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Icon size={20} className={config.color} />
                  <h3 className="font-medium">{item.research_area}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {item.document_count} doc{item.document_count === 1 ? "" : "s"}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${config.color}`}>
                    {item.status.replace("_", " ")}
                  </span>
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--muted)] mb-2">
                <div
                  className="h-2 rounded-full bg-[var(--primary)]"
                  style={{ width: `${Math.max(item.coverage_percentage, 2)}%` }}
                />
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">{item.recommendation}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
