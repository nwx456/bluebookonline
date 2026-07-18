"use client";

import { useCallback } from "react";
import type { LibrarySort, LibraryTag } from "@/lib/library-types";
import { SUBJECT_KEYS, SUBJECT_LABELS } from "@/lib/gemini-prompts";
import { getExamProgram } from "@/lib/exam-program";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

const AP_SUBJECTS = SUBJECT_KEYS.filter((k) => getExamProgram(k) === "AP");
const SAT_SUBJECTS = SUBJECT_KEYS.filter((k) => getExamProgram(k) === "SAT");

export interface LibraryToolbarState {
  q: string;
  subject: string;
  program: "" | "AP" | "SAT";
  examKind: "" | "all" | "mcq" | "frq";
  archived: boolean;
  sort: LibrarySort;
  tagIds: string[];
}

interface LibraryToolbarProps {
  value: LibraryToolbarState;
  tags: LibraryTag[];
  onChange: (next: LibraryToolbarState) => void;
  scoreMin?: string;
  scoreMax?: string;
  onScoreMinChange?: (value: string) => void;
  onScoreMaxChange?: (value: string) => void;
}

export function LibraryToolbar({
  value,
  tags,
  onChange,
  scoreMin = "",
  scoreMax = "",
  onScoreMinChange,
  onScoreMaxChange,
}: LibraryToolbarProps) {
  const patch = useCallback(
    (partial: Partial<LibraryToolbarState>) => onChange({ ...value, ...partial }),
    [onChange, value]
  );

  return (
    <div className="mb-6 space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={value.q}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder="Search title, filename, notes…"
          className="w-full rounded-md border border-gray-200 py-2 pl-9 pr-3 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <select
          value={value.examKind || "all"}
          onChange={(e) => patch({ examKind: e.target.value as LibraryToolbarState["examKind"] })}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700"
          aria-label="Exam type"
        >
          <option value="all">All types</option>
          <option value="mcq">MCQ</option>
          <option value="frq">FRQ</option>
        </select>
        <select
          value={value.program}
          onChange={(e) =>
            patch({ program: e.target.value as LibraryToolbarState["program"], subject: "" })
          }
          className="rounded-md border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">All programs</option>
          <option value="AP">AP</option>
          <option value="SAT">SAT</option>
        </select>

        <select
          value={value.subject}
          onChange={(e) => patch({ subject: e.target.value })}
          className="min-w-[160px] rounded-md border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="">All subjects</option>
          {(value.program === "SAT" ? SAT_SUBJECTS : value.program === "AP" ? AP_SUBJECTS : SUBJECT_KEYS).map(
            (key) => (
              <option key={key} value={key}>
                {SUBJECT_LABELS[key]}
              </option>
            )
          )}
        </select>

        <select
          value={value.sort}
          onChange={(e) => patch({ sort: e.target.value as LibrarySort })}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title">Title</option>
          <option value="score">Score</option>
        </select>

        <label className="inline-flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={value.archived}
            onChange={(e) => patch({ archived: e.target.checked })}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-600"
          />
          Show archived
        </label>
      </div>

      {tags.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Filter by tags
          </p>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const selected = value.tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() =>
                    patch({
                      tagIds: selected
                        ? value.tagIds.filter((id) => id !== tag.id)
                        : [...value.tagIds, tag.id],
                    })
                  }
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    selected
                      ? "border-blue-600 bg-blue-50 text-blue-800"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  )}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {onScoreMinChange && onScoreMaxChange && (
        <div className="flex flex-wrap gap-2">
          <input
            type="number"
            value={scoreMin}
            onChange={(e) => onScoreMinChange(e.target.value)}
            placeholder="Min score"
            className="w-28 rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            type="number"
            value={scoreMax}
            onChange={(e) => onScoreMaxChange(e.target.value)}
            placeholder="Max score"
            className="w-28 rounded-md border border-gray-200 px-3 py-2 text-sm"
          />
        </div>
      )}
    </div>
  );
}

export function buildLibraryQuery(state: LibraryToolbarState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  if (state.subject) params.set("subject", state.subject);
  if (state.program) params.set("program", state.program);
  if (state.examKind && state.examKind !== "all") params.set("examKind", state.examKind);
  if (state.archived) params.set("archived", "true");
  if (state.sort) params.set("sort", state.sort);
  for (const tagId of state.tagIds) params.append("tagId", tagId);
  return params.toString();
}
