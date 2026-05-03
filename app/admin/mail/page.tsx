"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, BookOpen, Loader2, Mail } from "lucide-react";
import { HeaderNav } from "@/components/HeaderNav";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";

type Recipient = { email: string; username: string };

type AdminStats = {
  registeredUsers: number;
  pendingRegistrations: number;
  pdfUploadsTotal: number;
  pdfPublished: number;
  pdfUnpublished: number;
  questionsTotal: number;
  questionsWithGraph: number;
  attemptsTotal: number;
  attemptsCompleted: number;
  attemptsInProgress: number;
  attemptAnswersTotal: number;
  pdfBySubject: { subject: string; label: string; pdfCount: number }[];
};

export default function AdminMailPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sendLoading, setSendLoading] = useState(false);
  const [sendResult, setSendResult] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setChecking(false);
        router.replace("/login");
        return;
      }
      if (!isAdminBroadcastEmail(session.user.email)) {
        router.replace("/dashboard");
        return;
      }
      setAccessToken(session.access_token ?? null);
      setChecking(false);
    });
  }, [router]);

  const loadRecipients = useCallback(async (token: string) => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/admin/mail/recipients", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setListError(typeof data.error === "string" ? data.error : "Could not load recipients.");
        setRecipients([]);
        return;
      }
      const list = Array.isArray(data.recipients) ? data.recipients : [];
      setRecipients(
        list.map((r: { email?: string; username?: string }) => ({
          email: String(r.email ?? ""),
          username: String(r.username ?? ""),
        }))
      );
      setSelected(new Set());
    } catch {
      setListError("Connection error.");
      setRecipients([]);
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken || checking) return;
    loadRecipients(accessToken);
  }, [accessToken, checking, loadRecipients]);

  const loadStats = useCallback(async (token: string) => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatsError(typeof data.error === "string" ? data.error : "Could not load statistics.");
        setStats(null);
        return;
      }
      setStats({
        registeredUsers: Number(data.registeredUsers) || 0,
        pendingRegistrations: Number(data.pendingRegistrations) || 0,
        pdfUploadsTotal: Number(data.pdfUploadsTotal) || 0,
        pdfPublished: Number(data.pdfPublished) || 0,
        pdfUnpublished: Number(data.pdfUnpublished) || 0,
        questionsTotal: Number(data.questionsTotal) || 0,
        questionsWithGraph: Number(data.questionsWithGraph) || 0,
        attemptsTotal: Number(data.attemptsTotal) || 0,
        attemptsCompleted: Number(data.attemptsCompleted) || 0,
        attemptsInProgress: Number(data.attemptsInProgress) || 0,
        attemptAnswersTotal: Number(data.attemptAnswersTotal) || 0,
        pdfBySubject: Array.isArray(data.pdfBySubject) ? data.pdfBySubject : [],
      });
    } catch {
      setStatsError("Connection error.");
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken || checking) return;
    loadStats(accessToken);
  }, [accessToken, checking, loadStats]);

  const allSelected = useMemo(
    () => recipients.length > 0 && selected.size === recipients.length,
    [recipients.length, selected.size]
  );

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(recipients.map((r) => r.email)));
    }
  };

  const toggleOne = (email: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const handleSend = async () => {
    if (!accessToken) return;
    setSendError(null);
    setSendResult(null);
    if (selected.size === 0) {
      setSendError("Select at least one recipient.");
      return;
    }
    if (!subject.trim()) {
      setSendError("Subject is required.");
      return;
    }
    if (!body.trim()) {
      setSendError("Message is required.");
      return;
    }
    setSendLoading(true);
    try {
      const res = await fetch("/api/admin/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          subject: subject.trim(),
          body: body.trim(),
          recipientEmails: [...selected],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(typeof data.error === "string" ? data.error : "Send failed.");
        return;
      }
      const parts: string[] = [];
      parts.push(`Sent: ${data.sent ?? 0}`);
      if (typeof data.failed === "number" && data.failed > 0) {
        parts.push(`Failed: ${data.failed}`);
      }
      if (typeof data.skipped === "number" && data.skipped > 0) {
        parts.push(`Not in database (skipped): ${data.skipped}`);
      }
      if (data.firstError) {
        parts.push(`First error: ${data.firstError}`);
      }
      setSendResult(parts.join(". ") + ".");
    } catch {
      setSendError("Connection error.");
    } finally {
      setSendLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link
            href="/"
            className="flex items-center gap-2 font-semibold text-gray-900 hover:text-blue-600 transition-colors"
          >
            <BookOpen className="h-6 w-6 text-blue-600" />
            Bluebook Online
          </Link>
          <HeaderNav />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8 space-y-6">
        <div className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">Admin mail</h1>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Send email to registered users. Each message starts with{" "}
            <span className="font-medium text-gray-800">Hello [username]</span> and your text below.
          </p>

          <div className="mt-6 space-y-3">
            <div>
              <label htmlFor="broadcast-subject" className="block text-sm font-medium text-gray-700">
                Subject
              </label>
              <input
                id="broadcast-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                placeholder="Email subject line"
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="broadcast-body" className="block text-sm font-medium text-gray-700">
                Message
              </label>
              <textarea
                id="broadcast-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 font-sans text-sm"
                placeholder="Your message (appears after Hello username,)"
              />
            </div>
          </div>
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Recipients</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAll}
                disabled={recipients.length === 0 || listLoading}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {allSelected ? "Clear selection" : "Select all"}
              </button>
              <button
                type="button"
                onClick={() => accessToken && loadRecipients(accessToken)}
                disabled={listLoading || !accessToken}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Refresh list
              </button>
            </div>
          </div>
          <p className="mt-1 text-sm text-gray-500">
            {selected.size} selected · {recipients.length} registered
          </p>

          {listError && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {listError}
            </p>
          )}

          <div className="mt-4 max-h-72 overflow-auto rounded-md border border-gray-100">
            {listLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading recipients…
              </div>
            ) : recipients.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-500">No users in usertable.</p>
            ) : (
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-gray-50 text-gray-600">
                  <tr>
                    <th className="w-10 px-3 py-2 font-medium" scope="col">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-3 py-2 font-medium" scope="col">
                      Email
                    </th>
                    <th className="px-3 py-2 font-medium" scope="col">
                      Username
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recipients.map((r) => (
                    <tr key={r.email} className="bg-white hover:bg-gray-50/80">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(r.email)}
                          onChange={() => toggleOne(r.email)}
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                          aria-label={`Select ${r.email}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-gray-900">{r.email}</td>
                      <td className="px-3 py-2 text-gray-600">{r.username || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {sendError && (
            <p className="mt-4 text-sm text-red-600" role="alert">
              {sendError}
            </p>
          )}
          {sendResult && (
            <p className="mt-4 text-sm text-green-800 bg-green-50 rounded-md px-3 py-2" role="status">
              {sendResult}
            </p>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={handleSend}
              disabled={sendLoading || listLoading || recipients.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {sendLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send to selected
                </>
              )}
            </button>
          </div>
        </div>

        <div className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-semibold text-gray-900">Site statistics</h2>
            </div>
            <button
              type="button"
              onClick={() => accessToken && loadStats(accessToken)}
              disabled={statsLoading || !accessToken}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Refresh stats
            </button>
          </div>

          {statsError && (
            <p className="mt-3 text-sm text-red-600" role="alert">
              {statsError}
            </p>
          )}

          {statsLoading && !stats ? (
            <div className="mt-6 flex items-center justify-center gap-2 py-8 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading statistics…
            </div>
          ) : stats ? (
            <>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {[
                  { label: "Registered users", value: stats.registeredUsers },
                  { label: "Pending signups", value: stats.pendingRegistrations },
                  { label: "PDF uploads", value: stats.pdfUploadsTotal },
                  { label: "Published PDFs", value: stats.pdfPublished },
                  { label: "Unpublished PDFs", value: stats.pdfUnpublished },
                  { label: "Questions", value: stats.questionsTotal },
                  { label: "Questions with graph", value: stats.questionsWithGraph },
                  { label: "Exam attempts", value: stats.attemptsTotal },
                  { label: "Completed attempts", value: stats.attemptsCompleted },
                  { label: "In-progress attempts", value: stats.attemptsInProgress },
                  { label: "Attempt answers", value: stats.attemptAnswersTotal },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-md border border-gray-100 bg-gray-50/80 px-3 py-3"
                  >
                    <div className="text-xs font-medium text-gray-500">{item.label}</div>
                    <div className="mt-1 text-2xl font-semibold tabular-nums text-gray-900">
                      {item.value.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <h3 className="text-sm font-semibold text-gray-800">PDFs by subject</h3>
                {stats.pdfBySubject.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">No uploads grouped by subject yet.</p>
                ) : (
                  <div className="mt-3 max-h-56 overflow-auto rounded-md border border-gray-100">
                    <table className="min-w-full text-left text-sm">
                      <thead className="sticky top-0 bg-gray-50 text-gray-600">
                        <tr>
                          <th className="px-3 py-2 font-medium" scope="col">
                            Subject
                          </th>
                          <th className="px-3 py-2 font-medium text-right" scope="col">
                            PDFs
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {stats.pdfBySubject.map((row) => (
                          <tr key={row.subject} className="bg-white">
                            <td className="px-3 py-2 text-gray-900">
                              <span className="font-mono text-xs text-gray-500">{row.subject}</span>
                              <span className="ml-2 text-gray-700">{row.label}</span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-900">
                              {row.pdfCount.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
