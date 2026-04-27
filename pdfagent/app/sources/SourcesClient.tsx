"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MAIN_APP_SUBJECT_KEYS } from "@/lib/subjects";

interface Source {
  id: string;
  domain: string;
  name: string;
  seed_urls: string[];
  enabled: boolean;
  default_subject: string | null;
  last_crawled_at: string | null;
}

export default function SourcesClient({ initialSources }: { initialSources: Source[] }) {
  const router = useRouter();
  const [sources, setSources] = useState(initialSources);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: "error" | "success"; msg: string } | null>(null);

  const [domain, setDomain] = useState("");
  const [name, setName] = useState("");
  const [defaultSubject, setDefaultSubject] = useState<string>("");
  const [seedUrlsText, setSeedUrlsText] = useState("");

  async function add() {
    setBusy("__add");
    setFlash(null);
    const seedUrls = seedUrlsText.split("\n").map((s) => s.trim()).filter(Boolean);
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          name: name.trim() || domain.trim(),
          defaultSubject: defaultSubject || null,
          seedUrls,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFlash({ type: "error", msg: data.error ?? "Add failed" });
      } else {
        setSources((prev) => [data.source, ...prev]);
        setDomain("");
        setName("");
        setSeedUrlsText("");
        setFlash({ type: "success", msg: "Source eklendi" });
      }
    } finally {
      setBusy(null);
    }
  }

  async function toggle(id: string, enabled: boolean) {
    setBusy(id);
    try {
      await fetch(`/api/sources/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      setSources((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm("Source silinsin mi?")) return;
    setBusy(id);
    try {
      await fetch(`/api/sources/${id}`, { method: "DELETE" });
      setSources((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setBusy(null);
    }
  }

  async function runDiscover(id: string) {
    setBusy(id);
    setFlash(null);
    try {
      const res = await fetch("/api/jobs/trigger", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "discover", sourceId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setFlash({ type: "error", msg: data.error ?? "Failed" });
      else {
        setFlash({ type: "success", msg: "Discover kuyruğa eklendi" });
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="toolbar">
        <h2>Sources</h2>
      </div>

      {flash && <div className={`flash ${flash.type}`}>{flash.msg}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Yeni Source Ekle</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          Sadece <span className="mono">.edu</span>, <span className="mono">.gov</span> veya statik allowlist&apos;teki domainler eklenebilir.
        </p>
        <div className="row" style={{ marginBottom: 8 }}>
          <input
            type="text"
            placeholder="domain (örn. openstax.org)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            type="text"
            placeholder="görünür ad"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1 }}
          />
          <select value={defaultSubject} onChange={(e) => setDefaultSubject(e.target.value)}>
            <option value="">default subject (opsiyonel)</option>
            {MAIN_APP_SUBJECT_KEYS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <textarea
          rows={4}
          placeholder={"Seed URL'leri (her satıra bir tane)\nÖrn: https://openstax.org/details/books/biology-2e"}
          value={seedUrlsText}
          onChange={(e) => setSeedUrlsText(e.target.value)}
        />
        <div className="row" style={{ marginTop: 8 }}>
          <button onClick={add} disabled={busy !== null}>Source Ekle</button>
        </div>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Domain</th>
              <th>Name</th>
              <th>Default Subject</th>
              <th>Seed Count</th>
              <th>Last Crawl</th>
              <th>Aktif</th>
              <th>Aksiyon</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.domain}</td>
                <td>{s.name}</td>
                <td className="muted">{s.default_subject ?? "-"}</td>
                <td className="muted">{s.seed_urls.length}</td>
                <td className="muted">
                  {s.last_crawled_at ? new Date(s.last_crawled_at).toLocaleString() : "-"}
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    onChange={(e) => toggle(s.id, e.target.checked)}
                    disabled={busy !== null}
                  />
                </td>
                <td>
                  <div className="row">
                    <button onClick={() => runDiscover(s.id)} disabled={busy !== null || !s.enabled}>
                      Run Discover
                    </button>
                    <button className="ghost danger" onClick={() => remove(s.id)} disabled={busy !== null}>
                      Sil
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">Henüz source yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
