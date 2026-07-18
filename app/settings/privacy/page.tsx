"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { CONSENT_LABELS } from "@/lib/legal/policy-versions";
import type { ConsentType } from "@/lib/legal/policy-versions";
import { DATA_EXPORT_PREFIX } from "@/lib/site-config";

type ConsentMap = Partial<Record<ConsentType, boolean>>;

export default function PrivacySettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [consents, setConsents] = useState<ConsentMap>({});
  const [marketing, setMarketing] = useState(false);
  const [legalRegion, setLegalRegion] = useState<string>("ROW");
  const [message, setMessage] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (accessToken: string) => {
    const res = await fetch("/api/user/consents", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.status === 401) {
      router.replace("/login?next=/settings/privacy");
      return;
    }
    const data = await res.json();
    setConsents(data.consents ?? {});
    setMarketing(data.profile?.marketing_opt_in === true);
    setLegalRegion(data.profile?.legal_region ?? "ROW");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.access_token) {
        router.replace("/login?next=/settings/privacy");
        return;
      }
      setToken(session.access_token);
      load(session.access_token);
    });
  }, [load, router]);

  const updateMarketing = async (granted: boolean) => {
    if (!token) return;
    setMessage(null);
    const res = await fetch("/api/user/consents", {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ consentType: "marketing", granted }),
    });
    if (res.ok) {
      setMarketing(granted);
      setMessage(granted ? "Marketing emails enabled." : "Marketing emails disabled.");
    } else {
      setMessage("Could not update preference.");
    }
  };

  const handleExport = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const res = await fetch("/api/user/data-export", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${DATA_EXPORT_PREFIX}-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!token || deleteConfirm !== "DELETE") return;
    setDeleting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (res.ok) {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace("/?account-deleted=1");
      } else {
        setMessage("Account deletion failed.");
      }
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB]">
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center text-gray-500">Loading…</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold text-gray-900">Privacy settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Legal region: <span className="font-medium">{legalRegion}</span> · Manage your data and consents
        </p>
        <p className="mt-2 text-sm text-gray-600">
          <Link href="/privacy" className="text-blue-600 hover:underline">
            Full Privacy Policy
          </Link>
          {" · "}
          <Link href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </Link>
          {" · "}
          <Link href="/copyright" className="text-blue-600 hover:underline">
            Copyright Policy
          </Link>
          {" · "}
          <Link href="/legal" className="text-blue-600 hover:underline">
            Legal center
          </Link>
        </p>

        {message && (
          <p className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800" role="status">
            {message}
          </p>
        )}

        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Your consents</h2>
          <ul className="mt-4 space-y-2 text-sm text-gray-700">
            {(Object.keys(CONSENT_LABELS) as ConsentType[]).map((key) => (
              <li key={key} className="flex justify-between gap-4">
                <span>{CONSENT_LABELS[key]}</span>
                <span className={consents[key] ? "text-green-700" : "text-gray-400"}>
                  {consents[key] ? "Granted" : "Not granted"}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Marketing emails</h2>
          <p className="mt-2 text-sm text-gray-600">
            Receive product updates and announcements (optional, can be withdrawn anytime).
          </p>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={marketing}
              onChange={(e) => updateMarketing(e.target.checked)}
              className="rounded border-gray-300"
            />
            I agree to receive marketing emails
          </label>
        </section>

        {(legalRegion === "US" || legalRegion === "ROW") && (
          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Do Not Sell or Share</h2>
            <p className="mt-2 text-sm text-gray-600">
              Decline optional analytics/advertising cookies via our{" "}
              <Link href="/cookies" className="text-blue-600 hover:underline">
                Cookie Policy
              </Link>
              . Clear site data or choose &quot;Essential only&quot; in the cookie banner.
            </p>
          </section>
        )}

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Download your data</h2>
          <p className="mt-2 text-sm text-gray-600">Export a JSON copy of your profile, uploads, attempts, and consents.</p>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="mt-4 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {exporting ? "Preparing…" : "Download data"}
          </button>
        </section>

        <section className="mt-6 rounded-xl border border-red-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-red-800">Delete account</h2>
          <p className="mt-2 text-sm text-gray-600">
            Permanently delete your account, uploads, attempts, and consents. This cannot be undone.
          </p>
          <input
            type="text"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder='Type DELETE to confirm'
            className="mt-4 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || deleteConfirm !== "DELETE"}
            className="mt-3 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
