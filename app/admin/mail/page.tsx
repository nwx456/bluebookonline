"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";

type Recipient = { email: string; username: string };

type MailConfig = {
  mailConfigured: boolean;
  mailError: string | null;
  provider: string | null;
  workerKickConfigured: boolean;
  workerBaseUrl: string | null;
  mailOpsTablesReady: boolean;
  mailOpsTablesError: string | null;
};

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
  const [testOnly, setTestOnly] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [adminSessionEmail, setAdminSessionEmail] = useState("");
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [sendToAllRegistered, setSendToAllRegistered] = useState(false);
  const [mailConfig, setMailConfig] = useState<MailConfig | null>(null);
  const [mailConfigLoading, setMailConfigLoading] = useState(false);
  const [jobPollStartedAt, setJobPollStartedAt] = useState<number | null>(null);
  const [lastJobProgress, setLastJobProgress] = useState<number | null>(null);
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
      setAdminSessionEmail(session.user.email?.trim().toLowerCase() ?? "");
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

  const loadMailConfig = useCallback(async (token: string) => {
    setMailConfigLoading(true);
    try {
      const res = await fetch("/api/admin/mail/config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMailConfig(null);
        return;
      }
      setMailConfig({
        mailConfigured: data.mailConfigured === true,
        mailError: typeof data.mailError === "string" ? data.mailError : null,
        provider: typeof data.provider === "string" ? data.provider : null,
        workerKickConfigured: data.workerKickConfigured === true,
        workerBaseUrl: typeof data.workerBaseUrl === "string" ? data.workerBaseUrl : null,
        mailOpsTablesReady: data.mailOpsTablesReady === true,
        mailOpsTablesError:
          typeof data.mailOpsTablesError === "string" ? data.mailOpsTablesError : null,
      });
    } catch {
      setMailConfig(null);
    } finally {
      setMailConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken || checking) return;
    loadMailConfig(accessToken);
  }, [accessToken, checking, loadMailConfig]);

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

  useEffect(() => {
    if (!activeJobId || !accessToken) return;
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/admin/mail/jobs/${activeJobId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await res.json().catch(() => ({}));
        if (stopped || !res.ok) return;
        const job = data.job as
          | {
              status?: string;
              sent?: number;
              failed?: number;
              skipped?: number;
              cursor_index?: number;
              total_recipients?: number;
              first_error?: string | null;
            }
          | undefined;
        if (!job?.status) return;
        const cursor = job.cursor_index ?? 0;
        if (job.status === "done" || job.status === "failed") {
          const parts: string[] = [
            `Job ${job.status}. Sent: ${job.sent ?? 0}`,
            `Failed: ${job.failed ?? 0}`,
            `Skipped (not in DB): ${job.skipped ?? 0}`,
          ];
          if (job.first_error) parts.push(`First error: ${job.first_error}`);
          setSendResult(parts.join(". ") + ".");
          setActiveJobId(null);
          setJobPollStartedAt(null);
          setLastJobProgress(null);
        } else {
          setLastJobProgress(cursor);
          setSendResult(
            `Queued… ${job.status}. Progress: ${job.sent ?? 0} sent, ` +
              `${cursor} / ${job.total_recipients ?? "?"} processed.`
          );
        }
      } catch {
        /* ignore */
      }
    };
    const id = window.setInterval(poll, 2000);
    poll();
    return () => {
      stopped = true;
      window.clearInterval(id);
    };
  }, [activeJobId, accessToken]);

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
    setActiveJobId(null);

    if (!testOnly && !sendToAllRegistered && selected.size === 0) {
      setSendError("Select at least one recipient, use send to all, or enable test send.");
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
          recipientEmails: testOnly || sendToAllRegistered ? [] : [...selected],
          sendToAllRegistered: !testOnly && sendToAllRegistered,
          testOnly,
          testTo: testOnly && testTo.trim() ? testTo.trim().toLowerCase() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError(typeof data.error === "string" ? data.error : "Send failed.");
        return;
      }
      if (res.status === 202 && data.jobId) {
        setActiveJobId(String(data.jobId));
        setJobPollStartedAt(Date.now());
        setLastJobProgress(0);
        const total =
          typeof data.totalRecipients === "number" ? data.totalRecipients : recipients.length;
        setSendResult(
          `Queued broadcast to ${total} user(s) (job ${String(data.jobId).slice(0, 8)}…). ` +
            `${typeof data.skipped === "number" && data.skipped > 0 ? `Skipped addresses: ${data.skipped}. ` : ""}` +
            `${typeof data.workerWarning === "string" ? `${data.workerWarning} ` : ""}` +
            "Progress updates every few seconds."
        );
        return;
      }
      const parts: string[] = [];
      if (data.test) {
        parts.push("Test send completed");
      }
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

  const jobStalled =
    activeJobId &&
    jobPollStartedAt &&
    Date.now() - jobPollStartedAt > 5 * 60 * 1000 &&
    (lastJobProgress ?? 0) === 0;

  if (checking) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <main className="space-y-6">
        <div className="rounded-md border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" />
            <h1 className="text-xl font-semibold text-gray-900">Admin mail</h1>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            Send email to registered users. Each message starts with{" "}
            <span className="font-medium text-gray-800">Hello [username]</span> and your text below.
          </p>

          {mailConfigLoading && !mailConfig ? (
            <p className="mt-3 text-sm text-gray-500">Checking mail configuration…</p>
          ) : mailConfig ? (
            <div className="mt-3 space-y-2">
              {!mailConfig.mailConfigured && (
                <p className="text-sm text-red-600" role="alert">
                  Mail not configured: {mailConfig.mailError ?? "Unknown error."}
                </p>
              )}
              {mailConfig.mailConfigured && mailConfig.provider && (
                <p className="text-sm text-gray-600">
                  Provider: <span className="font-medium">{mailConfig.provider}</span>
                </p>
              )}
              {!mailConfig.mailOpsTablesReady && (
                <p className="text-sm text-red-600" role="alert">
                  Mail queue tables missing. Run docs/schema_mail_ops.sql in Supabase.
                  {mailConfig.mailOpsTablesError ? ` (${mailConfig.mailOpsTablesError})` : ""}
                </p>
              )}
              {mailConfig.mailConfigured &&
                mailConfig.mailOpsTablesReady &&
                !mailConfig.workerKickConfigured && (
                  <p className="text-sm text-amber-800 bg-amber-50 rounded-md px-3 py-2">
                    Worker auto-kick is off. Set MAIL_WORKER_SECRET and NEXT_PUBLIC_BASE_URL on
                    Vercel, or rely on the cron job (CRON_SECRET).
                  </p>
                )}
            </div>
          ) : null}

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
            <div className="rounded-md border border-amber-100 bg-amber-50/80 px-3 py-3 space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testOnly}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setTestOnly(next);
                    if (next) setSendToAllRegistered(false);
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                />
                <span className="text-sm font-medium text-gray-800">Test send only (one email)</span>
              </label>
              {testOnly && (
                <div>
                  <label htmlFor="test-to" className="block text-xs font-medium text-gray-600">
                    Send test to (optional, defaults to your admin address)
                  </label>
                  <input
                    id="test-to"
                    type="email"
                    value={testTo}
                    onChange={(e) => setTestTo(e.target.value)}
                    placeholder={adminSessionEmail || "you@example.com"}
                    className="mt-1 w-full max-w-md rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              )}
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
            {sendToAllRegistered
              ? `All ${recipients.length} registered users will receive this message`
              : `${selected.size} selected · ${recipients.length} registered`}
          </p>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              onClick={() => {
                setSendToAllRegistered(true);
                setTestOnly(false);
              }}
              disabled={recipients.length === 0 || listLoading || sendLoading}
              className={`w-full rounded-md border px-3 py-2.5 text-sm font-medium disabled:opacity-50 sm:w-auto sm:py-1.5 ${
                sendToAllRegistered
                  ? "border-blue-600 bg-blue-50 text-blue-800"
                  : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Send to all registered ({recipients.length})
            </button>
            {sendToAllRegistered && (
              <button
                type="button"
                onClick={() => setSendToAllRegistered(false)}
                disabled={sendLoading}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:w-auto sm:py-1.5"
              >
                Use manual selection
              </button>
            )}
          </div>

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
          {jobStalled && (
            <p className="mt-4 text-sm text-amber-900 bg-amber-50 rounded-md px-3 py-2" role="alert">
              Job has not progressed in 5+ minutes. Check MAIL_WORKER_SECRET, NEXT_PUBLIC_BASE_URL,
              and Vercel cron (CRON_SECRET) for /api/internal/mail-worker.
            </p>
          )}
          {sendResult && (
            <p
              className={`mt-4 text-sm rounded-md px-3 py-2 ${
                sendResult.includes("Failed:") || sendResult.includes("First error:")
                  ? "text-red-800 bg-red-50"
                  : "text-green-800 bg-green-50"
              }`}
              role="status"
            >
              {sendResult}
            </p>
          )}

          <div className="mt-6">
            <button
              type="button"
              onClick={handleSend}
              disabled={
                sendLoading ||
                listLoading ||
                mailConfigLoading ||
                (mailConfig !== null && !mailConfig.mailConfigured) ||
                (mailConfig !== null && !mailConfig.mailOpsTablesReady) ||
                (!testOnly &&
                  !sendToAllRegistered &&
                  (recipients.length === 0 || selected.size === 0)) ||
                (!testOnly && sendToAllRegistered && recipients.length === 0)
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 sm:w-auto"
            >
              {sendLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  {sendToAllRegistered
                    ? `Send to all (${recipients.length})`
                    : testOnly
                      ? "Send test"
                      : "Send to selected"}
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
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
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
  );
}
