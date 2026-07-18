"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileUp, Link2, Loader2, Upload } from "lucide-react";
import { ResourceFilePicker } from "@/components/teacher/ResourceFilePicker";
import { TeacherResourceCard } from "@/components/teacher/TeacherResourceCard";
import {
  teacherAuthHeaders,
  useTeacherAuth,
} from "@/components/teacher/TeacherAuthProvider";
import type { TeacherResourceItem } from "@/lib/teacher-resource-map";

export default function TeacherContentPage() {
  const { accessToken } = useTeacherAuth();
  const [resources, setResources] = useState<TeacherResourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [resourceType, setResourceType] = useState<"file" | "link">("file");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [externalUrl, setExternalUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [publishConsent, setPublishConsent] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadResources = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch("/api/teacher/resources", {
        headers: teacherAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load resources.");
      setResources(data.resources ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load resources.");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !title.trim()) return;
    if (visibility === "public" && !publishConsent) {
      setError("You must accept responsibility for publishing this resource publicly.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let storagePath: string | undefined;
      let fileName: string | undefined;
      let fileSize: number | undefined;
      let mimeType: string | undefined;

      if (resourceType === "file") {
        if (!file) throw new Error("Please select a file.");
        const signRes = await fetch("/api/teacher/resources/create-signed-url", {
          method: "POST",
          headers: {
            ...teacherAuthHeaders(accessToken),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            size: file.size,
          }),
        });
        const signData = await signRes.json();
        if (!signRes.ok) throw new Error(signData.error ?? "Upload URL failed.");

        const putRes = await fetch(signData.signedUrl, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type || "application/octet-stream" },
        });
        if (!putRes.ok) throw new Error("File upload failed.");

        storagePath = signData.storagePath;
        fileName = file.name;
        fileSize = file.size;
        mimeType = file.type || "application/octet-stream";
      }

      const res = await fetch("/api/teacher/resources", {
        method: "POST",
        headers: {
          ...teacherAuthHeaders(accessToken),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          resourceType,
          visibility,
          externalUrl: resourceType === "link" ? externalUrl.trim() : undefined,
          storagePath,
          fileName,
          fileSize,
          mimeType,
          publishConsent: visibility === "public" ? true : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save resource.");

      setShowAdd(false);
      setTitle("");
      setDescription("");
      setExternalUrl("");
      setFile(null);
      setPublishConsent(false);
      setVisibility("private");
      await loadResources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save resource.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">My Content</h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload exams via the{" "}
            <Link href="/dashboard/upload" className="text-blue-600 hover:underline">
              Upload page
            </Link>
            . Add PDFs, documents, or links as class resources here.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <FileUp className="h-4 w-4" />
          Add Resource
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <Upload className="mt-0.5 h-5 w-5 text-blue-600" />
          <div>
            <h2 className="font-medium text-gray-900">Exams</h2>
            <p className="mt-1 text-sm text-gray-600">
              Use the existing exam upload pipeline. Assign exams to classes from each class page.
            </p>
            <Link
              href="/dashboard/upload"
              className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Go to Upload →
            </Link>
          </div>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Resources
      </h2>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : resources.length === 0 ? (
        <p className="text-sm text-gray-500">No resources yet.</p>
      ) : (
        <div className="space-y-3">
          {resources.map((resource) =>
            accessToken ? (
              <TeacherResourceCard
                key={resource.id}
                resource={resource}
                accessToken={accessToken}
                onUpdated={(updated) =>
                  setResources((prev) =>
                    prev.map((item) => (item.id === updated.id ? updated : item))
                  )
                }
                onDeleted={(id) =>
                  setResources((prev) => prev.filter((item) => item.id !== id))
                }
                onError={setError}
              />
            ) : null
          )}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900">Add Resource</h2>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setResourceType("file")}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                    resourceType === "file" ? "border-blue-600 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  File
                </button>
                <button
                  type="button"
                  onClick={() => setResourceType("link")}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                    resourceType === "link" ? "border-blue-600 bg-blue-50" : "border-gray-200"
                  }`}
                >
                  <Link2 className="mr-1 inline h-4 w-4" />
                  Link
                </button>
              </div>
              {resourceType === "file" ? (
                <ResourceFilePicker file={file} onFileChange={setFile} disabled={saving} />
              ) : (
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                  required
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                />
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700">Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value === "public" ? "public" : "private")
                  }
                  className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                >
                  <option value="private">Private (class assignments only)</option>
                  <option value="public">Public (platform-wide after moderation)</option>
                </select>
              </div>
              {visibility === "public" && (
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={publishConsent}
                    onChange={(e) => setPublishConsent(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    I understand this resource will be published under my name on the platform. I
                    accept full responsibility for its content and confirm it complies with our
                    privacy and copyright policies. It will be reviewed by a moderator before going
                    live.
                  </span>
                </label>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="rounded-md px-4 py-2 text-sm text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <section className="mt-10 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">FRQ Exams</h2>
        <p className="mt-1 text-sm text-gray-600">
          Upload and assign fully digital AP Free Response exams (16 Bluebook courses).
        </p>
        <Link
          href="/dashboard/upload?kind=frq"
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Manage FRQ Exams
        </Link>
      </section>
    </div>
  );
}
