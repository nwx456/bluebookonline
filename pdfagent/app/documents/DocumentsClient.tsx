"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAIN_APP_SUBJECT_KEYS } from "@/lib/subjects";

interface Doc {
  id: string;
  source_url: string;
  sha256: string | null;
  size_bytes: string | null;
  status: string;
  reject_reason: string | null;
  subject: string | null;
  question_count: number;
  has_visuals: boolean;
  exam_id: string | null;
  discovered_at: string;
  uploaded_at: string | null;
}

const STATUS_FILTERS = [
  "",
  "discovered",
  "downloaded",
  "pending_review",
  "queued_upload",
  "uploading",
  "uploaded",
  "rejected",
  "failed",
];

function formatBytes(s: string | null): string {
  if (!s) return "-";
  const n = Number(s);
  if (!Number.isFinite(n)) return "-";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default function DocumentsClient({
  initialDocs,
  initialFilter,
}: {
  initialDocs: Doc[];
  initialFilter: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState(initialFilter);
  const [docs, setDocs] = useState(initialDocs);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: "error" | "success"; msg: string } | null>(null);

  // Add URL form
  const [newUrl, setNewUrl] = useState("");
  const [newSubject, setNewSubject] = useState<string>(MAIN_APP_SUBJECT_KEYS[0]);
  const [newCount, setNewCount] = useState(20);
  const [newHasVisuals, setNewHasVisuals] = useState(false);

  function applyFilter(v: string) {
    setFilter(v);
    const url = new URL(window.location.href);
    if (v) url.searchParams.set("status", v);
    else url.searchParams.delete("status");
    router.push(url.pathname + url.search);
  }

  async function action(id: string, kind: "approve" | "reject" | "retry") {
    setBusy(id);
    setFlash(null);
    try {
      const res = await fetch(`/api/documents/${id}/${kind}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash({ type: "error", msg: data.error ?? `Action ${kind} failed` });
      } else {
        setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, status: data.status ?? d.status } : d)));
        setFlash({ type: "success", msg: `${kind} ok` });
      }
    } finally {
      setBusy(null);
    }
  }

  async function addUrl() {
    if (!newUrl.trim()) return;
    setBusy("__add");
    setFlash(null);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: newUrl.trim(),
          subject: newSubject,
          questionCount: newCount,
          hasVisuals: newHasVisuals,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash({ type: "error", msg: data.error ?? "Add failed" });
      } else {
        setNewUrl("");
        setFlash({ type: "success", msg: "Eklendi ve fetch kuyruğuna alındı" });
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="toolbar">
        <h2>Documents</h2>
        <div className="row">
          <span className="muted">Filtre:</span>
          <select value={filter} onChange={(e) => applyFilter(e.target.value)}>
            {STATUS_FILTERS.map((s) => (
              <option key={s || "all"} value={s}>
                {s || "Hepsi"}
              </option>
            ))}
          </select>
          <button className="ghost" onClick={() => router.refresh()}>Yenile</button>
        </div>
      </div>

      {flash && <div className={`flash ${flash.type}`}>{flash.msg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>URL Ekle</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Sadece allowlist&apos;teki domainlerden PDF eklenebilir. Eklenen URL fetch + validate kuyruğuna alınır.
        </p>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            type="url"
            placeholder="https://openstax.org/.../book.pdf"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            style={{ flex: 1 }}
          />
          <select value={newSubject} onChange={(e) => setNewSubject(e.target.value)}>
            {MAIN_APP_SUBJECT_KEYS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={200}
            value={newCount}
            onChange={(e) => setNewCount(Number(e.target.value))}
            style={{ width: 80 }}
          />
          <label className="row" style={{ gap: 4 }}>
            <input
              type="checkbox"
              checked={newHasVisuals}
              onChange={(e) => setNewHasVisuals(e.target.checked)}
            />
            <span className="muted">visuals</span>
          </label>
          <button onClick={addUrl} disabled={busy !== null}>Ekle</button>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>URL</th>
              <th>Status</th>
              <th>Boyut</th>
              <th>Subject</th>
              <th>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td className="mono" style={{ maxWidth: 420, wordBreak: "break-all" }}>
                  <a href={d.source_url} target="_blank" rel="noreferrer">{d.source_url}</a>
                  {d.reject_reason && (
                    <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                      reason: {d.reject_reason}
                    </div>
                  )}
                  {d.exam_id && (
                    <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                      examId: {d.exam_id}
                    </div>
                  )}
                </td>
                <td><span className={`badge ${d.status}`}>{d.status}</span></td>
                <td className="muted">{formatBytes(d.size_bytes)}</td>
                <td className="muted">{d.subject ?? "-"}</td>
                <td>
                  <div className="row">
                    {d.status === "pending_review" && (
                      <>
                        <button onClick={() => action(d.id, "approve")} disabled={busy !== null}>
                          Approve
                        </button>
                        <button className="ghost danger" onClick={() => action(d.id, "reject")} disabled={busy !== null}>
                          Reject
                        </button>
                      </>
                    )}
                    {(d.status === "failed" || d.status === "rejected") && (
                      <button className="ghost" onClick={() => action(d.id, "retry")} disabled={busy !== null}>
                        Retry
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">Kayıt yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
