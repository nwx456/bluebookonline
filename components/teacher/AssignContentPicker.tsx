"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Search } from "lucide-react";
import { teacherAuthHeaders } from "@/components/teacher/TeacherAuthProvider";
import type {
  AssignableContentResponse,
  AssignableFrqExam,
  AssignableMcqExam,
  AssignableResource,
  AssignKind,
} from "@/components/teacher/assign-content-types";
import {
  deriveFrqCourses,
  deriveMcqSubjects,
  filterFrqExams,
  filterMcqExams,
  filterResources,
  type FrqFilterState,
  type McqFilterState,
  type ResourceFilterState,
} from "@/lib/assign-content-filters";
import { cn } from "@/lib/utils";

type Props = {
  classId: string;
  accessToken: string;
  assigning: boolean;
  onAssign: (payload: {
    kind: AssignKind;
    uploadId?: string;
    frqUploadId?: string;
    resourceId?: string;
    dueAt?: string;
  }) => Promise<void>;
  onClose: () => void;
};

const defaultMcqFilters: McqFilterState = {
  search: "",
  program: "all",
  subject: "",
  source: "all",
  questionCount: "all",
  sort: "newest",
};

const defaultFrqFilters: FrqFilterState = {
  search: "",
  courseId: "",
  questionCount: "all",
  sort: "newest",
};

const defaultResourceFilters: ResourceFilterState = {
  search: "",
  resourceType: "all",
  visibility: "all",
  sort: "newest",
};

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm"
      >
        {children}
      </select>
    </div>
  );
}

function AlreadyAssignedBadge() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
      Already assigned
    </span>
  );
}

export function AssignContentPicker({
  classId,
  accessToken,
  assigning,
  onAssign,
  onClose,
}: Props) {
  const [kind, setKind] = useState<AssignKind>("exam");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState<AssignableContentResponse | null>(null);
  const [mcqFilters, setMcqFilters] = useState(defaultMcqFilters);
  const [frqFilters, setFrqFilters] = useState(defaultFrqFilters);
  const [resourceFilters, setResourceFilters] = useState(defaultResourceFilters);
  const [selectedMcqId, setSelectedMcqId] = useState("");
  const [selectedFrqId, setSelectedFrqId] = useState("");
  const [selectedResourceId, setSelectedResourceId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const loadContent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/teacher/assignable-content?classId=${encodeURIComponent(classId)}`,
        { headers: teacherAuthHeaders(accessToken) }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load content.");
      setContent(data as AssignableContentResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load content.");
    } finally {
      setLoading(false);
    }
  }, [accessToken, classId]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const mcqSubjects = useMemo(
    () => deriveMcqSubjects(content?.mcqExams ?? []),
    [content?.mcqExams]
  );
  const frqCourses = useMemo(
    () => deriveFrqCourses(content?.frqExams ?? []),
    [content?.frqExams]
  );

  const filteredMcq = useMemo(
    () => filterMcqExams(content?.mcqExams ?? [], mcqFilters),
    [content?.mcqExams, mcqFilters]
  );
  const filteredFrq = useMemo(
    () => filterFrqExams(content?.frqExams ?? [], frqFilters),
    [content?.frqExams, frqFilters]
  );
  const filteredResources = useMemo(
    () => filterResources(content?.resources ?? [], resourceFilters),
    [content?.resources, resourceFilters]
  );

  const previewMcq = (id: string) => {
    window.open(`/exam/${id}`, "_blank", "noopener,noreferrer");
  };

  const previewFrq = (id: string) => {
    window.open(`/frq/${id}`, "_blank", "noopener,noreferrer");
  };

  const previewResource = async (resource: AssignableResource) => {
    if (resource.resourceType === "link" && resource.externalUrl) {
      window.open(resource.externalUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setPreviewingId(resource.id);
    try {
      const res = await fetch(`/api/resources/${resource.id}/download`, {
        headers: teacherAuthHeaders(accessToken),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Preview failed.");
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setPreviewingId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === "exam") {
      if (!selectedMcqId) return;
      await onAssign({ kind, uploadId: selectedMcqId, dueAt: dueAt || undefined });
    } else if (kind === "frq_exam") {
      if (!selectedFrqId) return;
      await onAssign({ kind, frqUploadId: selectedFrqId, dueAt: dueAt || undefined });
    } else {
      if (!selectedResourceId) return;
      await onAssign({ kind, resourceId: selectedResourceId });
    }
  };

  const canAssign =
    kind === "exam"
      ? Boolean(selectedMcqId)
      : kind === "frq_exam"
        ? Boolean(selectedFrqId)
        : Boolean(selectedResourceId);

  return (
    <form onSubmit={handleSubmit} className="flex max-h-[85vh] flex-col">
      <div className="flex shrink-0 gap-2">
        {(
          [
            ["exam", "MCQ Exam"],
            ["frq_exam", "FRQ Exam"],
            ["resource", "Resource"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={cn(
              "flex-1 rounded-md border px-3 py-2 text-sm",
              kind === value ? "border-blue-600 bg-blue-50 text-blue-900" : "border-gray-200"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 py-12 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading content…
        </div>
      ) : error && !content ? (
        <p className="py-8 text-center text-sm text-red-600">{error}</p>
      ) : (
        <>
          {error && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          {kind === "exam" && (
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search exams…"
                  value={mcqFilters.search}
                  onChange={(e) => setMcqFilters((prev) => ({ ...prev, search: e.target.value }))}
                  className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <FilterSelect
                  label="Program"
                  value={mcqFilters.program}
                  onChange={(program) =>
                    setMcqFilters((prev) => ({
                      ...prev,
                      program: program as McqFilterState["program"],
                    }))
                  }
                >
                  <option value="all">All</option>
                  <option value="AP">AP</option>
                  <option value="SAT">SAT</option>
                </FilterSelect>
                <FilterSelect
                  label="Subject"
                  value={mcqFilters.subject}
                  onChange={(subject) => setMcqFilters((prev) => ({ ...prev, subject }))}
                >
                  <option value="">All subjects</option>
                  {mcqSubjects.map((subject) => {
                    const label =
                      content?.mcqExams.find((item) => item.subject === subject)?.subjectLabel ??
                      subject;
                    return (
                      <option key={subject} value={subject}>
                        {label}
                      </option>
                    );
                  })}
                </FilterSelect>
                <FilterSelect
                  label="Source"
                  value={mcqFilters.source}
                  onChange={(source) =>
                    setMcqFilters((prev) => ({
                      ...prev,
                      source: source as McqFilterState["source"],
                    }))
                  }
                >
                  <option value="all">All</option>
                  <option value="mine">Mine</option>
                  <option value="public">Public</option>
                </FilterSelect>
                <FilterSelect
                  label="Questions"
                  value={mcqFilters.questionCount}
                  onChange={(questionCount) =>
                    setMcqFilters((prev) => ({
                      ...prev,
                      questionCount: questionCount as McqFilterState["questionCount"],
                    }))
                  }
                >
                  <option value="all">All</option>
                  <option value="1-20">1–20</option>
                  <option value="21-40">21–40</option>
                  <option value="41+">41+</option>
                </FilterSelect>
                <FilterSelect
                  label="Sort"
                  value={mcqFilters.sort}
                  onChange={(sort) =>
                    setMcqFilters((prev) => ({
                      ...prev,
                      sort: sort as McqFilterState["sort"],
                    }))
                  }
                >
                  <option value="newest">Newest</option>
                  <option value="title">Title A–Z</option>
                  <option value="most_questions">Most questions</option>
                </FilterSelect>
              </div>
              <McqList
                items={filteredMcq}
                selectedId={selectedMcqId}
                onSelect={setSelectedMcqId}
                onPreview={previewMcq}
              />
            </div>
          )}

          {kind === "frq_exam" && (
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search FRQ exams…"
                  value={frqFilters.search}
                  onChange={(e) => setFrqFilters((prev) => ({ ...prev, search: e.target.value }))}
                  className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <FilterSelect
                  label="Course"
                  value={frqFilters.courseId}
                  onChange={(courseId) => setFrqFilters((prev) => ({ ...prev, courseId }))}
                >
                  <option value="">All courses</option>
                  {frqCourses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.label}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect
                  label="Questions"
                  value={frqFilters.questionCount}
                  onChange={(questionCount) =>
                    setFrqFilters((prev) => ({
                      ...prev,
                      questionCount: questionCount as FrqFilterState["questionCount"],
                    }))
                  }
                >
                  <option value="all">All</option>
                  <option value="1-20">1–20</option>
                  <option value="21-40">21–40</option>
                  <option value="41+">41+</option>
                </FilterSelect>
                <FilterSelect
                  label="Sort"
                  value={frqFilters.sort}
                  onChange={(sort) =>
                    setFrqFilters((prev) => ({
                      ...prev,
                      sort: sort as FrqFilterState["sort"],
                    }))
                  }
                >
                  <option value="newest">Newest</option>
                  <option value="title">Title A–Z</option>
                </FilterSelect>
              </div>
              {filteredFrq.length === 0 && (content?.frqExams.length ?? 0) === 0 ? (
                <p className="text-sm text-gray-500">
                  Upload FRQ exams from{" "}
                  <Link href="/dashboard/upload?kind=frq" className="text-blue-600 hover:underline">
                    Dashboard → Upload → FRQ
                  </Link>
                </p>
              ) : (
                <FrqList
                  items={filteredFrq}
                  selectedId={selectedFrqId}
                  onSelect={setSelectedFrqId}
                  onPreview={previewFrq}
                />
              )}
            </div>
          )}

          {kind === "resource" && (
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  placeholder="Search resources…"
                  value={resourceFilters.search}
                  onChange={(e) =>
                    setResourceFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <FilterSelect
                  label="Type"
                  value={resourceFilters.resourceType}
                  onChange={(resourceType) =>
                    setResourceFilters((prev) => ({
                      ...prev,
                      resourceType: resourceType as ResourceFilterState["resourceType"],
                    }))
                  }
                >
                  <option value="all">All</option>
                  <option value="file">File</option>
                  <option value="link">Link</option>
                </FilterSelect>
                <FilterSelect
                  label="Visibility"
                  value={resourceFilters.visibility}
                  onChange={(visibility) =>
                    setResourceFilters((prev) => ({
                      ...prev,
                      visibility: visibility as ResourceFilterState["visibility"],
                    }))
                  }
                >
                  <option value="all">All</option>
                  <option value="private">Private</option>
                  <option value="public">Public</option>
                </FilterSelect>
                <FilterSelect
                  label="Sort"
                  value={resourceFilters.sort}
                  onChange={(sort) =>
                    setResourceFilters((prev) => ({
                      ...prev,
                      sort: sort as ResourceFilterState["sort"],
                    }))
                  }
                >
                  <option value="newest">Newest</option>
                  <option value="title">Title A–Z</option>
                </FilterSelect>
              </div>
              <ResourceList
                items={filteredResources}
                selectedId={selectedResourceId}
                onSelect={setSelectedResourceId}
                onPreview={previewResource}
                previewingId={previewingId}
              />
            </div>
          )}
        </>
      )}

      <div className="mt-4 shrink-0 space-y-3 border-t border-gray-100 pt-4">
        {(kind === "exam" || kind === "frq_exam") && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Due date (optional)</label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
            />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={assigning || loading || !canAssign}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {assigning ? "Assigning…" : "Assign"}
          </button>
        </div>
      </div>
    </form>
  );
}

function McqList({
  items,
  selectedId,
  onSelect,
  onPreview,
}: {
  items: AssignableMcqExam[];
  selectedId: string;
  onSelect: (id: string) => void;
  onPreview: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No exams match your filters.</p>;
  }

  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            "rounded-lg border p-3 transition-colors",
            selectedId === item.id ? "border-blue-500 bg-blue-50/50" : "border-gray-200"
          )}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="mcq-selection"
              checked={selectedId === item.id}
              onChange={() => onSelect(item.id)}
              className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-gray-900">{item.title}</p>
                {item.alreadyAssigned && <AlreadyAssignedBadge />}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Chip>{item.examProgram}</Chip>
                <Chip>{item.subjectLabel}</Chip>
                <Chip>{item.questionCount} questions</Chip>
                <Chip>{item.source === "mine" ? "Mine" : "Public"}</Chip>
                {item.source === "public" && item.ownerUsername && (
                  <Chip>by {item.ownerUsername}</Chip>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onPreview(item.id)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-3 w-3" />
              Preview
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function FrqList({
  items,
  selectedId,
  onSelect,
  onPreview,
}: {
  items: AssignableFrqExam[];
  selectedId: string;
  onSelect: (id: string) => void;
  onPreview: (id: string) => void;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No FRQ exams match your filters.</p>;
  }

  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            "rounded-lg border p-3 transition-colors",
            selectedId === item.id ? "border-blue-500 bg-blue-50/50" : "border-gray-200"
          )}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="frq-selection"
              checked={selectedId === item.id}
              onChange={() => onSelect(item.id)}
              className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-gray-900">{item.title}</p>
                {item.alreadyAssigned && <AlreadyAssignedBadge />}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Chip>{item.courseLabel}</Chip>
                <Chip>{item.questionCount} questions</Chip>
                <Chip>{item.maxScore} pts max</Chip>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onPreview(item.id)}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              <ExternalLink className="h-3 w-3" />
              Preview
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ResourceList({
  items,
  selectedId,
  onSelect,
  onPreview,
  previewingId,
}: {
  items: AssignableResource[];
  selectedId: string;
  onSelect: (id: string) => void;
  onPreview: (resource: AssignableResource) => void;
  previewingId: string | null;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-500">No resources match your filters.</p>;
  }

  return (
    <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
      {items.map((item) => (
        <li
          key={item.id}
          className={cn(
            "rounded-lg border p-3 transition-colors",
            selectedId === item.id ? "border-blue-500 bg-blue-50/50" : "border-gray-200"
          )}
        >
          <div className="flex items-start gap-3">
            <input
              type="radio"
              name="resource-selection"
              checked={selectedId === item.id}
              onChange={() => onSelect(item.id)}
              className="mt-1"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-gray-900">{item.title}</p>
                {item.alreadyAssigned && <AlreadyAssignedBadge />}
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Chip>{item.resourceType === "file" ? "File" : "Link"}</Chip>
                <Chip>{item.visibility === "public" ? "Public" : "Private"}</Chip>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onPreview(item)}
              disabled={previewingId === item.id}
              className="inline-flex shrink-0 items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {previewingId === item.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <ExternalLink className="h-3 w-3" />
              )}
              Preview
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">{children}</span>
  );
}
