"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, ExternalLink, Eye, FileText, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { createClient } from "@/lib/supabase/client";
import {
  downloadResourceFile,
  openResourceLink,
  viewResource,
} from "@/lib/open-resource";
import { cn } from "@/lib/utils";

type ResourceRow = {
  id: string;
  title: string;
  description: string | null;
  resourceType: string;
  fileName: string | null;
  externalUrl: string | null;
  teacherUsername: string;
  createdAt: string | null;
};

function PublicResourcesPageContent() {
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const highlightRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAccessToken(session?.access_token ?? null);
    });
    fetch("/api/resources/published")
      .then((r) => r.json())
      .then((data) => setResources(data.resources ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!highlightId || loading) return;
    highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightId, loading, resources.length]);

  const authHeaders = accessToken ? { Authorization: `Bearer ${accessToken}` } : null;

  const requireAuthForFile = () => {
    if (accessToken) return true;
    window.location.href = `/login?next=/resources${highlightId ? `?highlight=${highlightId}` : ""}`;
    return false;
  };

  const handleView = async (resource: ResourceRow) => {
    setActionError(null);
    if (resource.externalUrl) {
      openResourceLink(resource.externalUrl);
      return;
    }
    if (!requireAuthForFile() || !authHeaders) return;
    setBusyId(resource.id);
    try {
      await viewResource(resource.id, authHeaders);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Could not open resource.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (resource: ResourceRow) => {
    setActionError(null);
    if (resource.externalUrl) {
      openResourceLink(resource.externalUrl);
      return;
    }
    if (!requireAuthForFile() || !authHeaders) return;
    setBusyId(resource.id);
    try {
      await downloadResourceFile(resource.id, authHeaders, resource.fileName ?? resource.title);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <h1 className="text-xl font-semibold text-gray-900">Teacher Resources</h1>
        <p className="mt-1 text-sm text-gray-600">
          Public study materials shared by teachers on the platform.
        </p>

        {actionError && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        )}

        {loading ? (
          <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : resources.length === 0 ? (
          <p className="mt-8 text-sm text-gray-500">No public resources yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
            {resources.map((r) => {
              const isHighlighted = highlightId === r.id;
              const isBusy = busyId === r.id;
              return (
                <li
                  key={r.id}
                  ref={isHighlighted ? highlightRef : undefined}
                  className={cn(
                    "flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between",
                    isHighlighted && "bg-amber-50/80 ring-1 ring-inset ring-amber-200"
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{r.title}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      Shared by {r.teacherUsername}
                      {r.resourceType === "file" && r.fileName ? ` · ${r.fileName}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {r.resourceType === "link" ? (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleView(r)}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                      >
                        {isBusy ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ExternalLink className="h-4 w-4" />
                        )}
                        Open link
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleView(r)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          {isBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                          View
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleDownload(r)}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="mt-6 text-sm text-gray-500">
          <Link href="/exams" className="text-blue-600 hover:underline">
            Browse practice tests
          </Link>
        </p>
      </main>
    </div>
  );
}

export default function PublicResourcesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F9FAFB]">
          <SiteHeader />
          <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
            <div className="mt-8 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          </main>
        </div>
      }
    >
      <PublicResourcesPageContent />
    </Suspense>
  );
}
