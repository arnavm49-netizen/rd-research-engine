import { db } from "@/lib/db";
import { Library, FileText, Search, FlaskConical } from "lucide-react";

async function getStats() {
  const [docCount, discoveredCount, queryCount, formulaCount] =
    await Promise.all([
      db.document.count(),
      db.discoveredPaper.count({ where: { status: "NEW" } }),
      db.queryLog.count(),
      db.formula.count(),
    ]);

  return { docCount, discoveredCount, queryCount, formulaCount };
}

export default async function DashboardPage() {
  const stats = await getStats();

  const cards = [
    {
      label: "Documents",
      value: stats.docCount,
      icon: Library,
      color: "text-blue-400",
    },
    {
      label: "New Discoveries",
      value: stats.discoveredCount,
      icon: Search,
      color: "text-green-400",
    },
    {
      label: "Queries",
      value: stats.queryCount,
      icon: FileText,
      color: "text-purple-400",
    },
    {
      label: "Formulas",
      value: stats.formulaCount,
      icon: FlaskConical,
      color: "text-amber-400",
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[var(--muted-foreground)]">
                  {card.label}
                </span>
                <Icon size={20} className={card.color} />
              </div>
              <p className="text-3xl font-bold">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-2">
            <a
              href="/library"
              className="block px-4 py-3 rounded-lg bg-[var(--muted)] hover:bg-[var(--accent)] transition-colors"
            >
              Upload a document
            </a>
            <a
              href="/query"
              className="block px-4 py-3 rounded-lg bg-[var(--muted)] hover:bg-[var(--accent)] transition-colors"
            >
              Ask a research question
            </a>
            <a
              href="/discover"
              className="block px-4 py-3 rounded-lg bg-[var(--muted)] hover:bg-[var(--accent)] transition-colors"
            >
              Discover new papers
            </a>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-lg font-semibold mb-4">System Status</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">ML Service</span>
              <span className="text-[var(--success)]">Online</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Vector Store</span>
              <span className="text-[var(--success)]">Online</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">File Storage</span>
              <span className="text-[var(--success)]">Online</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted-foreground)]">Data Security</span>
              <span className="text-[var(--success)]">Air-gapped</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
