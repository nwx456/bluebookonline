"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, ExternalLink, FileText, Loader2, Shield, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type ResourceRow = {
  id: string;
  title: string;
  description: string | null;
  resourceType: string;
  fileName: string | null;
  externalUrl: string | null;
  teacherUsername: string;
  moderationStatus: string;
  createdAt: string | null;
};

type TabStatus = "pending" | "published";

export default function ModeratorResourcesClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tab, setTab] = useState<TabStatus>(
    searchParams.get("status") === "published" ? "published" : "pending"
  );
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      const meRes = await fetch("/api/moderator/me", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!meRes.ok) {
        router.replace("/dashboard");
        return;
      }
      setAccessToken(session.access_token);
      setChecking(false);
    });
  }, [router]);

  const loadList = useCallback(async () => {
    if (!accessToken) return;
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(`/api/moderator/resources?status=${tab}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load resources.");
      setResources(data.resources ?? []);
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Could not load resources.");
    } finally {
      setListLoading(false);
    }
  }, [accessToken, tab]);

  useEffect(() => {
    if (!checking) loadList();
  }, [checking, loadList]);

  const runAction = async (id: string, action: "approve" | "reject") => {
    if (!accessToken) return;
    setActionId(id);
    try {
      const res = await fetch(`/api/moderator/resources/${id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Action failed.");
      }
      await loadList();
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setActionId(null);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking access…
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Shield className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Resource Moderation</h1>
          <p className="text-sm text-gray-600">Review teacher-submitted public resources.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
        {(["pending", "published"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "shrink-0 rounded-md px-4 py-2 text-sm font-medium capitalize",
              tab === t ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            {t}
          </button>
        ))}
        <Link
          href="/moderator"
          className="ml-auto shrink-0 self-center px-3 text-sm text-blue-600 hover:text-blue-700"
        >
          Exams →
        </Link>
      </div>

      {listError && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {listError}
        </div>
      )}

      {listLoading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : resources.length === 0 ? (
        <p className="text-sm text-gray-500">No resources in this queue.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
          {resources.map((r) => (
            <li key={r.id} className="px-5 py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-gray-400" />
                    <h2 className="font-medium text-gray-900">{r.title}</h2>
                  </div>
                  <p className="mt-1 text-sm text-gray-600">
                    By {r.teacherUsername} · {r.resourceType}
                  </p>
                  {r.externalUrl && (
                    <a
                      href={r.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-sm text-blue-600"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open link
                    </a>
                  )}
                </div>
                {tab === "pending" && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actionId === r.id}
                      onClick={() => runAction(r.id, "approve")}
                      className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-60"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={actionId === r.id}
                      onClick={() => runAction(r.id, "reject")}
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
