"use client";

import { BarChart3, AlertTriangle, CheckCircle, Info } from "lucide-react";

const statusIcons: Record<string, any> = {
  CRITICAL_GAP: { icon: AlertTriangle, color: "text-red-400" },
  NEEDS_ATTENTION: { icon: Info, color: "text-amber-400" },
  MODERATE: { icon: Info, color: "text-blue-400" },
  WELL_COVERED: { icon: CheckCircle, color: "text-green-400" },
};

// Placeholder — will be fetched from API once documents are ingested
const MOCK_COVERAGE = [
  { research_area: "Hardfacing & Wear Resistance", document_count: 0, coverage_percentage: 0, status: "CRITICAL_GAP", recommendation: "No documents cover this area. Start by uploading key papers." },
  { research_area: "WAAM (Wire Arc Additive Manufacturing)", document_count: 0, coverage_percentage: 0, status: "CRITICAL_GAP", recommendation: "Upload existing WAAM research PDFs from the R&D folder." },
  { research_area: "Electrode Chemistry", document_count: 0, coverage_percentage: 0, status: "CRITICAL_GAP", recommendation: "Priority area — begin literature search immediately." },
  { research_area: "Welding Metallurgy", document_count: 0, coverage_percentage: 0, status: "CRITICAL_GAP", recommendation: "Core competency area — needs comprehensive coverage." },
  { research_area: "Quality & Testing Standards", document_count: 0, coverage_percentage: 0, status: "CRITICAL_GAP", recommendation: "Upload ISO/ASTM/AWS standards relevant to your work." },
];

export default function AnalysisPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Gap Analysis</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">
        Research coverage assessment across your focus areas
      </p>

      <div className="space-y-4">
        {MOCK_COVERAGE.map((item, i) => {
          const config = statusIcons[item.status] || statusIcons.CRITICAL_GAP;
          const Icon = config.icon;
          return (
            <div
              key={i}
              className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <Icon size={20} className={config.color} />
                  <h3 className="font-medium">{item.research_area}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[var(--muted-foreground)]">
                    {item.document_count} docs
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${config.color}`}>
                    {item.status.replace("_", " ")}
                  </span>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-full h-2 rounded-full bg-[var(--muted)] mb-2">
                <div
                  className="h-2 rounded-full bg-[var(--primary)]"
                  style={{ width: `${Math.max(item.coverage_percentage, 2)}%` }}
                />
              </div>
              <p className="text-sm text-[var(--muted-foreground)]">
                {item.recommendation}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
