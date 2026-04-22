import { db } from "@/lib/db";

async function getAdminData() {
  const [users, auditLogs, recentQueries] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { actor: { select: { name: true, email: true } } },
    }),
    db.queryLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { name: true } } },
    }),
  ]);

  return { users, auditLogs, recentQueries };
}

export default async function AdminPage() {
  const { users, auditLogs, recentQueries } = await getAdminData();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Users */}
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-lg font-semibold mb-4">Users ({users.length})</h2>
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                <div>
                  <p className="text-sm font-medium">{u.name}</p>
                  <p className="text-xs text-[var(--muted-foreground)]">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-[var(--muted)]">{u.role}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-[var(--muted)]">{u.classificationAccess}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Queries */}
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-lg font-semibold mb-4">Recent Queries</h2>
          <div className="space-y-2">
            {recentQueries.map((q) => (
              <div key={q.id} className="py-2 border-b border-[var(--border)] last:border-0">
                <p className="text-sm truncate">{q.query}</p>
                <div className="flex items-center gap-2 mt-1 text-xs text-[var(--muted-foreground)]">
                  <span>{q.user?.name}</span>
                  <span>{q.mode}</span>
                  <span>{q.latencyMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log */}
        <div className="col-span-full p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-lg font-semibold mb-4">Audit Log</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted-foreground)] border-b border-[var(--border)]">
                  <th className="py-2 pr-4">Time</th>
                  <th className="py-2 pr-4">Actor</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Entity</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-4 text-[var(--muted-foreground)]">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{log.actor?.name || "System"}</td>
                    <td className="py-2 pr-4">{log.action}</td>
                    <td className="py-2 pr-4">{log.entity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
