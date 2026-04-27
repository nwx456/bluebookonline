import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";

interface StatusCount {
  status: string;
  count: string;
}

interface RecentRow {
  id: string;
  source_url: string;
  status: string;
  reject_reason: string | null;
  discovered_at: string;
}

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const counts = await query<StatusCount>(
    `SELECT status, COUNT(*)::text AS count FROM documents GROUP BY status`
  );
  const total = counts.rows.reduce((s, r) => s + Number(r.count), 0);
  const byStatus = Object.fromEntries(counts.rows.map((r) => [r.status, Number(r.count)]));

  const recent = await query<RecentRow>(
    `SELECT id, source_url, status, reject_reason, discovered_at
       FROM documents
       ORDER BY discovered_at DESC
       LIMIT 10`
  );
  const recentFails = await query<RecentRow>(
    `SELECT id, source_url, status, reject_reason, discovered_at
       FROM documents
       WHERE status IN ('rejected','failed')
       ORDER BY discovered_at DESC
       LIMIT 10`
  );

  const stat = (key: string) => byStatus[key] ?? 0;

  return (
    <Shell email={session.email}>
      <h2>Dashboard</h2>
      <div className="grid-stats">
        <div className="stat"><div className="label">Toplam</div><div className="value">{total}</div></div>
        <div className="stat"><div className="label">Discovered</div><div className="value">{stat("discovered")}</div></div>
        <div className="stat"><div className="label">Pending Review</div><div className="value">{stat("pending_review")}</div></div>
        <div className="stat"><div className="label">Queued Upload</div><div className="value">{stat("queued_upload") + stat("uploading")}</div></div>
        <div className="stat"><div className="label">Uploaded</div><div className="value" style={{ color: "var(--success)" }}>{stat("uploaded")}</div></div>
        <div className="stat"><div className="label">Rejected</div><div className="value" style={{ color: "var(--danger)" }}>{stat("rejected")}</div></div>
        <div className="stat"><div className="label">Failed</div><div className="value" style={{ color: "var(--danger)" }}>{stat("failed")}</div></div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Son Eklenenler</h3>
        <table>
          <thead>
            <tr><th>URL</th><th>Status</th><th>Tarih</th></tr>
          </thead>
          <tbody>
            {recent.rows.map((r) => (
              <tr key={r.id}>
                <td className="mono" style={{ maxWidth: 520, wordBreak: "break-all" }}>{r.source_url}</td>
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td className="muted">{new Date(r.discovered_at).toLocaleString()}</td>
              </tr>
            ))}
            {recent.rows.length === 0 && <tr><td colSpan={3} className="muted">Henüz kayıt yok.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Son Hatalar</h3>
        <table>
          <thead>
            <tr><th>URL</th><th>Status</th><th>Sebep</th></tr>
          </thead>
          <tbody>
            {recentFails.rows.map((r) => (
              <tr key={r.id}>
                <td className="mono" style={{ maxWidth: 420, wordBreak: "break-all" }}>{r.source_url}</td>
                <td><span className={`badge ${r.status}`}>{r.status}</span></td>
                <td className="muted">{r.reject_reason ?? "-"}</td>
              </tr>
            ))}
            {recentFails.rows.length === 0 && <tr><td colSpan={3} className="muted">Hata yok. Aferin.</td></tr>}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
