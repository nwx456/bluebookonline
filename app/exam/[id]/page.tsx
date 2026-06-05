"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  ChevronDown,
  Delete,
  Eraser,
  Highlighter,
  Calculator,
  Maximize2,
  Minus,
  MoreHorizontal,
  Plus,
  RotateCcw,
  RotateCw,
  StickyNote,
  Superscript,
  Wrench,
  X,
  CheckCircle,
  XCircle,
  CircleDashed,
  Clock,
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Save,
} from "lucide-react";
import { ExamHeader } from "@/app/exam/ExamHeader";
import { ExamFooter, ExamFooterQuestionNav } from "@/app/exam/ExamFooter";
import { ExamQuestionChrome } from "@/app/exam/ExamQuestionChrome";
import {
  examContentSerifClass,
  examUi,
  formatDisplayUsername,
  formatExamHeaderTitle,
} from "@/app/exam/exam-ui-tokens";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { SUBJECT_KEYS, SUBJECT_LABELS, isCodeSubject, type SubjectKey } from "@/lib/gemini-prompts";
import { partitionStemAndSharedIntro } from "@/lib/shared-stimulus";
import { partitionSatStemAndPassage } from "@/lib/sat-ingest-postprocess";
import { parseBulletPassage } from "@/lib/passage-display";
import {
  getExamProgram,
  isSatFullTest,
  isSatMath,
  isSatSubject,
  isSatRw,
  requiresDesmos as satRequiresDesmos,
  pickSatM2Variant,
  SAT_MODULES,
  type SatModuleId,
  type SatSection,
} from "@/lib/exam-program";
import { gridInAnswerMatches } from "@/lib/ai-solve-prompts";
import {
  getModuleDisplayNumber,
  getSatModuleGroups,
  type SatModuleGroup,
} from "@/lib/sat-question-display";
import { GraphZoomProvider, GraphZoomHeaderToolbar } from "./GraphZoomContext";
import { DesmosCalculator } from "@/components/DesmosCalculator";
import {
  SatModuleResultOverlay,
  type ModuleScoreResult,
} from "@/app/exam/SatModuleResultOverlay";

const PdfPageView = dynamic(() => import("./PdfPageView"), { ssr: false });
const TableImageView = dynamic(() => import("./TableImageView"), { ssr: false });
const ZoomableImagePanel = dynamic(() => import("./ZoomableImagePanel"), { ssr: false });
const FullPageModal = dynamic(() => import("./FullPageModal"), { ssr: false });
const SafeStorageImage = dynamic(() => import("./SafeStorageImage"), { ssr: false });
const PdfExplorePanel = dynamic(() => import("./PdfExplorePanel"), { ssr: false });

const TABLE_FALLBACK_CLASS =
  "overflow-auto max-w-full [&_table]:table-auto [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-gray-300 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium [&_th]:text-left [&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2.5";

const PRE_START_UNLOCK_SECONDS = 10;

/** AP CSA Java Quick Reference - Class Constructors and Methods */
const JAVA_QUICK_REFERENCE: { className: string; methods: { signature: string; explanation: string }[] }[] = [
  {
    className: "String",
    methods: [
      { signature: "String(String str)", explanation: "Constructs a new String object that represents the same sequence of characters as str." },
      { signature: "int length()", explanation: "Returns the number of characters in a String object." },
      { signature: "String substring(int from, int to)", explanation: "Returns a new String containing the characters from index from to index to - 1." },
      { signature: "String substring(int from)", explanation: "Returns a new String from index from to the end." },
      { signature: "int indexOf(String str)", explanation: "Returns the index of the first occurrence of str, or -1 if not found." },
      { signature: "boolean equals(String other)", explanation: "Returns true if this string is equal to other; false otherwise." },
      { signature: "int compareTo(String other)", explanation: "Returns a negative value if this string comes before other, 0 if equal, positive if after." },
    ],
  },
  {
    className: "Integer",
    methods: [
      { signature: "Integer(int value)", explanation: "Constructs an Integer object representing value." },
      { signature: "Integer.MIN_VALUE", explanation: "The minimum value represented by an int or Integer." },
      { signature: "Integer.MAX_VALUE", explanation: "The maximum value represented by an int or Integer." },
      { signature: "static int parseInt(String s)", explanation: "Returns the String argument as an int." },
      { signature: "int intValue()", explanation: "Returns the int value of this Integer." },
    ],
  },
  {
    className: "Double",
    methods: [
      { signature: "Double(double value)", explanation: "Constructs a Double object representing value." },
      { signature: "double doubleValue()", explanation: "Returns the double value of this Double." },
    ],
  },
  {
    className: "Math",
    methods: [
      { signature: "static int abs(int x)", explanation: "Returns the absolute value of x." },
      { signature: "static double abs(double x)", explanation: "Returns the absolute value of x." },
      { signature: "static double pow(double base, double exponent)", explanation: "Returns base raised to the power of exponent." },
      { signature: "static double sqrt(double x)", explanation: "Returns the square root of x." },
      { signature: "static double random()", explanation: "Returns a value in the range [0.0, 1.0)." },
    ],
  },
  {
    className: "ArrayList",
    methods: [
      { signature: "int size()", explanation: "Returns the number of elements in the list." },
      { signature: "boolean add(E obj)", explanation: "Adds obj to the end of the list; returns true." },
      { signature: "void add(int index, E obj)", explanation: "Inserts obj at index; shifts subsequent elements right." },
      { signature: "E get(int index)", explanation: "Returns the element at index." },
      { signature: "E set(int index, E obj)", explanation: "Replaces element at index with obj; returns the previous element." },
      { signature: "E remove(int index)", explanation: "Removes and returns the element at index; shifts subsequent elements left." },
    ],
  },
  {
    className: "File",
    methods: [
      { signature: "File(String pathname)", explanation: "Constructs a File object from the given pathname." },
      { signature: "boolean exists()", explanation: "Returns true if the file or directory exists; false otherwise." },
      { signature: "String getName()", explanation: "Returns the name of the file or directory." },
      { signature: "boolean isFile()", explanation: "Returns true if this pathname refers to a file." },
      { signature: "boolean isDirectory()", explanation: "Returns true if this pathname refers to a directory." },
      { signature: "long length()", explanation: "Returns the length of the file in bytes, or 0 if not a file." },
    ],
  },
  {
    className: "Scanner",
    methods: [
      { signature: "Scanner(InputStream source)", explanation: "Constructs a Scanner that reads from the given InputStream." },
      { signature: "Scanner(File source)", explanation: "Constructs a Scanner that reads from the given File." },
      { signature: "boolean hasNext()", explanation: "Returns true if there is another token in the input." },
      { signature: "String next()", explanation: "Returns the next token as a String." },
      { signature: "int nextInt()", explanation: "Returns the next token as an int." },
      { signature: "double nextDouble()", explanation: "Returns the next token as a double." },
      { signature: "void close()", explanation: "Closes this Scanner." },
    ],
  },
  {
    className: "Object",
    methods: [
      { signature: "boolean equals(Object other)", explanation: "Returns true if this object is equal to other; false otherwise." },
      { signature: "String toString()", explanation: "Returns a string representation of this object." },
    ],
  },
];

const UPLOAD_SELECT_FIELDS =
  "id, subject, filename, storage_path, exam_program, sat_format, sat_adaptive_mode, sat_cutoff_rw, sat_cutoff_math";

type SubjectValue = SubjectKey;

interface PdfUpload {
  id: string;
  subject: string | null;
  filename: string | null;
  storage_path?: string | null;
  exam_program?: string | null;
  sat_format?: string | null;
  sat_adaptive_mode?: string | null;
  sat_cutoff_rw?: number | null;
  sat_cutoff_math?: number | null;
}

interface Question {
  id: string;
  upload_id: string;
  question_number: number;
  question_text: string;
  passage_text: string | null;
  precondition_text?: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
  correct_answer: string | null;
  has_graph?: boolean | null;
  page_number?: number | null;
  bbox?: { x: number; y: number; width: number; height: number } | null;
  image_url?: string | null;
  question_type?: "mcq" | "grid_in" | null;
  accepted_answers?: string[] | null;
  sat_section?: "rw" | "math" | null;
  sat_module?: number | null;
  sat_module_variant?: "easy" | "hard" | null;
  sat_difficulty?: "easy" | "medium" | "hard" | null;
}

const SUBJECTS = SUBJECT_KEYS.map((v) => ({ value: v, label: SUBJECT_LABELS[v] }));

function formatSatMarkedReviewLabel(
  q: Question,
  allQuestions: Question[],
  isSatFullExam: boolean
): string {
  const num = getModuleDisplayNumber(allQuestions, q);
  if (!isSatFullExam) return `Question ${num}`;
  const moduleId = `${q.sat_section === "rw" ? "rw" : "math"}${q.sat_module}` as SatModuleId;
  const short = SAT_MODULES.find((m) => m.id === moduleId)?.shortLabel ?? "Module";
  return `${short} #${num}`;
}

function SatMarkedForReviewWarning({
  items,
  allQuestions,
  isSatFullExam,
}: {
  items: Question[];
  allQuestions: Question[];
  isSatFullExam: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-amber-900">Review before you submit</p>
      <p className="mt-1 text-sm text-amber-800">
        You marked {items.length} question{items.length === 1 ? "" : "s"} for review. Check them
        before continuing.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((q) => (
          <span
            key={q.id}
            className="inline-block rounded border border-amber-200 bg-white px-2 py-1 text-sm font-medium text-amber-900"
          >
            {formatSatMarkedReviewLabel(q, allQuestions, isSatFullExam)}
          </span>
        ))}
      </div>
    </div>
  );
}

function isSatM1AnswerCorrect(q: Question, userAnswer: string | undefined): boolean {
  if (!userAnswer?.trim()) return false;
  const correctRaw = q.correct_answer?.toString().trim() ?? "";
  if (!correctRaw) return false;
  if (q.question_type === "grid_in") {
    const accepted =
      Array.isArray(q.accepted_answers) && q.accepted_answers.length > 0
        ? q.accepted_answers
        : [correctRaw];
    return gridInAnswerMatches(userAnswer.trim(), accepted);
  }
  return userAnswer.toUpperCase() === correctRaw.toUpperCase();
}

function questionMatchesSatModuleBase(
  q: Question,
  section: SatSection,
  module: 1 | 2
): boolean {
  return q.sat_section === section && q.sat_module === module;
}

const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;

const CALCULATOR_ALLOWED_SUBJECTS = new Set([
  "AP_MICROECONOMICS",
  "AP_MACROECONOMICS",
  "AP_BIOLOGY",
  "AP_CHEMISTRY",
  "AP_ENVIRONMENTAL_SCIENCE",
  "AP_PHYSICS_1",
  "AP_PHYSICS_2",
  "AP_PHYSICS_C_MECH",
  "AP_PHYSICS_C_EM",
  "AP_STATISTICS",
]);

const HIGHLIGHT_COLORS: Record<string, string> = {
  yellow: "bg-yellow-200",
  blue: "bg-blue-200",
  pink: "bg-pink-200",
};

type HighlightRange = { start: number; end: number; color: string };

function renderTextWithHighlights(
  text: string,
  highlightRanges: HighlightRange[]
): React.ReactNode {
  if (!text) return null;
  if (!highlightRanges.length) return text;
  const sorted = [...highlightRanges].sort((a, b) => a.start - b.start);
  const merged: HighlightRange[] = [];
  for (const h of sorted) {
    const start = Math.max(0, h.start);
    const end = Math.min(text.length, h.end);
    if (start >= end) continue;
    const next = merged.filter((m) => !(m.start < end && m.end > start));
    next.push({ start, end, color: h.color });
    merged.length = 0;
    merged.push(...next.sort((a, b) => a.start - b.start));
  }
  const segments: Array<{ text: string; color?: string }> = [];
  let pos = 0;
  for (const m of merged.sort((a, b) => a.start - b.start)) {
    if (pos < m.start) segments.push({ text: text.slice(pos, m.start) });
    segments.push({ text: text.slice(m.start, m.end), color: m.color });
    pos = m.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) });
  return segments.map((s, i) =>
    s.color ? (
      <span key={i} className={HIGHLIGHT_COLORS[s.color] ?? "bg-yellow-200"}>
        {s.text}
      </span>
    ) : (
      <span key={i}>{s.text}</span>
    )
  );
}

function getSelectionOffsets(container: Node): { start: number; end: number } | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) return null;
  const measureRange = document.createRange();
  measureRange.selectNodeContents(container);
  measureRange.setEnd(range.startContainer, range.startOffset);
  const start = measureRange.toString().length;
  measureRange.setStart(container, 0);
  measureRange.setEnd(range.endContainer, range.endOffset);
  const end = measureRange.toString().length;
  return { start: Math.min(start, end), end: Math.max(start, end) };
}

function HighlightableTextBlock({
  blockId,
  text,
  highlightRanges,
  className,
  onApplyHighlight,
}: {
  blockId: string;
  text: string;
  highlightRanges: HighlightRange[];
  className?: string;
  onApplyHighlight: (blockId: string, start: number, end: number) => void;
}) {
  if (!text) return null;
  return (
    <div
      className={cn(className, "select-text cursor-text")}
      onMouseUp={(e) => {
        const offsets = getSelectionOffsets(e.currentTarget);
        if (offsets && offsets.start < offsets.end) {
          onApplyHighlight(blockId, offsets.start, offsets.end);
        }
      }}
    >
      {renderTextWithHighlights(text, highlightRanges)}
    </div>
  );
}

function PassagePanelContent({
  questionId,
  text,
  highlights,
  className,
  itemTextClass,
  onApplyHighlight,
}: {
  questionId: string;
  text: string;
  highlights: Record<string, HighlightRange[]>;
  className?: string;
  itemTextClass?: string;
  onApplyHighlight: (blockId: string, start: number, end: number) => void;
}) {
  const parsed = parseBulletPassage(text);
  if (parsed.kind === "bullets") {
    return (
      <div className={className}>
        {parsed.intro ? (
          <HighlightableTextBlock
            blockId={`${questionId}-passage-intro`}
            text={parsed.intro}
            highlightRanges={highlights[`${questionId}-passage-intro`] ?? []}
            className={cn("mb-4 text-gray-800", itemTextClass)}
            onApplyHighlight={onApplyHighlight}
          />
        ) : null}
        <ul
          className={cn(
            "list-disc space-y-4 pl-5 text-gray-800 marker:text-gray-600",
            itemTextClass
          )}
        >
          {parsed.items.map((item, i) => (
            <li key={i} className={cn("pl-0.5", itemTextClass)}>
              <HighlightableTextBlock
                blockId={`${questionId}-passage-b-${i}`}
                text={item}
                highlightRanges={highlights[`${questionId}-passage-b-${i}`] ?? []}
                className={itemTextClass}
                onApplyHighlight={onApplyHighlight}
              />
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <HighlightableTextBlock
      blockId={`${questionId}-passage`}
      text={parsed.text}
      highlightRanges={highlights[`${questionId}-passage`] ?? []}
      className={className}
      onApplyHighlight={onApplyHighlight}
    />
  );
}

function isSvgContent(text: string | null): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  return t.startsWith("<svg") || t.includes("<svg");
}

/** True if content looks like HTML table (for Economics passage). */
function isTableHtml(text: string | null): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  return t.includes("<table") && t.includes("</table>");
}

/** Sanitize table HTML: keep only table, thead, tbody, tr, th, td; strip attributes and remove other tags. */
function sanitizeTableHtml(html: string): string {
  let s = html.trim();
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<\/?(table|thead|tbody|tr|th|td)(\s[^>]*)?>/gi, (m, tag) =>
    m.startsWith("</") ? `</${tag}>` : `<${tag}>`
  );
  s = s.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>/g, "");
  return s;
}

type TableSplitMode = "tab" | "spaces2" | "space1" | "pipe";

/** Split a line into columns: by tab, 2+ spaces, single space, or pipe. */
function splitTableRow(line: string, mode: TableSplitMode): string[] {
  if (mode === "pipe") {
    const parts = line.split("|").map((p) => p.trim());
    return parts.length > 2 ? parts.slice(1, -1) : parts;
  }
  if (mode === "tab") return line.split(/\t+/).map((p) => p.trim()).filter(Boolean);
  if (mode === "spaces2") return line.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
  return line.split(/\s+/).map((p) => p.trim()).filter(Boolean);
}

/** True if row looks like markdown table separator (e.g. |---|------|). */
function isPipeSeparatorRow(cells: string[]): boolean {
  return cells.length >= 1 && cells.every((c) => /^[-:\s]+$/.test(c));
}

function getTableSplitMode(lines: string[]): TableSplitMode {
  const pipeRows = lines.map((l) => splitTableRow(l, "pipe"));
  const dataRows = pipeRows.filter((r) => r.length >= 2 && !isPipeSeparatorRow(r));
  if (dataRows.length >= 2) {
    const colCount = dataRows[0].length;
    if (dataRows.every((r) => r.length === colCount) && lines.some((l) => (l.match(/\|/g)?.length ?? 0) >= 1))
      return "pipe";
  }
  if (lines.some((l) => l.includes("\t"))) return "tab";
  if (lines.some((l) => /\s{2,}/.test(l))) return "spaces2";
  return "space1";
}

/** True if plain text looks like table data (2+ rows, 2+ columns, consistent column count). */
function looksLikeTableText(text: string | null): boolean {
  if (!text?.trim() || isTableHtml(text)) return false;
  const lines = text.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const mode = getTableSplitMode(lines);
  const rows = lines.map((l) => splitTableRow(l, mode));
  const dataRows = mode === "pipe" ? rows.filter((r) => r.length >= 2 && !isPipeSeparatorRow(r)) : rows;
  if (dataRows.length < 2 || dataRows.some((r) => r.length < 2)) return false;
  const colCount = dataRows[0].length;
  if (dataRows.some((r) => r.length !== colCount)) return false;
  return true;
}

/** True if text looks like a single question stem (e.g. "Which of the following…?"); not table/SVG/list. */
function looksLikeQuestionStem(text: string | null): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  if (isTableHtml(t) || isTableWithOptionLettersFormat(t) || looksLikeTableText(t) || isSvgContent(t)) return false;
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const listLikeLines = lines.filter(
    (l) => /^\s*[IVX]+\.\s/.test(l) || /^\s*\d+\.\s/.test(l)
  );
  if (listLikeLines.length >= 2 || (lines.length >= 2 && listLikeLines.length >= 1)) return false;
  const singleOrShort = lines.length <= 3 && t.length < 600;
  const endsWithQ = t.endsWith("?");
  const startsWithQuestion = /^(Which|What|How|Consider)\s/i.test(t);
  return singleOrShort && (endsWithQ || startsWithQuestion);
}

/** Convert plain text table (tab, 2+ space, single space, or pipe) to HTML table. */
function plainTextToTableHtml(text: string): string {
  const lines = text.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  const mode = getTableSplitMode(lines);
  const rows = lines.map((l) => splitTableRow(l, mode));
  const dataRows = mode === "pipe" ? rows.filter((r) => r.length >= 2 && !isPipeSeparatorRow(r)) : rows;
  const thead =
    dataRows.length > 0
      ? `<thead><tr>${dataRows[0].map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`
      : "";
  const tbody =
    dataRows.length > 1
      ? `<tbody>${dataRows
          .slice(1)
          .map(
            (row) =>
              `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
          )
          .join("")}</tbody>`
      : "";
  return `<table>${thead}${tbody}</table>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Extract markdown table block from text (handles SVG+table mixed content). */
function extractTableBlock(text: string): string | null {
  const t = text.trim();
  const tableStart = t.search(/\|[\s|]/);
  if (tableStart < 0) return null;
  return t.slice(tableStart).trim();
}

/** Compute table HTML for panel. Returns empty string if parsing yields no valid table. */
function getTableHtmlForPanel(content: string): string {
  if (isTableHtml(content)) return sanitizeTableHtml(content);
  if (isTableWithOptionLettersFormat(content)) return sanitizeTableHtml(parseTableWithOptionLettersToHtml(content));
  const text = isSvgContent(content) ? (extractTableBlock(content) ?? content) : content;
  const raw = plainTextToTableHtml(text);
  return raw ? sanitizeTableHtml(raw) : "";
}

/** True if text is "Table: Col1 | Col2\n(A) v1 | v2" or compact "Table:Col1|Col2(A)v1|v2(B)..." format. */
function isTableWithOptionLettersFormat(text: string | null): boolean {
  if (!text?.trim() || isTableHtml(text) || isSvgContent(text)) return false;
  const t = text.trim();
  if (!t.toLowerCase().includes("table:") && !t.startsWith("Table:")) return false;
  if (!/\([A-E]\)/.test(t)) return false;
  if (!t.includes("|")) return false;
  return true;
}

/** Parse "Table: Col1 | Col2\n(A) v1 | v2" or compact format to HTML table. */
function parseTableWithOptionLettersToHtml(text: string): string {
  const t = text.trim();
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length >= 2) {
    const rows: string[][] = lines.map((line) =>
      line.split("|").map((c) => c.trim()).filter(Boolean)
    );
    if (rows.every((r) => r.length >= 2)) {
      let headerRow = rows[0];
      if (headerRow[0]?.toLowerCase().startsWith("table:")) {
        headerRow = [
          headerRow[0].replace(/^Table:\s*/i, "").trim(),
          ...headerRow.slice(1),
        ];
      }
      const thead =
        headerRow.length > 0
          ? `<thead><tr>${headerRow.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`
          : "";
      const tbody =
        rows.length > 1
          ? `<tbody>${rows
              .slice(1)
              .map(
                (row) =>
                  `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
              )
              .join("")}</tbody>`
          : "";
      return `<table>${thead}${tbody}</table>`;
    }
  }

  const compactParts = t.split(/\s*\((A|B|C|D|E)\)\s*/);
  if (compactParts.length >= 3) {
    const headerPart = compactParts[0].trim();
    const headerCells = headerPart
      .replace(/^Table:\s*/i, "")
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (headerCells.length >= 2) {
      const thead = `<thead><tr><th></th>${headerCells.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`;
      const tbodyParts: string[] = [];
      for (let i = 1; i < compactParts.length; i += 2) {
        const letter = compactParts[i];
        const cellPart = compactParts[i + 1]?.trim() ?? "";
        const cells = cellPart.split("|").map((c) => c.trim()).filter(Boolean);
        if (cells.length >= 1) {
          tbodyParts.push(
            `<tr><td>${escapeHtml(`(${letter})`)}</td>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
          );
        }
      }
      if (tbodyParts.length > 0) {
        return `<table>${thead}<tbody>${tbodyParts.join("")}</tbody></table>`;
      }
    }
  }

  return "";
}

/** CSA: passage_text içinde "I. ... II. ... III." listesi + kod olabilir. */
function splitCsaPassage(text: string | null): {
  referenceList: string | null;
  codePart: string | null;
} {
  if (!text?.trim()) return { referenceList: null, codePart: null };
  const t = text.trim();
  const codeStart = t.search(/\n\n\s*(?:public|private|class|\/\*)/);
  if (codeStart > 0) {
    const listPart = t.slice(0, codeStart).trim();
    const codePart = t.slice(codeStart).trim();
    if (/^\s*[IVX]+\.\s/m.test(listPart) && codePart.length > 20) {
      return { referenceList: listPart, codePart };
    }
  }
  if (looksLikeCode(t)) return { referenceList: null, codePart: t };
  if (/^\s*[IVX]+\.\s/m.test(t)) return { referenceList: t, codePart: null };
  return { referenceList: null, codePart: t };
}

/** CSA legacy fallback: question_text contains code when passage_text is empty (old uploads). */
function looksLikeCode(text: string | null): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  // Java/code benzeri: metod çağrısı, atama, keyword
  const hasCodePattern =
    /\b(String|System\.out|new\s|\.substring\s*\(|ArrayList|for\s*\(|if\s*\(|return\s)/.test(t) ||
    (t.includes(";") && (t.includes("{") || t.includes("}")));
  const hasOriginalPattern =
    (t.includes("public ") || t.includes("private ") || t.includes("void ") || t.includes("int ")) &&
    (t.includes("{") || t.includes("}"));
  return hasCodePattern || hasOriginalPattern;
}

/** Option text looks like code (for CSA: render as code block). */
function optionLooksLikeCode(text: string | null): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  return (t.includes(";") || t.includes("{")) && (t.includes("{") || t.includes("}"));
}

/** For Economics/Stats/Psych: when question_text contains stem + numbered list (I. II. ...) and passage has the list, return only the stem for right panel. */
function getStemOnlyIfListPresent(questionText: string | null, _passageText: string | null): string {
  if (!questionText?.trim()) return questionText ?? "";
  const q = questionText.trim();
  const match = q.match(/^([\s\S]*?\?)\s*(?:\r?\n[\s\S]*?)?\s*I\.\s+[\s\S]*$/);
  if (match) {
    const stripped = match[1].trim();
    if (stripped.length >= 40) return stripped;
  }
  return q;
}

/**
 * When question_text contains both code and a question stem (CSA legacy), split so code goes left and stem right.
 * Returns the stem if found (e.g. "Which replacement...?" or sentence ending with ?), else null.
 */
function splitCsaQuestionStem(fullText: string | null): { codePart: string; questionStem: string | null } {
  if (!fullText?.trim()) return { codePart: fullText ?? "", questionStem: null };
  const t = fullText.trim();
  // Match a question sentence: starts with Which/What/How and ends with ?, or last sentence ending with ?
  const stemMatch = t.match(/\b(Which|What|How)\s+[\s\S]+?\?/);
  if (stemMatch) {
    const stemStart = t.indexOf(stemMatch[0]);
    const codePart = t.slice(0, stemStart).trim();
    const questionStem = t.slice(stemStart).trim();
    return { codePart, questionStem: questionStem || null };
  }
  // Fallback: take the last line (or segment) that ends with ?
  const lastQ = t.match(/\n([^\n]*\?)\s*$/);
  if (lastQ) {
    const stemStart = t.lastIndexOf(lastQ[1]);
    const codePart = t.slice(0, stemStart).trim();
    return { codePart, questionStem: lastQ[1].trim() };
  }
  return { codePart: t, questionStem: null };
}

/** Safe calculator eval: only digits, +, -, *, /, ., (, ), sqrt, ans */
function safeCalculatorEval(expr: string, lastResult: number | null): number | null {
  try {
    let s = expr.trim().replace(/×/g, "*").replace(/÷/g, "/");
    if (lastResult != null) s = s.replace(/\bans\b/gi, String(lastResult));
    s = s.replace(/√(\d+\.?\d*)/g, "Math.sqrt($1)");
    s = s.replace(/√\(([^)]+)\)/g, (_, inner) => `Math.sqrt(${inner})`);
    if (!/^[\d+\-*/().\s]+$/.test(s.replace(/Math\.sqrt/g, ""))) return null;
    const fn = new Function("return " + s);
    const result = fn();
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/** Scientific calculator eval: adds pow, abs, sin, cos, tan, pi */
function safeCalculatorEvalScientific(
  expr: string,
  lastResult: number | null,
  useRadians: boolean
): number | null {
  try {
    let s = expr.trim().replace(/×/g, "*").replace(/÷/g, "/");
    if (lastResult != null) s = s.replace(/\bans\b/gi, String(lastResult));
    s = s.replace(/\bπ\b/gi, String(Math.PI));
    s = s.replace(/√(\d+\.?\d*)/g, "Math.sqrt($1)");
    s = s.replace(/√\(([^)]+)\)/g, (_, inner) => `Math.sqrt(${inner})`);
    s = s.replace(/\^/g, "**");
    s = s.replace(/\|([^|]+)\|/g, (_, inner) => `Math.abs(${inner})`);
    const deg = useRadians ? 1 : "Math.PI/180";
    s = s.replace(/\bsin\(([^)]+)\)/gi, (_, inner) => `Math.sin((${inner})*${deg})`);
    s = s.replace(/\bcos\(([^)]+)\)/gi, (_, inner) => `Math.cos((${inner})*${deg})`);
    s = s.replace(/\btan\(([^)]+)\)/gi, (_, inner) => `Math.tan((${inner})*${deg})`);
    s = s.replace(/(\d+\.?\d*)%/g, "($1/100)");
    s = s.replace(/(\d+\.?\d*)²/g, "($1**2)");
    const fn = new Function("Math", "return " + s);
    const result = fn(Math);
    return typeof result === "number" && Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = typeof params.id === "string" ? params.id : "";
  const reviewAttemptId = searchParams.get("attempt") ?? "";
  const resumeAttemptId = searchParams.get("resume") ?? "";
  const loadAttemptId = resumeAttemptId || reviewAttemptId;
  const reviewQuestionNum = searchParams.get("question");
  const reviewQuestion = reviewQuestionNum ? parseInt(reviewQuestionNum, 10) : null;
  const [upload, setUpload] = useState<PdfUpload | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [eliminatedOptions, setEliminatedOptions] = useState<Map<string, Set<string>>>(new Map());
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [preStartUnlockRemaining, setPreStartUnlockRemaining] = useState(PRE_START_UNLOCK_SECONDS);
  const [timerVisible, setTimerVisible] = useState(true);
  const [timerPaused, setTimerPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [leftPanelPercent, setLeftPanelPercent] = useState(50);
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [questionListOpen, setQuestionListOpen] = useState(false);
  const [referenceOpen, setReferenceOpen] = useState(false);
  const [referenceExpandedSections, setReferenceExpandedSections] = useState<Set<string>>(new Set());
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calculatorDisplay, setCalculatorDisplay] = useState("");
  const [calculatorLastResult, setCalculatorLastResult] = useState<number | null>(null);
  const [calculatorPos, setCalculatorPos] = useState({ x: 32, y: 96 });
  const [calculatorRadians, setCalculatorRadians] = useState(true);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [questionIdToImageUrl, setQuestionIdToImageUrl] = useState<Record<string, string>>({});
  const [unusableImageSrcs, setUnusableImageSrcs] = useState<Set<string>>(new Set());
  const markImageUnusable = useCallback((src: string) => {
    setUnusableImageSrcs((prev) => {
      if (prev.has(src)) return prev;
      const next = new Set(prev);
      next.add(src);
      return next;
    });
  }, []);
  const [examCompleted, setExamCompleted] = useState(false);
  const [examResult, setExamResult] = useState<{
    total: number;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    notGradedCount: number;
    skipAiGrading: boolean;
    percentage: number;
    timeSpentSeconds: number;
    breakdown: { questionNumber: number; userAnswer: string | null; correctAnswer: string | null; isCorrect: boolean }[];
    examProgram?: "AP" | "SAT";
    sat?: {
      isFullTest: boolean;
      rwScaled: number | null;
      mathScaled: number | null;
      totalScaled: number | null;
      modules: Array<{
        module: string;
        section: "rw" | "math";
        moduleNumber: 1 | 2;
        correct: number;
        total: number;
      }>;
    } | null;
  } | null>(null);
  const [desmosOpen, setDesmosOpen] = useState(false);
  // SAT module flow state (only used for SAT_FULL_TEST)
  const [currentModuleId, setCurrentModuleId] = useState<SatModuleId | null>(null);
  const [moduleTransitionShown, setModuleTransitionShown] = useState<SatModuleId | null>(null);
  const [moduleTransitionError, setModuleTransitionError] = useState<string | null>(null);
  const [showModuleScoreChoice, setShowModuleScoreChoice] = useState(false);
  const [moduleScoreResult, setModuleScoreResult] = useState<ModuleScoreResult | null>(null);
  const [scoringModule, setScoringModule] = useState(false);
  const [resumeModuleIndex, setResumeModuleIndex] = useState<number | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completingSkipAi, setCompletingSkipAi] = useState(false);
  const [selectedResultQuestion, setSelectedResultQuestion] = useState<number | null>(null);
  const [resultViewMode, setResultViewMode] = useState<"explanation" | "question">("question");
  const [resultExplanation, setResultExplanation] = useState<string | null>(null);
  const [resultExplanationLoading, setResultExplanationLoading] = useState(false);
  const [fullPageModalOpen, setFullPageModalOpen] = useState(false);
  const [showEndExamConfirm, setShowEndExamConfirm] = useState(false);
  const [savingExit, setSavingExit] = useState(false);
  const [highlights, setHighlights] = useState<
    Record<string, Array<{ start: number; end: number; color: string }>>
  >({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [noteWidgetOpen, setNoteWidgetOpen] = useState(false);
  const [highlightToolbarOpen, setHighlightToolbarOpen] = useState(false);
  const [highlightMode, setHighlightMode] = useState<"yellow" | "blue" | "pink" | "eraser" | null>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const calculatorDragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserEmail(session.user?.email ?? "");
      setUserName((session.user?.user_metadata?.username as string) ?? "");
    });
  }, [router]);

  useEffect(() => {
    setPreStartUnlockRemaining(PRE_START_UNLOCK_SECONDS);
  }, [id]);

  useEffect(() => {
    if (loading || attemptId || !upload) return;
    const interval = setInterval(() => {
      setPreStartUnlockRemaining((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, attemptId, upload]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    if (loadAttemptId) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) {
          setLoading(false);
          return;
        }
        fetch(`/api/exam/attempt/${loadAttemptId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.error) {
              setLoading(false);
              return;
            }
            if (data.upload?.id !== id) {
              setLoading(false);
              return;
            }
            if (data.resume) {
              setUpload(data.upload as PdfUpload);
              setQuestions((data.questions ?? []) as Question[]);
              setAttemptId(data.attemptId ?? loadAttemptId);
              if (typeof data.currentModuleIndex === "number" && Number.isFinite(data.currentModuleIndex)) {
                setResumeModuleIndex(Math.max(0, Math.floor(data.currentModuleIndex)));
              }
              const ans: Record<string, string> = {};
              const marked = new Set<string>();
              for (const row of data.savedAnswers ?? []) {
                if (row.userAnswer != null && String(row.userAnswer).trim() !== "") {
                  ans[row.questionId] = String(row.userAnswer).trim();
                }
                if (row.isFlagged) marked.add(row.questionId);
              }
              setAnswers(ans);
              setMarkedForReview(marked);
              setElapsedSeconds(data.timeSpentSeconds ?? 0);
              setExamCompleted(false);
              setLoading(false);
              return;
            }
            if (data.result) {
              setUpload(data.upload as PdfUpload);
              setQuestions((data.questions ?? []) as Question[]);
              setAttemptId(data.attemptId ?? loadAttemptId);
              setExamCompleted(true);
              setExamResult({
                total: data.result?.total ?? 0,
                correctCount: data.result?.correctCount ?? 0,
                incorrectCount: data.result?.incorrectCount ?? 0,
                unansweredCount: data.result?.unansweredCount ?? 0,
                notGradedCount: data.result?.notGradedCount ?? 0,
                skipAiGrading: data.result?.skipAiGrading ?? false,
                percentage: data.result?.percentage ?? 0,
                timeSpentSeconds: data.result?.timeSpentSeconds ?? 0,
                breakdown: data.result?.breakdown ?? [],
                examProgram: data.result?.examProgram,
                sat: data.result?.sat ?? null,
              });
              if (reviewQuestion != null && !Number.isNaN(reviewQuestion)) {
                setSelectedResultQuestion(reviewQuestion);
              }
            }
            setLoading(false);
          })
          .catch(() => setLoading(false));
      });
      return;
    }
    const supabase = createClient();
    Promise.all([
      supabase
        .from("pdf_uploads")
        .select(UPLOAD_SELECT_FIELDS)
        .eq("id", id)
        .single(),
      supabase
        .from("questions")
        .select("*")
        .eq("upload_id", id)
        .order("question_number", { ascending: true })
        .order("id", { ascending: true }),
    ]).then(([uploadRes, questionsRes]) => {
      setLoading(false);
      if (uploadRes.data) setUpload(uploadRes.data as PdfUpload);
      if (questionsRes.data) setQuestions((questionsRes.data as Question[]) ?? []);
    });
  }, [id, loadAttemptId, reviewQuestion]);

  useEffect(() => {
    if (!id || !upload?.storage_path) {
      setPdfUrl(null);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session?.access_token) return;
      fetch(`/api/upload/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (!cancelled) {
            if (data?.url) setPdfUrl(data.url);
            else if (data?.error) console.error("PDF URL fetch:", data.error);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setPdfUrl(null);
            console.error("PDF URL fetch failed:", e);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [id, upload?.storage_path, upload?.subject]);

  const startExam = useCallback(async () => {
    if (!id || !userEmail || questions.length === 0) return;
    setStarting(true);
    try {
      const res = await fetch("/api/exam/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: id, userEmail }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to start exam");
      setAttemptId(data.attemptId);
    } catch (e) {
      console.error(e);
    } finally {
      setStarting(false);
    }
  }, [id, userEmail, questions.length]);

  const saveAnswer = useCallback(
    async (questionId: string, userAnswer: string | null, isFlagged: boolean) => {
      if (!attemptId) return;
      await fetch("/api/exam/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          questionId,
          userAnswer: userAnswer == null || userAnswer === "" ? null : userAnswer,
          isFlagged,
        }),
      });
    },
    [attemptId]
  );

  useEffect(() => {
    if (!attemptId || timerPaused || examCompleted) return;
    const t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [attemptId, timerPaused, examCompleted]);

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const percent = Math.max(20, Math.min(70, (e.clientX / window.innerWidth) * 100));
    setLeftPanelPercent(percent);
  }, []);

  const handleResizeEnd = useCallback(() => {
    isDraggingRef.current = false;
    window.removeEventListener("mousemove", handleResize);
    window.removeEventListener("mouseup", handleResizeEnd);
  }, [handleResize]);

  useEffect(() => {
    return () => {
      window.removeEventListener("mousemove", handleResize);
      window.removeEventListener("mouseup", handleResizeEnd);
    };
  }, [handleResize, handleResizeEnd]);

  const handleCalculatorDragMove = useCallback((e: MouseEvent) => {
    const r = calculatorDragRef.current;
    if (!r) return;
    const CALC_W = 288;
    const padding = 20;
    const dx = e.clientX - r.startX;
    const dy = e.clientY - r.startY;
    const nx = Math.max(padding - CALC_W, Math.min(window.innerWidth - padding, r.posX + dx));
    const ny = Math.max(0, Math.min(window.innerHeight - padding, r.posY + dy));
    setCalculatorPos({ x: nx, y: ny });
  }, []);

  const handleCalculatorDragEnd = useCallback(() => {
    calculatorDragRef.current = null;
    window.removeEventListener("mousemove", handleCalculatorDragMove);
    window.removeEventListener("mouseup", handleCalculatorDragEnd);
  }, [handleCalculatorDragMove]);

  const handleCalculatorDragStart = useCallback((e: React.MouseEvent) => {
    calculatorDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: calculatorPos.x,
      posY: calculatorPos.y,
    };
    window.addEventListener("mousemove", handleCalculatorDragMove);
    window.addEventListener("mouseup", handleCalculatorDragEnd);
  }, [calculatorPos, handleCalculatorDragMove, handleCalculatorDragEnd]);

  useEffect(() => {
    return () => {
      calculatorDragRef.current = null;
      window.removeEventListener("mousemove", handleCalculatorDragMove);
      window.removeEventListener("mouseup", handleCalculatorDragEnd);
    };
  }, [handleCalculatorDragMove, handleCalculatorDragEnd]);

  const toggleMarkForReview = useCallback(
    (questionId: string) => {
      setMarkedForReview((prev) => {
        const next = new Set(prev);
        if (next.has(questionId)) next.delete(questionId);
        else next.add(questionId);
        const isFlagged = next.has(questionId);
        saveAnswer(questionId, answers[questionId] ?? "", isFlagged);
        return next;
      });
    },
    [answers, saveAnswer]
  );

  const toggleEliminate = useCallback((questionId: string, key: string) => {
    setEliminatedOptions((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(questionId) ?? []);
      if (set.has(key)) set.delete(key);
      else set.add(key);
      next.set(questionId, set);
      return next;
    });
  }, []);

  const applyHighlightSelection = useCallback(
    (blockId: string, start: number, end: number) => {
      if (!highlightMode || start >= end) return;
      setHighlights((prev) => {
        const list = prev[blockId] ?? [];
        if (highlightMode === "eraser") {
          const next = list.filter((h) => !(h.start < end && h.end > start));
          if (next.length === 0) {
            const { [blockId]: _, ...rest } = prev;
            return rest;
          }
          return { ...prev, [blockId]: next };
        }
        return {
          ...prev,
          [blockId]: [...list, { start, end, color: highlightMode }],
        };
      });
    },
    [highlightMode]
  );

  const saveAndExit = useCallback(async () => {
    if (!attemptId || savingExit || examCompleted) return;
    setSavingExit(true);
    try {
      await Promise.all(
        questions.map((q) =>
          saveAnswer(q.id, answers[q.id] ?? "", markedForReview.has(q.id))
        )
      );
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch(`/api/exam/attempt/${attemptId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ timeSpentSeconds: elapsedSeconds }),
        });
      }
      router.push("/dashboard");
    } catch (e) {
      console.error(e);
      alert("Could not save your progress. Please try again.");
    } finally {
      setSavingExit(false);
    }
  }, [
    attemptId,
    savingExit,
    examCompleted,
    questions,
    answers,
    saveAnswer,
    markedForReview,
    elapsedSeconds,
    router,
  ]);

  const completeExam = useCallback(
    async (skipAiGrading: boolean) => {
      if (!attemptId || completing) return;
      setCompleting(true);
      setCompletingSkipAi(skipAiGrading);
      try {
        await Promise.all(
          Object.entries(answers).map(([qId, ans]) =>
            saveAnswer(qId, ans, markedForReview.has(qId))
          )
        );
        let selectedRwM2Variant: "easy" | "hard" | null = null;
        let selectedMathM2Variant: "easy" | "hard" | null = null;
        const adaptiveMode = upload?.sat_adaptive_mode;
        const satFullExam = isSatFullTest(upload?.subject);
        if (adaptiveMode === "six_module" && satFullExam) {
          let rwM1Correct = 0;
          let mathM1Correct = 0;
          let rwM1Total = 0;
          let mathM1Total = 0;
          for (const q of questions) {
            if (q.sat_section === "rw" && q.sat_module === 1) {
              rwM1Total++;
              if (isSatM1AnswerCorrect(q, answers[q.id])) rwM1Correct++;
            }
            if (q.sat_section === "math" && q.sat_module === 1) {
              mathM1Total++;
              if (isSatM1AnswerCorrect(q, answers[q.id])) mathM1Correct++;
            }
          }
          selectedRwM2Variant = pickSatM2Variant(
            rwM1Correct,
            rwM1Total,
            upload?.sat_cutoff_rw ?? null
          );
          selectedMathM2Variant = pickSatM2Variant(
            mathM1Correct,
            mathM1Total,
            upload?.sat_cutoff_math ?? null
          );
        }
        const res = await fetch("/api/exam/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            skipAiGrading,
            ...(adaptiveMode === "six_module"
              ? {
                  selectedRwM2Variant,
                  selectedMathM2Variant,
                }
              : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Failed to complete exam");
        setExamResult({
          total: data.total ?? 0,
          correctCount: data.correctCount ?? 0,
          incorrectCount: data.incorrectCount ?? 0,
          unansweredCount: data.unansweredCount ?? 0,
          notGradedCount: data.notGradedCount ?? 0,
          skipAiGrading: data.skipAiGrading === true,
          percentage: data.percentage ?? 0,
          timeSpentSeconds: data.timeSpentSeconds ?? 0,
          breakdown: data.breakdown ?? [],
          examProgram: data.examProgram,
          sat: data.sat ?? null,
        });
        setExamCompleted(true);
      } catch (e) {
        console.error(e);
        alert("Failed to complete exam. Please try again.");
      } finally {
        setCompleting(false);
        setCompletingSkipAi(false);
      }
    },
    [attemptId, completing, answers, saveAnswer, markedForReview, questions, upload]
  );

  const handleResultRowClick = useCallback((questionNumber: number) => {
    setSelectedResultQuestion(questionNumber);
    setResultViewMode("question");
    setResultExplanation(null);
    setResultExplanationLoading(false);
  }, []);

  const loadResultExplanation = useCallback(
    async (questionNumber: number) => {
      const q = questions.find((qq) => qq.question_number === questionNumber);
      const row = examResult?.breakdown.find((b) => b.questionNumber === questionNumber);
      if (!q || !upload) return;
      setSelectedResultQuestion(questionNumber);
      setResultViewMode("explanation");
      setResultExplanationLoading(true);
      setResultExplanation(null);
      const correct = row?.correctAnswer?.toString().trim() ?? "";
      if (!correct) {
        setResultExplanation(
          "Solution explanation is not available for this question because there is no confirmed correct answer yet."
        );
        setResultExplanationLoading(false);
        return;
      }
      try {
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(
          (o): o is string => o != null && o.trim() !== ""
        );
        const res = await fetch("/api/exam/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionText: q.question_text,
            passageText: q.passage_text ?? "",
            options: opts,
            correctAnswer: correct,
            subject: upload.subject,
          }),
        });
        const data = await res.json();
        setResultExplanation(data.explanation ?? "No explanation available.");
      } catch {
        setResultExplanation("Failed to load explanation.");
      } finally {
        setResultExplanationLoading(false);
      }
    },
    [questions, upload, examResult]
  );

  const subject = (upload?.subject ?? "AP_CSA") as SubjectValue;
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const isCsa = isCodeSubject(subject);
  const isEconomics = subject === "AP_MICROECONOMICS" || subject === "AP_MACROECONOMICS";
  const isMicro = subject === "AP_MICROECONOMICS";
  const examProgram = getExamProgram(subject);
  const isSat = examProgram === "SAT";
  const isSatFull = isSatFullTest(subject);
  const satResultGroups = useMemo(
    () => (isSat ? getSatModuleGroups(questions, subject) : []),
    [isSat, questions, subject]
  );
  const needsDesmos = satRequiresDesmos(subject);
  const isCalculatorAllowed = !isSat && CALCULATOR_ALLOWED_SUBJECTS.has(subject);
  const isCalculatorScientific =
    isCalculatorAllowed &&
    !["AP_MICROECONOMICS", "AP_MACROECONOMICS"].includes(subject);
  const satAdaptiveMode =
    (upload?.sat_adaptive_mode === "six_module" || upload?.sat_adaptive_mode === "pool" || upload?.sat_adaptive_mode === "none")
      ? upload.sat_adaptive_mode
      : "none";

  // -----------------------------------------------------------------------
  // SAT module flow: split the loaded questions into modules and present them
  // one module at a time. AP and single-module SAT subjects use the full list.
  // -----------------------------------------------------------------------
  const initialSatModule = useMemo<SatModuleId | null>(() => {
    if (!isSat) return null;
    if (!isSatFull) {
      const section: SatSection = isSatRw(subject) ? "rw" : "math";
      return `${section}1` as SatModuleId;
    }
    return "rw1";
  }, [isSat, isSatFull, subject]);

  useEffect(() => {
    if (!isSat) return;
    setCurrentIndex(0);
  }, [currentModuleId, isSat]);

  const m1RwCorrectCount = useMemo(() => {
    if (!isSatFull || satAdaptiveMode !== "six_module") return 0;
    let count = 0;
    for (const q of questions) {
      if (q.sat_section === "rw" && q.sat_module === 1) {
        if (isSatM1AnswerCorrect(q, answers[q.id])) count++;
      }
    }
    return count;
  }, [isSatFull, satAdaptiveMode, questions, answers]);
  const m1MathCorrectCount = useMemo(() => {
    if (!isSatFull || satAdaptiveMode !== "six_module") return 0;
    let count = 0;
    for (const q of questions) {
      if (q.sat_section === "math" && q.sat_module === 1) {
        if (isSatM1AnswerCorrect(q, answers[q.id])) count++;
      }
    }
    return count;
  }, [isSatFull, satAdaptiveMode, questions, answers]);

  const rwM1Total = useMemo(
    () => questions.filter((q) => q.sat_section === "rw" && q.sat_module === 1).length,
    [questions]
  );
  const mathM1Total = useMemo(
    () => questions.filter((q) => q.sat_section === "math" && q.sat_module === 1).length,
    [questions]
  );

  const m2RwVariant = useMemo(
    () =>
      satAdaptiveMode === "six_module"
        ? pickSatM2Variant(m1RwCorrectCount, rwM1Total, upload?.sat_cutoff_rw ?? null)
        : null,
    [satAdaptiveMode, m1RwCorrectCount, rwM1Total, upload?.sat_cutoff_rw]
  );
  const m2MathVariant = useMemo(
    () =>
      satAdaptiveMode === "six_module"
        ? pickSatM2Variant(m1MathCorrectCount, mathM1Total, upload?.sat_cutoff_math ?? null)
        : null,
    [satAdaptiveMode, m1MathCorrectCount, mathM1Total, upload?.sat_cutoff_math]
  );

  const availableModules = useMemo(() => {
    if (!isSatFull) return SAT_MODULES;
    return SAT_MODULES.filter((mod) =>
      questions.some((q) => questionMatchesSatModuleBase(q, mod.section, mod.module))
    );
  }, [isSatFull, questions]);

  const matchesCurrentModule = useCallback(
    (q: Question, modId: SatModuleId | null): boolean => {
      if (!isSat) return true;
      if (!modId) return true;
      if (!isSatFull) return true;
      const target = SAT_MODULES.find((m) => m.id === modId);
      if (!target) return false;
      if (q.sat_section !== target.section) return false;
      if (q.sat_module !== target.module) return false;
      if (target.module === 2 && satAdaptiveMode === "six_module") {
        const variant = target.section === "rw" ? m2RwVariant : m2MathVariant;
        if (q.sat_module_variant && variant && q.sat_module_variant !== variant) return false;
      }
      return true;
    },
    [isSat, isSatFull, satAdaptiveMode, m2RwVariant, m2MathVariant]
  );

  const moduleQuestions = useMemo(() => {
    if (!isSat) return questions;
    return questions.filter((q) => matchesCurrentModule(q, currentModuleId));
  }, [isSat, questions, currentModuleId, matchesCurrentModule]);

  const activeQuestions: Question[] = isSat ? moduleQuestions : questions;
  const currentQuestion = activeQuestions[currentIndex] ?? null;
  const displayQuestionNumber =
    currentQuestion == null
      ? 0
      : isSat
        ? currentIndex + 1
        : currentQuestion.question_number;
  const currentModuleDef = currentModuleId
    ? SAT_MODULES.find((m) => m.id === currentModuleId)
    : null;
  const currentAvailIndex = currentModuleId
    ? availableModules.findIndex((m) => m.id === currentModuleId)
    : -1;
  const nextModuleDef =
    isSatFull && currentAvailIndex >= 0 && currentAvailIndex < availableModules.length - 1
      ? availableModules[currentAvailIndex + 1]
      : null;
  const nextModuleQuestionCount = useMemo(() => {
    if (!nextModuleDef) return 0;
    return questions.filter((q) => matchesCurrentModule(q, nextModuleDef.id)).length;
  }, [nextModuleDef, questions, matchesCurrentModule]);
  const isLastSatModule =
    !isSatFull || (currentAvailIndex >= 0 && currentAvailIndex === availableModules.length - 1);
  const isOnLastQuestionOfModule =
    activeQuestions.length > 0 && currentIndex >= activeQuestions.length - 1;
  const isEmptySatModule = isSatFull && currentModuleId != null && activeQuestions.length === 0;

  const satMarkedForReviewQuestions = useMemo(() => {
    if (!isSat) return [];
    return questions
      .filter((q) => markedForReview.has(q.id))
      .sort((a, b) => a.question_number - b.question_number);
  }, [isSat, questions, markedForReview]);

  const satCurrentModuleMarkedForReview = useMemo(() => {
    if (!isSat) return [];
    return activeQuestions.filter((q) => markedForReview.has(q.id));
  }, [isSat, activeQuestions, markedForReview]);

  useEffect(() => {
    if (!isSatFull || questions.length === 0 || availableModules.length === 0) return;
    if (resumeModuleIndex != null) {
      const mod = availableModules[resumeModuleIndex] ?? availableModules[0];
      if (mod) setCurrentModuleId(mod.id);
      setResumeModuleIndex(null);
      return;
    }
    if (currentModuleId == null && initialSatModule) {
      const startMod =
        availableModules.find((m) => m.id === initialSatModule) ?? availableModules[0];
      if (startMod) setCurrentModuleId(startMod.id);
    }
  }, [
    isSatFull,
    questions.length,
    availableModules,
    resumeModuleIndex,
    currentModuleId,
    initialSatModule,
  ]);

  const persistAttemptProgress = useCallback(
    async (opts?: { currentModuleIndex?: number }) => {
      if (!attemptId) return;
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch(`/api/exam/attempt/${attemptId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          timeSpentSeconds: elapsedSeconds,
          ...(opts?.currentModuleIndex != null
            ? { currentModuleIndex: opts.currentModuleIndex }
            : {}),
        }),
      }).catch(() => {});
    },
    [attemptId, elapsedSeconds]
  );

  const goToNextModule = useCallback(async () => {
    if (!nextModuleDef) return;
    if (nextModuleQuestionCount === 0) {
      setModuleTransitionError(
        `${nextModuleDef.label} modülünde soru bulunamadı. Dashboard'dan sınavı kontrol edin veya PDF'i yeniden yükleyin.`
      );
      return;
    }
    setModuleTransitionError(null);
    const nextIndex = availableModules.findIndex((m) => m.id === nextModuleDef.id);
    await persistAttemptProgress({
      currentModuleIndex: nextIndex >= 0 ? nextIndex : undefined,
    });
    setModuleTransitionShown(null);
    setShowModuleScoreChoice(false);
    setModuleScoreResult(null);
    setCurrentModuleId(nextModuleDef.id);
  }, [
    nextModuleDef,
    nextModuleQuestionCount,
    availableModules,
    persistAttemptProgress,
  ]);

  const scoreModule = useCallback(
    async (skipAiGrading: boolean) => {
      const modId = moduleTransitionShown ?? currentModuleId;
      if (!attemptId || !modId || scoringModule) return;
      setScoringModule(true);
      setModuleTransitionError(null);
      try {
        await Promise.all(
          Object.entries(answers).map(([qId, ans]) =>
            saveAnswer(qId, ans, markedForReview.has(qId))
          )
        );
        const res = await fetch("/api/exam/score-module", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            attemptId,
            moduleId: modId,
            skipAiGrading,
            ...(satAdaptiveMode === "six_module"
              ? {
                  selectedRwM2Variant: m2RwVariant,
                  selectedMathM2Variant: m2MathVariant,
                }
              : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Failed to score module");
        setModuleScoreResult({
          moduleId: (data.moduleId ?? modId) as SatModuleId,
          moduleLabel: data.moduleLabel ?? modId,
          correctCount: data.correctCount ?? 0,
          incorrectCount: data.incorrectCount ?? 0,
          unansweredCount: data.unansweredCount ?? 0,
          notGradedCount: data.notGradedCount ?? 0,
          skipAiGrading: data.skipAiGrading === true,
          percentage: data.percentage ?? 0,
          breakdown: data.breakdown ?? [],
        });
        setShowModuleScoreChoice(false);
      } catch (e) {
        console.error(e);
        setModuleTransitionError(
          e instanceof Error ? e.message : "Failed to score module. Please try again."
        );
      } finally {
        setScoringModule(false);
      }
    },
    [
      moduleTransitionShown,
      currentModuleId,
      attemptId,
      scoringModule,
      answers,
      saveAnswer,
      markedForReview,
      satAdaptiveMode,
      m2RwVariant,
      m2MathVariant,
    ]
  );

  const moduleScoreGroup = useMemo(() => {
    if (!moduleScoreResult) return null;
    const def = SAT_MODULES.find((m) => m.id === moduleScoreResult.moduleId);
    if (!def) return null;
    const variant =
      def.module === 2 && satAdaptiveMode === "six_module"
        ? def.section === "rw"
          ? m2RwVariant
          : m2MathVariant
        : null;
    const targetId =
      variant != null ? `${def.section}${def.module}-${variant}` : `${def.section}${def.module}`;
    return (
      satResultGroups.find((g) => g.id === targetId) ??
      satResultGroups.find((g) => g.id === `${def.section}${def.module}`) ??
      null
    );
  }, [moduleScoreResult, satResultGroups, satAdaptiveMode, m2RwVariant, m2MathVariant]);

  const storedImgSrcRaw = currentQuestion
    ? currentQuestion.image_url ?? questionIdToImageUrl[currentQuestion.id]
    : null;
  const usableStoredImgSrc =
    storedImgSrcRaw && !unusableImageSrcs.has(storedImgSrcRaw) ? storedImgSrcRaw : null;
  const canExplorePdf = Boolean(
    pdfUrl &&
      currentQuestion?.page_number != null &&
      currentQuestion?.bbox != null &&
      currentQuestion.bbox.width > 0 &&
      currentQuestion.bbox.height > 0
  );
  const handleGraphRendered = useCallback(
    async (dataUrl: string) => {
      const qId = currentQuestion?.id;
      if (!qId || !id) return;
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const res = await fetch(`/api/upload/${id}/save-graph`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ questionId: qId, imageBase64: dataUrl }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.imageUrl) {
          setQuestionIdToImageUrl((prev) => ({ ...prev, [qId]: data.imageUrl }));
        }
      } catch {
        // ignore
      }
    },
    [id, currentQuestion?.id]
  );

  const handleTableRendered = useCallback(
    async (dataUrl: string) => {
      const qId = currentQuestion?.id;
      if (!qId || !id) return;
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      try {
        const res = await fetch(`/api/upload/${id}/save-table`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ questionId: qId, imageBase64: dataUrl }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data?.imageUrl) {
          setQuestionIdToImageUrl((prev) => ({ ...prev, [qId]: data.imageUrl }));
        }
      } catch {
        // ignore
      }
    },
    [id, currentQuestion?.id]
  );
  const isCsaLegacyFallback =
    isCsa &&
    !currentQuestion?.passage_text?.trim() &&
    !!currentQuestion?.question_text?.trim() &&
    looksLikeCode(currentQuestion.question_text);
  const csaSplit = isCsaLegacyFallback
    ? splitCsaQuestionStem(currentQuestion?.question_text ?? null)
    : null;
  const stemPartition = useMemo(
    () =>
      isCsa
        ? { stem: "", intro: null as string | null }
        : partitionStemAndSharedIntro(currentQuestion?.question_text ?? ""),
    [isCsa, currentQuestion?.question_text]
  );
  const satSectionForQuestion: SatSection | null =
    isSat && currentQuestion
      ? currentQuestion.sat_section === "rw" || currentQuestion.sat_section === "math"
        ? currentQuestion.sat_section
        : isSatRw(subject)
          ? "rw"
          : "math"
      : null;
  const isEconomicsOrPassage = !isCsa;
  let mergedPassage = isCsaLegacyFallback
    ? ""
    : (currentQuestion?.passage_text?.trim() ?? "");
  let rawStem = isCsaLegacyFallback
    ? (csaSplit?.questionStem ?? "No question text.")
    : (currentQuestion?.question_text ?? "");
  if (!isCsa && stemPartition.intro?.trim()) {
    const s = stemPartition.stem?.trim();
    if (s) rawStem = s;
    const intro = stemPartition.intro.trim();
    mergedPassage = mergedPassage ? `${intro}\n\n${mergedPassage}` : intro;
  }
  if (isSat && !isCsaLegacyFallback && satSectionForQuestion) {
    const satPart = partitionSatStemAndPassage(rawStem, mergedPassage || null, satSectionForQuestion);
    rawStem = satPart.stem;
    mergedPassage = satPart.passage?.trim() ?? "";
  }
  const leftPanelContent = isCsaLegacyFallback
    ? (csaSplit?.codePart ?? currentQuestion?.question_text ?? "")
    : mergedPassage;
  if (
    !isCsaLegacyFallback &&
    isEconomicsOrPassage &&
    mergedPassage &&
    rawStem
  ) {
    rawStem = getStemOnlyIfListPresent(rawStem, mergedPassage) || rawStem;
  }
  const satPassageTextClass = cn(
    "prose prose-2xl max-w-none text-[19.8px] text-gray-800 leading-relaxed whitespace-pre-wrap sm:text-[23.8px]",
    examContentSerifClass
  );
  const apPassageTextClass = cn(
    "prose prose-xl max-w-none whitespace-pre-wrap text-[18.8px] text-gray-800 sm:text-[22.8px]",
    examContentSerifClass
  );
  const leftPassageItemTextClass = isSat
    ? "text-[19.8px] sm:text-[23.8px] leading-relaxed"
    : "text-[18.8px] sm:text-[22.8px] leading-relaxed";
  const apStemTextClass = cn(
    "text-[19px] sm:text-[21px] font-medium leading-snug",
    examContentSerifClass
  );
  const apOptionTextClass = cn("text-[17px] leading-normal", examContentSerifClass);
  const satStemTextClass = cn(
    "text-lg sm:text-xl font-medium leading-snug",
    examContentSerifClass
  );
  const satOptionTextClass = "text-lg leading-normal";
  const hasAnyOption =
    currentQuestion &&
    [
      currentQuestion.option_a,
      currentQuestion.option_b,
      currentQuestion.option_c,
      currentQuestion.option_d,
      currentQuestion.option_e,
    ].some((o) => o != null && String(o).trim() !== "");
  const rightPanelQuestionText =
    (!rawStem || rawStem === "No question text.") && hasAnyOption
      ? "Which of the following is correct?"
      : rawStem;

  const isTableContent =
    isTableHtml(leftPanelContent) ||
    isTableWithOptionLettersFormat(leftPanelContent) ||
    looksLikeTableText(leftPanelContent);
  const showTablePanel =
    isEconomicsOrPassage && !!leftPanelContent?.trim() && isTableContent;
  const showGraphPanel =
    isEconomicsOrPassage &&
    !!pdfUrl &&
    currentQuestion?.page_number != null &&
    currentQuestion?.has_graph !== false &&
    !showTablePanel;
  const isSatMathSection =
    isSat &&
    (currentQuestion?.sat_section === "math" || isSatMath(subject));
  const isSatRwSection =
    isSat &&
    (satSectionForQuestion === "rw" || isSatRw(subject));
  const satRwLongPassage =
    isSatRwSection && !!leftPanelContent?.trim() && leftPanelContent.trim().length >= 80;
  const hasMeaningfulLeftContent =
    showTablePanel ||
    showGraphPanel ||
    satRwLongPassage ||
    (!!leftPanelContent?.trim() &&
      (subject === "AP_CSA" ||
        isTableHtml(leftPanelContent) ||
        isTableWithOptionLettersFormat(leftPanelContent) ||
        looksLikeTableText(leftPanelContent) ||
        isSvgContent(leftPanelContent) ||
        (isEconomicsOrPassage &&
          !looksLikeQuestionStem(leftPanelContent) &&
          !(
            isSatMathSection &&
            currentQuestion?.has_graph &&
            currentQuestion?.page_number != null
          ))));

  const showHeaderZoomToolbar =
    !isCsa && (showGraphPanel || showTablePanel || canExplorePdf);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  if (!upload || !id) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Exam not found.</p>
        <Link href="/dashboard" className="text-blue-600 font-medium hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
        <header className="bg-blue-600 text-white px-6 py-4">
          <Link href="/dashboard" className="font-semibold hover:underline">
            Bluebook
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center p-8">
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm max-w-lg w-full text-center">
            <h1 className="text-xl font-semibold text-gray-900">Start Exam</h1>
            <p className="mt-2 text-sm text-gray-600">{subjectLabel}</p>
            <p className="mt-1 text-sm text-gray-500">
              {questions.length} question{questions.length !== 1 ? "s" : ""}
            </p>
            <div className="mt-5 rounded-md border border-blue-100 bg-blue-50/80 px-4 py-3 text-left text-sm text-gray-700">
              <p>
                During the exam, if anything looks wrong or unclear (question text, cropping, or how a
                graph or figure lines up), use the Show page button in the exam to open the original
                PDF. The on-screen layout is prepared with AI assistance and may not always match the
                source document exactly.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-gray-500">Looks like this in the exam:</span>
                <span
                  className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm pointer-events-none select-none"
                  aria-hidden
                >
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                  Show page
                </span>
              </div>
            </div>
            {preStartUnlockRemaining > 0 ? (
              <p className="mt-4 text-sm text-gray-500" aria-live="polite">
                You can start in {preStartUnlockRemaining}s.
              </p>
            ) : (
              <p className="mt-4 text-sm text-green-700" aria-live="polite">
                Ready when you are.
              </p>
            )}
            <button
              type="button"
              onClick={startExam}
              disabled={starting || preStartUnlockRemaining > 0}
              className={cn(
                "mt-3 w-full rounded-md px-4 py-3 text-sm font-medium text-white",
                starting || preStartUnlockRemaining > 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700"
              )}
            >
              {starting ? "Starting…" : "Start Exam"}
            </button>
            <Link
              href="/dashboard"
              className="mt-4 inline-block text-sm text-gray-500 hover:text-blue-600"
            >
              Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (attemptId && examCompleted && examResult) {
    const r = examResult;
    const m = Math.floor(r.timeSpentSeconds / 60);
    const s = r.timeSpentSeconds % 60;
    const gradedAnswered = r.correctCount + r.incorrectCount;
    const headlineIsScore = !(r.skipAiGrading && gradedAnswered === 0);
    const scoreLabel = !headlineIsScore
      ? "Your responses"
      : r.percentage >= 70
        ? "Well done"
        : r.percentage >= 50
          ? "Good effort"
          : "Keep practicing";
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
        <header className="flex-shrink-0 border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10 px-6 py-4">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900 hover:text-blue-600 transition-colors">
              <BookOpen className="h-6 w-6 text-blue-600" />
              Bluebook Online
            </Link>
            <Link href="/dashboard" className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-blue-600">
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Exam Result</h1>
              <p className="mt-1 text-sm text-gray-500">{upload?.filename ?? "Exam"}</p>
            </div>

            {/* Score highlight */}
            <div className="rounded-2xl border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-white p-8 mb-6 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <div className="flex flex-col items-center">
                  <div className="text-5xl sm:text-6xl font-bold text-blue-600">
                    {headlineIsScore ? `${r.percentage}%` : "—"}
                  </div>
                  <p className="text-sm font-medium text-gray-600 mt-1">{scoreLabel}</p>
                  {r.skipAiGrading && r.notGradedCount > 0 ? (
                    <p className="text-xs text-amber-800 text-center mt-2 max-w-xs">
                      Some questions were not scored (no answer key in the exam data).
                    </p>
                  ) : null}
                </div>
                <div className="h-16 w-px bg-gray-200 hidden sm:block" />
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>Time: {m}:{s.toString().padStart(2, "0")}</span>
                </div>
              </div>
            </div>

            {/* SAT scaled score cards */}
            {r.sat && (r.sat.totalScaled != null || r.sat.rwScaled != null || r.sat.mathScaled != null) && (
              <div className="mb-6">
                <div className="rounded-2xl border-2 border-indigo-200 bg-gradient-to-b from-indigo-50/80 to-white p-6 shadow-sm">
                  <p className="text-center text-xs font-semibold uppercase tracking-wider text-indigo-700">
                    SAT Scaled Score
                  </p>
                  <div className="mt-2 text-center">
                    <span className="text-5xl font-bold text-indigo-700">
                      {r.sat.totalScaled ?? "—"}
                    </span>
                    <span className="text-2xl text-indigo-400 ml-2">/ 1600</span>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-indigo-100 bg-white p-4 text-center">
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Reading & Writing</p>
                      <p className="mt-1 text-3xl font-bold text-gray-900">
                        {r.sat.rwScaled ?? "—"}
                      </p>
                      <p className="text-xs text-gray-500">/ 800</p>
                    </div>
                    <div className="rounded-xl border border-indigo-100 bg-white p-4 text-center">
                      <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Math</p>
                      <p className="mt-1 text-3xl font-bold text-gray-900">
                        {r.sat.mathScaled ?? "—"}
                      </p>
                      <p className="text-xs text-gray-500">/ 800</p>
                    </div>
                  </div>
                  {r.sat.modules.length > 0 && (
                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">
                        Module breakdown
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {r.sat.modules.map((m) => {
                          const mod = SAT_MODULES.find((x) => x.id === m.module);
                          return (
                            <div
                              key={m.module}
                              className="rounded-lg border border-gray-200 bg-white p-3 text-center"
                            >
                              <p className="text-[11px] font-medium text-gray-600 leading-tight">
                                {mod?.shortLabel ?? m.module}
                              </p>
                              <p className="mt-1 text-base font-semibold text-gray-900">
                                {m.correct}/{m.total}
                              </p>
                              <p className="text-[10px] text-gray-400">
                                {m.total > 0 ? Math.round((m.correct / m.total) * 100) : 0}%
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <p className="mt-4 text-[11px] text-gray-500 leading-relaxed text-center">
                    Scaled scores are an approximation of the College Board scoring algorithm. Actual SAT scores depend on the exam form&apos;s adaptive routing and statistical equating.
                  </p>
                </div>
              </div>
            )}

            {/* Stats cards */}
            <div className={cn("grid grid-cols-2 gap-4 mb-6", r.notGradedCount > 0 ? "sm:grid-cols-5" : "sm:grid-cols-4")}>
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
                <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-1" />
                <p className="text-2xl font-bold text-green-700">{r.correctCount}</p>
                <p className="text-xs font-medium text-green-600">Correct</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center">
                <XCircle className="h-8 w-8 mx-auto text-red-600 mb-1" />
                <p className="text-2xl font-bold text-red-700">{r.incorrectCount}</p>
                <p className="text-xs font-medium text-red-600">Incorrect</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
                <CircleDashed className="h-8 w-8 mx-auto text-gray-500 mb-1" />
                <p className="text-2xl font-bold text-gray-600">{r.unansweredCount}</p>
                <p className="text-xs font-medium text-gray-500">Unanswered</p>
              </div>
              {r.notGradedCount > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <CircleDashed className="h-8 w-8 mx-auto text-amber-600 mb-1" />
                  <p className="text-2xl font-bold text-amber-800">{r.notGradedCount}</p>
                  <p className="text-xs font-medium text-amber-700">Not graded</p>
                </div>
              ) : null}
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
                <BarChart3 className="h-8 w-8 mx-auto text-blue-600 mb-1" />
                <p className="text-2xl font-bold text-blue-700">{r.total}</p>
                <p className="text-xs font-medium text-blue-600">Total</p>
              </div>
            </div>

            <div
              className={cn(
                "mb-4 rounded-lg border px-4 py-3 text-sm",
                r.skipAiGrading
                  ? "border-slate-200 bg-slate-50 text-slate-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              )}
            >
              {r.skipAiGrading ? (
                <>
                  <strong>Note:</strong> You finished without AI grading. Only questions with an answer key in the
                  exam could be scored automatically.
                </>
              ) : (
                <>
                  <strong>Note:</strong> Results may not be 100% accurate. AI-generated answers and explanations are
                  for reference only.
                </>
              )}
            </div>
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Question Details</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isSat
                    ? "Expand a module, click a row to view the question, then load explanation if needed"
                    : "Click a row to view solution or show question"}
                </p>
              </div>
              {isSat && satResultGroups.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {satResultGroups.map((group) => {
                    const groupBreakdown = group.questions
                      .map((gq) =>
                        r.breakdown.find((b) => b.questionNumber === gq.question_number)
                      )
                      .filter((x): x is (typeof r.breakdown)[number] => !!x);
                    const correctInGroup = groupBreakdown.filter((b) => b.isCorrect).length;
                    return (
                      <details key={group.id} className="group">
                        <summary className="cursor-pointer bg-gray-50/80 px-4 py-3 font-medium text-gray-900 flex items-center justify-between list-none [&::-webkit-details-marker]:hidden">
                          <span className="flex items-center gap-2 min-w-0">
                            <ChevronDown className="h-4 w-4 shrink-0 text-gray-500 transition-transform group-open:rotate-180" />
                            <span className="truncate">{group.label}</span>
                          </span>
                          <span className="text-sm font-normal text-gray-500 shrink-0 ml-2">
                            {correctInGroup}/{groupBreakdown.length} correct
                          </span>
                        </summary>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 bg-gray-50">
                                <th className="text-left px-4 py-3 font-medium text-gray-700">#</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-700">Your Answer</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-700">Correct</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {group.questions.map((gq) => {
                                const row = r.breakdown.find(
                                  (b) => b.questionNumber === gq.question_number
                                );
                                if (!row) return null;
                                const hasUser =
                                  row.userAnswer != null && String(row.userAnswer).trim() !== "";
                                const hasKey =
                                  row.correctAnswer != null &&
                                  String(row.correctAnswer).trim() !== "";
                                const status = !hasUser
                                  ? "unanswered"
                                  : !hasKey
                                    ? "not_graded"
                                    : row.isCorrect
                                      ? "correct"
                                      : "incorrect";
                                const displayNum = getModuleDisplayNumber(group.questions, gq);
                                return (
                                  <tr
                                    key={row.questionNumber}
                                    onClick={() => handleResultRowClick(row.questionNumber)}
                                    className={cn(
                                      "border-b border-gray-100 cursor-pointer transition-colors",
                                      selectedResultQuestion === row.questionNumber
                                        ? "bg-blue-50"
                                        : "hover:bg-gray-50"
                                    )}
                                  >
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                      {displayNum}
                                    </td>
                                    <td className="px-4 py-3">{row.userAnswer ?? "—"}</td>
                                    <td className="px-4 py-3">{row.correctAnswer ?? "—"}</td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={cn(
                                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                          status === "correct" && "bg-green-100 text-green-800",
                                          status === "incorrect" && "bg-red-100 text-red-800",
                                          status === "unanswered" && "bg-gray-100 text-gray-600",
                                          status === "not_graded" && "bg-amber-100 text-amber-900"
                                        )}
                                      >
                                        {status === "correct"
                                          ? "Correct"
                                          : status === "incorrect"
                                            ? "Incorrect"
                                            : status === "unanswered"
                                              ? "Unanswered"
                                              : "Not graded"}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    );
                  })}
                </div>
              ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left px-4 py-3 font-medium text-gray-700">#</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Your Answer</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Correct</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.breakdown.map((row) => {
                      const hasUser =
                        row.userAnswer != null && String(row.userAnswer).trim() !== "";
                      const hasKey =
                        row.correctAnswer != null && String(row.correctAnswer).trim() !== "";
                      const status = !hasUser
                        ? "unanswered"
                        : !hasKey
                          ? "not_graded"
                          : row.isCorrect
                            ? "correct"
                            : "incorrect";
                      return (
                        <tr
                          key={row.questionNumber}
                          onClick={() => handleResultRowClick(row.questionNumber)}
                          className={cn(
                            "border-b border-gray-100 cursor-pointer transition-colors",
                            selectedResultQuestion === row.questionNumber ? "bg-blue-50" : "hover:bg-gray-50"
                          )}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">{row.questionNumber}</td>
                          <td className="px-4 py-3">{row.userAnswer ?? "—"}</td>
                          <td className="px-4 py-3">{row.correctAnswer ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                status === "correct" && "bg-green-100 text-green-800",
                                status === "incorrect" && "bg-red-100 text-red-800",
                                status === "unanswered" && "bg-gray-100 text-gray-600",
                                status === "not_graded" && "bg-amber-100 text-amber-900"
                              )}
                            >
                              {status === "correct"
                                ? "Correct"
                                : status === "incorrect"
                                  ? "Incorrect"
                                  : status === "unanswered"
                                    ? "Unanswered"
                                    : "Not graded"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              )}
            </div>
            {selectedResultQuestion != null && (() => {
              const selectedQ = questions.find((q) => q.question_number === selectedResultQuestion);
              const selectedDisplayNum =
                selectedQ && isSat
                  ? getModuleDisplayNumber(questions, selectedQ)
                  : selectedQ?.question_number;
              return (
                <div className="mt-6 rounded-xl border-2 border-blue-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setResultViewMode("question")}
                        className={cn(
                          "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                          resultViewMode === "question"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                      >
                        Show question
                      </button>
                      <button
                        type="button"
                        onClick={() => void loadResultExplanation(selectedResultQuestion)}
                        className={cn(
                          "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                          resultViewMode === "explanation"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                      >
                        Solution explanation
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedResultQuestion(null);
                        setResultExplanation(null);
                        setResultViewMode("question");
                      }}
                      className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <X className="h-4 w-4" />
                      Close
                    </button>
                  </div>
                  {resultViewMode === "explanation" ? (
                    resultExplanationLoading ? (
                      <p className="text-sm text-gray-500">Loading explanation…</p>
                    ) : resultExplanation ? (
                      <div className="text-sm text-gray-700 whitespace-pre-wrap">{resultExplanation}</div>
                    ) : null
                  ) : selectedQ ? (
                    <div className="space-y-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-200 text-gray-900 font-bold">
                        {selectedDisplayNum ?? 0}
                      </div>
                      {selectedQ.passage_text?.trim() ? (
                        <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Passage</p>
                          <div className="text-sm text-gray-800 whitespace-pre-wrap">{selectedQ.passage_text}</div>
                        </div>
                      ) : null}
                      {selectedQ.precondition_text?.trim() ? (
                        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Precondition</p>
                          <pre className="text-sm font-mono text-gray-700 whitespace-pre-wrap">{selectedQ.precondition_text}</pre>
                        </div>
                      ) : null}
                      <p className="text-gray-900 font-medium">{selectedQ.question_text || "Which of the following is correct?"}</p>
                      <div className="space-y-2">
                        {[
                          { key: "A", text: selectedQ.option_a },
                          { key: "B", text: selectedQ.option_b },
                          { key: "C", text: selectedQ.option_c },
                          { key: "D", text: selectedQ.option_d },
                          { key: "E", text: selectedQ.option_e },
                        ]
                          .filter((o): o is { key: string; text: string } => o.text != null && o.text.trim() !== "")
                          .map(({ key, text }) => (
                            <div
                              key={key}
                              className="flex items-start gap-3 rounded-lg border border-gray-300 px-4 py-3 bg-white text-left text-sm"
                            >
                              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-400 font-medium">
                                {key}
                              </span>
                              <span className="flex-1 min-w-0 text-gray-800">{text}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })()}
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={`/exam/${id}`}
                className="inline-flex items-center gap-2 rounded-lg border-2 border-blue-600 bg-white px-6 py-3 text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Retry exam
              </Link>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <LayoutDashboard className="h-4 w-4" />
                Back to Dashboard
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <BookOpen className="h-4 w-4" />
                Home
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const options = [
    { key: "A" as const, text: currentQuestion?.option_a },
    { key: "B" as const, text: currentQuestion?.option_b },
    { key: "C" as const, text: currentQuestion?.option_c },
    { key: "D" as const, text: currentQuestion?.option_d },
    { key: "E" as const, text: currentQuestion?.option_e },
  ].filter((o) => o.text != null && o.text.trim() !== "");

  const emptyModulePanel = (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">
        {currentModuleDef?.label ?? "This module"} has no questions
      </h2>
      <p className="text-sm text-gray-600">
        This module could not be loaded from the uploaded PDF. You can go back to the previous module,
        skip to the next available module, or return to the dashboard.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {currentAvailIndex > 0 && (
          <button
            type="button"
            onClick={() => {
              const prev = availableModules[currentAvailIndex - 1];
              if (prev) setCurrentModuleId(prev.id);
            }}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Previous module
          </button>
        )}
        {nextModuleDef && nextModuleQuestionCount > 0 && (
          <button
            type="button"
            onClick={() => void goToNextModule()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Skip to {nextModuleDef.shortLabel}
          </button>
        )}
        <Link
          href="/dashboard?program=sat"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );

  const examHeaderTitle = formatExamHeaderTitle(
    isSat,
    subject,
    currentModuleDef ?? null,
    currentModuleId
  );
  const displayUsername = formatDisplayUsername(userName, userEmail);

  const questionBlockContent = isEmptySatModule ? (
    emptyModulePanel
  ) : (
    <>
      <ExamQuestionChrome
        displayQuestionNumber={displayQuestionNumber}
        markedForReview={currentQuestion ? markedForReview.has(currentQuestion.id) : false}
        onToggleMarkForReview={() =>
          currentQuestion && toggleMarkForReview(currentQuestion.id)
        }
      />
      <p
        className={cn(
          "text-gray-900 select-text cursor-text",
          isSat ? satStemTextClass : apStemTextClass
        )}
        onMouseUp={(e) => {
          const offsets = getSelectionOffsets(e.currentTarget);
          if (offsets && offsets.start < offsets.end && currentQuestion) {
            applyHighlightSelection(`${currentQuestion.id}-stem`, offsets.start, offsets.end);
          }
        }}
      >
        {renderTextWithHighlights(
          rightPanelQuestionText,
          highlights[currentQuestion?.id ? `${currentQuestion.id}-stem` : ""] ?? []
        )}
      </p>
      {currentQuestion?.question_type === "grid_in" ? (
        <SatGridInInput
          key={currentQuestion.id}
          large={isSat}
          value={answers[currentQuestion.id] ?? ""}
          onCommit={(v) => {
            if (!currentQuestion) return;
            setAnswers((prev) => ({ ...prev, [currentQuestion.id]: v }));
            saveAnswer(
              currentQuestion.id,
              v === "" ? null : v,
              markedForReview.has(currentQuestion.id)
            );
          }}
        />
      ) : (
      <div className="space-y-2">
        {options.map(({ key, text }) => {
          const isSelected = currentQuestion && answers[currentQuestion.id] === key;
          const isEliminated = currentQuestion && eliminatedOptions.get(currentQuestion.id)?.has(key);
          const showAsCode = isCsa && optionLooksLikeCode(text ?? null);
          const optionContent = text ?? "";
          const blockId = currentQuestion ? `${currentQuestion.id}-opt-${key}` : "";
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!currentQuestion) return;
                setAnswers((prev) => ({ ...prev, [currentQuestion.id]: key }));
                saveAnswer(
                  currentQuestion.id,
                  key,
                  markedForReview.has(currentQuestion.id)
                );
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (!currentQuestion) return;
                  setAnswers((prev) => ({ ...prev, [currentQuestion.id]: key }));
                  saveAnswer(
                    currentQuestion.id,
                    key,
                    markedForReview.has(currentQuestion.id)
                  );
                }
              }}
              className={cn(
                "relative w-full flex cursor-pointer items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors",
                isSat ? satOptionTextClass : apOptionTextClass,
                isSelected ? examUi.optionSelected : cn(examUi.optionBorder, "bg-white hover:border-gray-400 hover:bg-gray-50 text-gray-800"),
                isEliminated && "bg-gray-100"
              )}
            >
              {isEliminated && (
                <div
                  className="absolute left-4 right-12 top-1/2 h-px -translate-y-1/2 bg-gray-400 pointer-events-none z-0"
                  aria-hidden
                />
              )}
              <div
                className={cn(
                  "relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 font-medium mt-0.5 transition-colors",
                  isSelected ? examUi.optionLetterSelected : "border-gray-400 bg-transparent"
                )}
              >
                {key}
              </div>
              <span
                className={cn(
                  "relative z-10 flex-1 min-w-0 select-text",
                  isEliminated && "text-gray-500"
                )}
                onMouseUp={(e) => {
                  const offsets = getSelectionOffsets(e.currentTarget);
                  if (offsets && offsets.start < offsets.end && blockId) {
                    applyHighlightSelection(blockId, offsets.start, offsets.end);
                  }
                }}
              >
                {showAsCode ? (
                  <pre className="text-sm font-mono whitespace-pre-wrap break-words bg-gray-50 rounded p-2 overflow-x-auto">
                    <code>
                      {renderTextWithHighlights(optionContent, highlights[blockId] ?? [])}
                    </code>
                  </pre>
                ) : (
                  renderTextWithHighlights(optionContent, highlights[blockId] ?? [])
                )}
              </span>
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentQuestion) toggleEliminate(currentQuestion.id, key);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    if (currentQuestion) toggleEliminate(currentQuestion.id, key);
                  }
                }}
                className={cn(
                  "relative z-10 flex flex-shrink-0 cursor-pointer items-center justify-center hover:bg-gray-50",
                  examUi.eliminateCircle,
                  isEliminated && examUi.eliminateCircleActive
                )}
                aria-label={isEliminated ? "Undo elimination" : "Eliminate option"}
              >
                <span className={cn(isEliminated && "line-through")}>{key}</span>
              </span>
            </div>
          );
        })}
      </div>
      )}
    </>
  );

  return (
    <GraphZoomProvider>
    <div className="min-h-screen flex flex-col bg-white">
      {/* Java Quick Reference Drawer - CSA only */}
      {isCsa && (
        <>
          <div
            className={cn(
              "fixed inset-0 bg-black/20 z-40 transition-opacity duration-300",
              referenceOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            onClick={() => setReferenceOpen(false)}
            aria-hidden="true"
          />
          <div
            className={cn(
              "fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-xl z-50 overflow-hidden flex flex-col transition-transform duration-300 ease-out",
              referenceOpen ? "translate-x-0" : "translate-x-full"
            )}
          >
            <div className="flex-shrink-0 bg-gray-700 text-white px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Reference Sheet</h2>
              <div className="flex items-center gap-1">
                <button type="button" className="p-1.5 rounded hover:bg-gray-600">
                  <MoreHorizontal className="h-5 w-5" />
                </button>
                <button type="button" className="p-1.5 rounded hover:bg-gray-600">
                  <Maximize2 className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setReferenceOpen(false)}
                  className="p-1.5 rounded hover:bg-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="flex-shrink-0 border-b border-gray-200 px-4 py-2 flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setReferenceExpandedSections(
                    new Set(JAVA_QUICK_REFERENCE.map((c) => c.className))
                  )
                }
                className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-2 py-1 hover:bg-gray-50"
              >
                Expand All
              </button>
              <button
                type="button"
                onClick={() => setReferenceExpandedSections(new Set())}
                className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-2 py-1 hover:bg-gray-50"
              >
                Collapse All
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <p className="text-sm text-gray-500 mb-4">
                Accessible methods from the Java library that may be included in the exam.
              </p>
              <div className="space-y-1">
                {JAVA_QUICK_REFERENCE.map((cls) => {
                  const isExpanded = referenceExpandedSections.has(cls.className);
                  return (
                    <div key={cls.className}>
                      <button
                        type="button"
                        onClick={() => {
                          setReferenceExpandedSections((prev) => {
                            const next = new Set(prev);
                            if (next.has(cls.className)) next.delete(cls.className);
                            else next.add(cls.className);
                            return next;
                          });
                        }}
                        className="w-full flex items-center justify-between bg-blue-600 text-white font-medium py-2 px-3 text-left hover:bg-blue-700 transition-colors"
                      >
                        <span>{cls.className} Class</span>
                        <span className="flex-shrink-0">
                          {isExpanded ? (
                            <Minus className="h-4 w-4" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </span>
                      </button>
                      {isExpanded && (
                        <table className="w-full border-collapse border border-gray-300 border-t-0 text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">
                                Class Method and Constants
                              </th>
                              <th className="border border-gray-300 px-3 py-2 text-left font-medium text-gray-700">
                                Explanation
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {cls.methods.map((m, i) => (
                              <tr key={i}>
                                <td className="border border-gray-300 px-3 py-2 font-mono text-gray-800 whitespace-nowrap bg-gray-50">
                                  {m.signature}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-gray-700">
                                  {m.explanation}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Calculator - all calculator-allowed subjects */}
      {isCalculatorAllowed && (
        <>
          <div
            className={cn(
              "fixed inset-0 bg-black/20 z-40 transition-opacity duration-300",
              calculatorOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            onClick={() => setCalculatorOpen(false)}
            aria-hidden="true"
          />
          <div
            className={cn(
              "fixed z-50 rounded-lg bg-white shadow-2xl overflow-hidden transition-opacity duration-300",
              isCalculatorScientific ? "w-80" : "w-72",
              calculatorOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            style={{ left: calculatorPos.x, top: calculatorPos.y }}
          >
            <div className="flex-shrink-0 bg-gray-900 text-white px-3 py-2 flex items-center justify-between">
              <span
                className="font-medium flex-1 cursor-grab active:cursor-grabbing select-none"
                onMouseDown={handleCalculatorDragStart}
              >
                Calculator
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button type="button" className="p-1 rounded hover:bg-gray-700" onMouseDown={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                <button type="button" className="p-1 rounded hover:bg-gray-700" onMouseDown={(e) => e.stopPropagation()}>
                  <Maximize2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCalculatorOpen(false)}
                  className="p-1 rounded hover:bg-gray-700"
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className={cn("p-3", isCalculatorScientific ? "bg-white" : "bg-gray-100")}>
              <div
                className={cn(
                  "rounded px-3 py-2 mb-3 font-mono text-xl text-right min-h-[2.5rem]",
                  isCalculatorScientific ? "bg-white border-2 border-blue-500" : "bg-white border border-gray-300"
                )}
              >
                {calculatorDisplay || "0"}
              </div>
              {isCalculatorScientific ? (
                <>
                  <div className="flex items-center gap-2 mb-2 text-sm">
                    <div className="flex gap-0.5">
                      <span className="px-2 py-1 border-b-2 border-blue-600 font-medium">main</span>
                      <span className="px-2 py-1 text-gray-400">abc</span>
                      <span className="px-2 py-1 text-gray-400">func</span>
                    </div>
                    <div className="flex gap-1 ml-auto">
                      <button
                        type="button"
                        onClick={() => setCalculatorRadians(true)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          calculatorRadians ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                        )}
                      >
                        RAD
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalculatorRadians(false)}
                        className={cn(
                          "px-2 py-1 rounded text-xs font-medium",
                          !calculatorRadians ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-600"
                        )}
                      >
                        DEG
                      </button>
                      <button type="button" className="p-1 rounded hover:bg-gray-100">
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" className="p-1 rounded hover:bg-gray-100 opacity-50">
                        <RotateCw className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setCalculatorDisplay("")} className="text-xs text-gray-500">
                        clear all
                      </button>
                      <button type="button" className="p-1 rounded hover:bg-gray-100">
                        <Wrench className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {[
                      ["a²", "a^b", "|a|", "√", "ⁿ√", "π"],
                      ["sin", "cos", "tan", "(", ")", ","],
                    ].map((row, ri) =>
                      row.map((label) => {
                        const insert =
                          label === "a²"
                            ? "²"
                            : label === "a^b"
                              ? "^"
                              : label === "|a|"
                                ? "|"
                                : label === "ⁿ√"
                                  ? "√"
                                  : label === "π"
                                    ? "π"
                                    : label === "sin"
                                      ? "sin("
                                      : label === "cos"
                                        ? "cos("
                                        : label === "tan"
                                          ? "tan("
                                          : label;
                        return (
                          <button
                            key={`${ri}-${label}`}
                            type="button"
                            onClick={() => setCalculatorDisplay((d) => d + insert)}
                            className="p-2 rounded bg-gray-100 hover:bg-gray-200 text-sm font-medium"
                          >
                            {label}
                          </button>
                        );
                      })
                    )}
                    {[
                      ["7", "8", "9", "÷", "%", "a/b"],
                      ["4", "5", "6", "×", "←", "→"],
                      ["1", "2", "3", "-", "C", ""],
                      ["0", ".", "ans", "+", "=", "="],
                    ].map((row, ri) =>
                      row.map((sym, si) => {
                        if (sym === "") return <div key={`n-${ri}-${si}`} />;
                        if (sym === "←")
                          return (
                            <button
                              key={`n-${ri}-${si}`}
                              type="button"
                              onClick={() => setCalculatorDisplay((d) => d.slice(0, -1))}
                              className="p-2 rounded bg-gray-100 hover:bg-gray-200 text-sm"
                            >
                              <Delete className="h-4 w-4 mx-auto" />
                            </button>
                          );
                        if (sym === "→") return <button key={`n-${ri}-${si}`} type="button" className="p-2 rounded bg-gray-100 opacity-50" />;
                        if (sym === "C")
                          return (
                            <button
                              key={`n-${ri}-${si}`}
                              type="button"
                              onClick={() => setCalculatorDisplay("")}
                              className="p-2 rounded bg-gray-100 hover:bg-gray-200 text-sm"
                            >
                              ×
                            </button>
                          );
                        if (sym === "=" && si === 4)
                          return (
                            <button
                              key={`n-${ri}-${si}`}
                              type="button"
                              onClick={() => {
                                const result = safeCalculatorEvalScientific(
                                  calculatorDisplay || "0",
                                  calculatorLastResult,
                                  calculatorRadians
                                );
                                if (result != null) {
                                  setCalculatorLastResult(result);
                                  setCalculatorDisplay(String(result));
                                }
                              }}
                              className="p-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-lg font-medium col-span-2 flex items-center justify-center"
                            >
                              =
                            </button>
                          );
                        if (sym === "=" && si === 5) return null;
                        const insertStr = sym === "a/b" ? "/" : sym;
                        return (
                          <button
                            key={`n-${ri}-${si}`}
                            type="button"
                            onClick={() =>
                              setCalculatorDisplay(
                                sym === "ans"
                                  ? (d: string) => d + (d && /\d$/.test(d) ? "*" : "") + "ans"
                                  : (d: string) => d + insertStr
                              )
                            }
                            className="p-2 rounded bg-gray-100 hover:bg-gray-200 text-sm font-medium"
                          >
                            {sym}
                          </button>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-5 gap-1 mb-1">
                    <button type="button" onClick={() => setCalculatorDisplay("")} className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-sm">
                      <RotateCcw className="h-4 w-4 mx-auto" />
                    </button>
                    <button type="button" onClick={() => setCalculatorDisplay("")} className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-sm">
                      <RotateCw className="h-4 w-4 mx-auto" />
                    </button>
                    <button type="button" onClick={() => setCalculatorDisplay("")} className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-xs">
                      clear all
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalculatorDisplay((d) => d.slice(0, -1))}
                      className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                    >
                      <Delete className="h-4 w-4 mx-auto" />
                    </button>
                    <button type="button" className="p-2 rounded bg-gray-200 hover:bg-gray-300">
                      <Wrench className="h-4 w-4 mx-auto" />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-1 grid-rows-[repeat(6,auto)]">
                    <button type="button" onClick={() => setCalculatorDisplay((d) => d + "(")} className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium">
                      (
                    </button>
                    <button type="button" onClick={() => setCalculatorDisplay((d) => d + ")")} className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium">
                      )
                    </button>
                    <button type="button" onClick={() => setCalculatorDisplay((d) => d + "√")} className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium">
                      √
                    </button>
                    <button type="button" onClick={() => setCalculatorDisplay((d) => d + "÷")} className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium">
                      ÷
                    </button>
                    {[
                      ["7", "8", "9", "×"],
                      ["4", "5", "6", "-"],
                      ["1", "2", "3", "+"],
                    ].map((row) =>
                      row.map((sym) => (
                        <button
                          key={sym}
                          type="button"
                          onClick={() => setCalculatorDisplay((d) => d + sym)}
                          className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium"
                        >
                          {sym}
                        </button>
                      ))
                    )}
                    <button type="button" onClick={() => setCalculatorDisplay((d) => d + "0")} className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium">
                      0
                    </button>
                    <button type="button" onClick={() => setCalculatorDisplay((d) => d + ".")} className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium">
                      .
                    </button>
                    <button
                      type="button"
                      onClick={() => setCalculatorDisplay((d) => d + (d && /\d$/.test(d) ? "*" : "") + "ans")}
                      className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                    >
                      ans
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const result = safeCalculatorEval(calculatorDisplay || "0", calculatorLastResult);
                        if (result != null) {
                          setCalculatorLastResult(result);
                          setCalculatorDisplay(String(result));
                        }
                      }}
                      className="p-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-lg font-medium row-span-2 flex items-center justify-center"
                    >
                      =
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}

      <ExamHeader
        headerTitle={examHeaderTitle}
        directionsOpen={directionsOpen}
        onToggleDirections={() => setDirectionsOpen((o) => !o)}
        directionsContent={
          isSat ? (
            <>
              Answer all questions in this module. You can mark questions for review and navigate with
              Back/Next. {isSatFull ? 'Click "Submit Module" when you finish to move on.' : null}
            </>
          ) : (
            <>
              Answer the multiple-choice questions. You can mark questions for review and navigate with
              Back/Next.
            </>
          )
        }
        timerVisible={timerVisible}
        timerPaused={timerPaused}
        elapsedSeconds={elapsedSeconds}
        onToggleTimerPause={() => setTimerPaused((p) => !p)}
        onHideTimer={() => setTimerVisible(false)}
        onShowTimer={() => setTimerVisible(true)}
        toolbar={
          <>
            <button
              type="button"
              onClick={() => void saveAndExit()}
              disabled={savingExit}
              className="flex items-center gap-1.5 rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-50 shrink-0"
            >
              <Save className="h-4 w-4 shrink-0" />
              {savingExit ? "Saving…" : "Save & exit"}
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5">
              <button
                type="button"
                onClick={() => setHighlightToolbarOpen((o) => !o)}
                className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
                title="Highlights & Notes"
              >
                <div className="flex items-center gap-1">
                  <Highlighter className="h-4 w-4" />
                  <StickyNote className="h-4 w-4" />
                </div>
                <span className="text-xs font-medium">Highlights & Notes</span>
              </button>
              {highlightToolbarOpen && (
                <>
                  <button
                    type="button"
                    onClick={() => setHighlightMode((m) => (m === "yellow" ? null : "yellow"))}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-colors",
                  highlightMode === "yellow"
                    ? "bg-yellow-200 border-yellow-600 ring-2 ring-yellow-400"
                    : "bg-yellow-200 border-transparent hover:border-yellow-400"
                )}
                title="Yellow highlight"
              />
              <button
                type="button"
                onClick={() => setHighlightMode((m) => (m === "blue" ? null : "blue"))}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-colors",
                  highlightMode === "blue"
                    ? "bg-blue-200 border-blue-600 ring-2 ring-blue-400"
                    : "bg-blue-200 border-transparent hover:border-blue-400"
                )}
                title="Light blue highlight"
              />
              <button
                type="button"
                onClick={() => setHighlightMode((m) => (m === "pink" ? null : "pink"))}
                className={cn(
                  "w-8 h-8 rounded-full border-2 transition-colors",
                  highlightMode === "pink"
                    ? "bg-pink-200 border-pink-600 ring-2 ring-pink-400"
                    : "bg-pink-200 border-transparent hover:border-pink-400"
                )}
                title="Light pink highlight"
              />
              <button
                type="button"
                onClick={() => setHighlightMode((m) => (m === "eraser" ? null : "eraser"))}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors bg-gray-100",
                  highlightMode === "eraser"
                    ? "border-gray-600 ring-2 ring-gray-400"
                    : "border-transparent hover:border-gray-400"
                )}
                title="Eraser"
              >
                <Eraser className="h-4 w-4 text-gray-600" />
              </button>
              <div className="w-px h-5 bg-gray-300" />
              <button
                type="button"
                onClick={() => setNoteWidgetOpen((o) => !o)}
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors",
                  noteWidgetOpen
                    ? "bg-amber-100 border-amber-500 ring-2 ring-amber-300"
                    : "bg-white border-gray-300 hover:border-amber-400 hover:bg-amber-50"
                )}
                title="Add note"
              >
                <StickyNote className="h-4 w-4 text-amber-600" />
              </button>
                </>
              )}
            </div>
            {noteWidgetOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-gray-300 bg-white z-50 overflow-hidden">
                <div className="flex items-center justify-between bg-amber-300 px-3 py-2">
                  <span className="font-bold text-gray-900">
                    {currentQuestion ? `Q${displayQuestionNumber}` : "Note"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNoteWidgetOpen(false)}
                    className="p-1 rounded-full hover:bg-amber-400/50"
                    title="Close note"
                  >
                    <Delete className="h-4 w-4 text-gray-700" />
                  </button>
                </div>
                <div className="p-3 bg-white">
                  <textarea
                    value={notes[currentQuestion?.id ?? ""] ?? ""}
                    onChange={(e) => {
                      if (!currentQuestion) return;
                      setNotes((prev) => ({ ...prev, [currentQuestion.id]: e.target.value }));
                    }}
                    placeholder="Notes are saved automatically."
                    className="w-full min-h-[100px] rounded border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent resize-none"
                    disabled={!currentQuestion}
                  />
                </div>
              </div>
            )}
            {isCsa ? (
              <button
                type="button"
                onClick={() => setReferenceOpen(true)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <Superscript className="h-4 w-4" /> Reference
              </button>
            ) : (
              <span className="flex items-center gap-1 text-sm text-gray-600">
                <Superscript className="h-4 w-4" /> Reference
              </span>
            )}
            {isCalculatorAllowed ? (
              <button
                type="button"
                onClick={() => setCalculatorOpen(true)}
                className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                <Calculator className="h-4 w-4" /> Calculator
              </button>
            ) : null}
            {needsDesmos && (currentModuleDef?.section === "math" || (!isSatFull && isSatMath(subject))) ? (
              <button
                type="button"
                onClick={() => setDesmosOpen((o) => !o)}
                className={cn(
                  "flex items-center gap-1 text-sm hover:text-gray-900",
                  desmosOpen ? "text-blue-700 font-medium" : "text-gray-600"
                )}
              >
                <Calculator className="h-4 w-4" /> Desmos
              </button>
            ) : null}
            <button type="button" className="rounded p-1 hover:bg-gray-100">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </>
        }
      />

      {/* Main: split when left content exists, else single centered column */}
      <main className="flex min-h-0 flex-1 overflow-hidden bg-white">
        {hasMeaningfulLeftContent ? (
          <>
            {/* Left panel */}
            <div
              className="min-h-0 min-w-0 flex-shrink-0 overflow-auto border-r border-gray-300 bg-white"
              style={{ width: `${leftPanelPercent}%` }}
            >
              <div className="p-4 h-full relative min-w-0">
                {(pdfUrl || showHeaderZoomToolbar) && (
                    <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
                      {pdfUrl && (
                        <button
                          type="button"
                          onClick={() => setFullPageModalOpen(true)}
                          className="rounded border border-gray-300 bg-white/90 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50"
                          aria-label="Show page"
                        >
                          <Maximize2 className="mr-1 inline h-3.5 w-3.5" />
                          Show page
                        </button>
                      )}
                      <GraphZoomHeaderToolbar visible={showHeaderZoomToolbar} />
                    </div>
                  )}
                {showTablePanel ? (
                  canExplorePdf ? (
                    <PdfExplorePanel
                      key={currentQuestion?.id}
                      pdfUrl={pdfUrl!}
                      pageNumber={currentQuestion!.page_number!}
                      bbox={currentQuestion!.bbox!}
                      onRendered={handleGraphRendered}
                      className="max-w-full"
                    />
                  ) : (
                    <ZoomableImagePanel key={currentQuestion?.id} className="max-w-full">
                      {usableStoredImgSrc ? (
                        <SafeStorageImage
                          src={usableStoredImgSrc}
                          alt="Table"
                          onUnusable={() => markImageUnusable(usableStoredImgSrc)}
                        />
                      ) : (() => {
                        const tableHtml = getTableHtmlForPanel(leftPanelContent!);
                        return tableHtml.trim() ? (
                          <TableImageView
                            tableHtml={tableHtml}
                            onRendered={handleTableRendered}
                            className="overflow-auto max-w-full"
                          />
                        ) : (
                          <div
                            className={cn(TABLE_FALLBACK_CLASS, "bg-white", "overflow-auto max-w-full")}
                            style={{ minWidth: 200 }}
                            dangerouslySetInnerHTML={{ __html: sanitizeTableHtml(leftPanelContent!) }}
                          />
                        );
                      })()}
                    </ZoomableImagePanel>
                  )
                ) : showGraphPanel ? (
                  canExplorePdf ? (
                    <PdfExplorePanel
                      key={currentQuestion?.id}
                      pdfUrl={pdfUrl!}
                      pageNumber={currentQuestion!.page_number!}
                      bbox={currentQuestion!.bbox!}
                      onRendered={handleGraphRendered}
                      className="max-w-full"
                    />
                  ) : (
                    <ZoomableImagePanel key={currentQuestion?.id} className="max-w-full">
                      {usableStoredImgSrc ? (
                        <SafeStorageImage
                          src={usableStoredImgSrc}
                          alt="Graph"
                          onUnusable={() => markImageUnusable(usableStoredImgSrc)}
                        />
                      ) : (
                        <PdfPageView
                          pdfUrl={pdfUrl}
                          pageNumber={currentQuestion.page_number ?? 1}
                          bbox={currentQuestion.bbox ?? undefined}
                          onRendered={handleGraphRendered}
                          className="max-w-full h-auto"
                        />
                      )}
                    </ZoomableImagePanel>
                  )
                ) : leftPanelContent ? (
                  subject === "AP_CSA" ? (
                    <>
                      {(() => {
                        const { referenceList, codePart } = splitCsaPassage(leftPanelContent);
                        return (
                          <>
                            {referenceList && (
                              <>
                                <p className="text-[17px] font-medium text-gray-900 mb-2">Consider the following.</p>
                                <HighlightableTextBlock
                                  blockId={
                                    currentQuestion
                                      ? `${currentQuestion.id}-passage-ref`
                                      : "passage-ref"
                                  }
                                  text={referenceList}
                                  highlightRanges={
                                    highlights[
                                      currentQuestion
                                        ? `${currentQuestion.id}-passage-ref`
                                        : "passage-ref"
                                    ] ?? []
                                  }
                                  className="text-[17px] text-gray-900 whitespace-pre-wrap mb-4 rounded-md border border-gray-200 bg-gray-50 p-4"
                                  onApplyHighlight={applyHighlightSelection}
                                />
                              </>
                            )}
                            {codePart && (
                              <>
                                <p className="text-[17px] font-medium text-gray-900 mb-2">Consider the following code segment.</p>
                                <pre className="text-[17px] font-mono bg-gray-100 text-gray-900 p-4 rounded-md overflow-auto whitespace-pre border border-gray-200">
                                  <code>{codePart}</code>
                                </pre>
                              </>
                            )}
                          </>
                        );
                      })()}
                      {currentQuestion?.precondition_text?.trim() ? (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                            Precondition
                          </p>
                          <pre className="text-[17px] font-mono text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-md overflow-auto">
                            {currentQuestion.precondition_text}
                          </pre>
                        </div>
                      ) : null}
                    </>
                  ) : (isTableHtml(leftPanelContent) ||
                      isTableWithOptionLettersFormat(leftPanelContent) ||
                      looksLikeTableText(leftPanelContent)) ? (
                    canExplorePdf ? (
                      <PdfExplorePanel
                        key={currentQuestion?.id}
                        pdfUrl={pdfUrl!}
                        pageNumber={currentQuestion!.page_number!}
                        bbox={currentQuestion!.bbox!}
                        onRendered={handleGraphRendered}
                        className="max-w-full"
                      />
                    ) : usableStoredImgSrc ? (
                      <ZoomableImagePanel key={currentQuestion?.id} className="max-w-full">
                        <SafeStorageImage
                          src={usableStoredImgSrc}
                          alt="Table"
                          onUnusable={() => markImageUnusable(usableStoredImgSrc)}
                        />
                      </ZoomableImagePanel>
                    ) : (() => {
                      const tableHtml = getTableHtmlForPanel(leftPanelContent);
                      return tableHtml.trim() ? (
                        <ZoomableImagePanel key={currentQuestion?.id} className="max-w-full">
                          <TableImageView
                            tableHtml={tableHtml}
                            onRendered={handleTableRendered}
                            className="overflow-auto max-w-full"
                          />
                        </ZoomableImagePanel>
                      ) : (
                        <div
                          className={cn(TABLE_FALLBACK_CLASS, "bg-white", "overflow-auto max-w-full")}
                          style={{ minWidth: 200 }}
                          dangerouslySetInnerHTML={{ __html: sanitizeTableHtml(leftPanelContent) }}
                        />
                      );
                    })()
                  ) : isSvgContent(leftPanelContent) ? (
                    canExplorePdf ? (
                      <PdfExplorePanel
                        key={currentQuestion?.id}
                        pdfUrl={pdfUrl!}
                        pageNumber={currentQuestion!.page_number!}
                        bbox={currentQuestion!.bbox!}
                        onRendered={handleGraphRendered}
                        className="max-w-full"
                      />
                    ) : pdfUrl && currentQuestion?.page_number != null ? (
                      <ZoomableImagePanel key={currentQuestion?.id} className="max-w-full">
                        <PdfPageView
                          pdfUrl={pdfUrl}
                          pageNumber={currentQuestion.page_number}
                          bbox={currentQuestion.bbox ?? undefined}
                          onRendered={handleGraphRendered}
                          className="max-w-full h-auto"
                        />
                      </ZoomableImagePanel>
                    ) : (
                      <p className="text-sm text-gray-500">No graph or table for this question.</p>
                    )
                  ) : isSat &&
                    currentQuestion?.has_graph &&
                    currentQuestion?.page_number != null ? (
                    <p className="text-sm text-gray-500">Loading figure…</p>
                  ) : isEconomicsOrPassage && looksLikeQuestionStem(leftPanelContent) ? (
                    <p className="text-sm text-gray-500">No graph or table for this question.</p>
                  ) : currentQuestion ? (
                    <PassagePanelContent
                      questionId={currentQuestion.id}
                      text={leftPanelContent}
                      highlights={highlights}
                      className={cn(
                        isSat ? satPassageTextClass : apPassageTextClass
                      )}
                      itemTextClass={leftPassageItemTextClass}
                      onApplyHighlight={applyHighlightSelection}
                    />
                  ) : null
                ) : (
                  <p className="text-sm text-gray-500">
                    {isCsa ? "No code for this question." : "No passage for this question."}
                  </p>
                )}
              </div>
            </div>

            {/* Resizer */}
            <div
              ref={dividerRef}
              className="w-1 flex-shrink-0 bg-gray-300 hover:bg-gray-400 cursor-col-resize flex items-center justify-center group"
              onMouseDown={() => {
                isDraggingRef.current = true;
                window.addEventListener("mousemove", handleResize);
                window.addEventListener("mouseup", handleResizeEnd);
              }}
            >
              <ArrowLeftRight className="h-5 w-5 text-gray-500 group-hover:text-blue-600" />
            </div>

            {/* Right panel */}
            <div
              className="flex-1 overflow-auto flex flex-col min-w-0"
              style={{ width: `${100 - leftPanelPercent}%` }}
            >
              <div className="p-6 flex flex-col gap-4">{questionBlockContent}</div>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-auto flex flex-col items-center min-h-0">
            <div className="w-full max-w-2xl p-6 py-8 flex flex-col gap-4">
              {(pdfUrl || showHeaderZoomToolbar) && (
                <div className="flex justify-end items-center gap-1.5 -mt-2 mb-2">
                  {pdfUrl && (
                    <button
                      type="button"
                      onClick={() => setFullPageModalOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50"
                      aria-label="Show page"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      Show page
                    </button>
                  )}
                  <GraphZoomHeaderToolbar visible={showHeaderZoomToolbar} />
                </div>
              )}
              {questionBlockContent}
            </div>
          </div>
        )}
      </main>

      <ExamFooter
        displayUsername={displayUsername}
        centerContent={
          isEmptySatModule ? (
            <p className="text-sm font-medium text-amber-800">No questions in this module</p>
          ) : (
            <ExamFooterQuestionNav
              currentIndex={currentIndex}
              totalQuestions={activeQuestions.length}
              questionListOpen={questionListOpen}
              onToggleQuestionList={() => setQuestionListOpen((o) => !o)}
              questionGrid={
                <div className="grid grid-cols-5 gap-1.5">
                  {activeQuestions.map((q, i) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(i);
                        setQuestionListOpen(false);
                      }}
                      className={cn(
                        "h-9 w-9 rounded-md text-sm font-medium",
                        i === currentIndex
                          ? examUi.questionGridCurrent
                          : answers[q.id]
                            ? "bg-gray-200 text-gray-800"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              }
            />
          )
        }
        actions={
          <>
            {isEmptySatModule ? (
              <>
                {nextModuleDef && nextModuleQuestionCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void goToNextModule()}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Skip to {nextModuleDef.shortLabel}
                  </button>
                )}
                {isLastSatModule && (
                  <button
                    type="button"
                    onClick={() => setShowEndExamConfirm(true)}
                    disabled={completing}
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm font-medium",
                      completing
                        ? "bg-gray-400 text-white cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700"
                    )}
                  >
                    {completing ? "Submitting…" : "Finish & Score"}
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                  className={cn(
                    "rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50",
                    examUi.backGray
                  )}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCurrentIndex((i) => Math.min(activeQuestions.length - 1, i + 1))
                  }
                  disabled={currentIndex >= activeQuestions.length - 1}
                  className={cn(
                    "rounded-lg px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50",
                    examUi.nextBlue
                  )}
                >
                  Next
                </button>
                {isOnLastQuestionOfModule && isSatFull && !isLastSatModule && (
                  <button
                    type="button"
                    onClick={() => setModuleTransitionShown(currentModuleId)}
                    className="rounded-xl px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Submit Module
                  </button>
                )}
                {isOnLastQuestionOfModule && (!isSatFull || isLastSatModule) && (
                  <button
                    type="button"
                    onClick={() => setShowEndExamConfirm(true)}
                    disabled={completing}
                    className={cn(
                      "rounded-xl px-4 py-2 text-sm font-medium",
                      completing
                        ? "bg-gray-400 text-white cursor-not-allowed"
                        : "bg-green-600 text-white hover:bg-green-700"
                    )}
                  >
                    {completing
                      ? completingSkipAi
                        ? "Submitting…"
                        : "Calculating results…"
                      : isSatFull ? "Finish & Score" : "End Exam"}
                  </button>
                )}
              </>
            )}
          </>
        }
      />
      {isOnLastQuestionOfModule && (!isSatFull || isLastSatModule) && (
        <p
          className={cn(
            "px-4 py-2 text-center text-xs text-gray-500",
            examUi.footerBg,
            examUi.chromeBorderTop
          )}
        >
          You can grade missing keys with AI (may take several minutes) or submit without AI to view your answers
          only.
        </p>
      )}
      {pdfUrl && (
        <FullPageModal
          open={fullPageModalOpen}
          onClose={() => setFullPageModalOpen(false)}
          pdfUrl={pdfUrl}
          pageNumber={currentQuestion?.page_number ?? currentQuestion?.question_number ?? 1}
        />
      )}
      {needsDesmos && (
        <DesmosCalculator open={desmosOpen} onClose={() => setDesmosOpen(false)} />
      )}
      {moduleTransitionShown && nextModuleDef && !moduleScoreResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-w-md w-full rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">Module complete</h2>
            {isSat ? (
              <SatMarkedForReviewWarning
                items={satCurrentModuleMarkedForReview}
                allQuestions={questions}
                isSatFullExam={isSatFull}
              />
            ) : null}
            <p className="text-sm text-gray-600 mb-4">
              You finished {currentModuleDef?.label ?? "this module"}. The next module is{" "}
              <span className="font-medium text-gray-900">{nextModuleDef.label}</span>{" "}
              ({nextModuleQuestionCount} questions, suggested {nextModuleDef.durationMin} min).
            </p>
            {moduleTransitionError && (
              <p className="text-sm text-red-600 mb-3">{moduleTransitionError}</p>
            )}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 mb-4 leading-relaxed">
              {nextModuleDef.section === "math" ? (
                <>The Math section allows the built-in Desmos calculator throughout.</>
              ) : (
                <>The Reading & Writing section does not allow a calculator.</>
              )}
            </div>

            {showModuleScoreChoice ? (
              <div className="mb-4 space-y-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Score this module
                </p>
                <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                  <button
                    type="button"
                    onClick={() => void scoreModule(false)}
                    disabled={scoringModule}
                    className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {scoringModule ? "Scoring…" : "Grade with AI"}
                  </button>
                  <p className="mt-2 text-xs text-gray-600">
                    Uses AI for questions missing an answer key. May take several minutes.
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                  <button
                    type="button"
                    onClick={() => void scoreModule(true)}
                    disabled={scoringModule}
                    className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                  >
                    Score with answer key only
                  </button>
                  <p className="mt-2 text-xs text-gray-600">
                    Only questions with a key in the exam are graded.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModuleScoreChoice(false)}
                  disabled={scoringModule}
                  className="text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            ) : (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModuleScoreChoice(true);
                    setModuleTransitionError(null);
                  }}
                  disabled={scoringModule}
                  className="w-full rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-medium text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
                >
                  Score this module
                </button>
                <p className="mt-2 text-xs text-gray-500 text-center">
                  Preview results for this module only. Your exam stays open.
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setModuleTransitionShown(null);
                  setShowModuleScoreChoice(false);
                }}
                disabled={scoringModule}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Stay on this module
              </button>
              <button
                type="button"
                onClick={() => {
                  setModuleTransitionError(null);
                  void goToNextModule();
                }}
                disabled={nextModuleQuestionCount === 0 || scoringModule}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next module: {nextModuleDef.shortLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {moduleScoreResult && (
        <SatModuleResultOverlay
          result={moduleScoreResult}
          moduleGroup={moduleScoreGroup}
          hasNextModule={!!nextModuleDef && nextModuleQuestionCount > 0}
          onContinue={() => {
            setModuleScoreResult(null);
            setShowModuleScoreChoice(false);
            void goToNextModule();
          }}
          onStay={() => {
            setModuleScoreResult(null);
            setShowModuleScoreChoice(false);
            setModuleTransitionShown(null);
          }}
        />
      )}
      {showEndExamConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              {isSat ? "Finish SAT exam?" : "Finish exam?"}
            </h2>
            {isSat ? (
              <SatMarkedForReviewWarning
                items={satMarkedForReviewQuestions}
                allQuestions={questions}
                isSatFullExam={isSatFull}
              />
            ) : null}
            {!isSat ? (
              <p className="mb-4 text-sm text-gray-700">Choose how you want to complete this attempt.</p>
            ) : satMarkedForReviewQuestions.length === 0 ? (
              <p className="mb-4 text-sm text-gray-700">
                You are about to submit this attempt for scoring.
              </p>
            ) : null}
            <p className="mb-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Scoring</p>
            <div className="flex flex-col gap-3 mb-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEndExamConfirm(false);
                    void completeExam(false);
                  }}
                  disabled={completing}
                  className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Grade with AI
                </button>
                <p className="mt-2 text-xs text-gray-600">
                  Uses AI to estimate answers for questions missing a key. This may take several minutes.
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEndExamConfirm(false);
                    void completeExam(true);
                  }}
                  disabled={completing}
                  className="w-full rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
                >
                  Submit without AI
                </button>
                <p className="mt-2 text-xs text-gray-600">
                  Closes the exam and shows your responses. Items without an answer key in the exam will appear as not
                  graded.
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowEndExamConfirm(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </GraphZoomProvider>
  );
}

/**
 * SAT Math grid-in (Student-Produced Response) numeric input.
 * Accepts digits, decimal point, slash for fractions, and a leading minus sign.
 * Commits on each keystroke (via onCommit), mirroring how MCQ selections persist.
 */
function SatGridInInput({
  value,
  onCommit,
  large = false,
}: {
  value: string;
  onCommit: (next: string) => void;
  large?: boolean;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => {
    setLocal(value);
  }, [value]);
  const valid = local === "" || /^-?[\d./]*$/.test(local);
  const commit = (v: string) => {
    setLocal(v);
    if (v === "" || (/^-?[\d./]+$/.test(v) && /\d/.test(v))) {
      onCommit(v);
    } else if (v === "") {
      onCommit("");
    }
  };
  const appendChar = (c: string) => {
    commit(local + c);
  };
  const backspace = () => {
    commit(local.slice(0, -1));
  };
  const clear = () => {
    commit("");
  };
  return (
    <div className="space-y-3">
      <div className="rounded-lg border-2 border-blue-200 bg-blue-50/40 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-blue-700 mb-2">
          Grid-in answer
        </p>
        <input
          type="text"
          inputMode="decimal"
          value={local}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "" || /^-?[\d./]*$/.test(v)) {
              commit(v);
            }
          }}
          placeholder="Enter your answer (e.g. 3/2 or 0.5)"
          className={cn(
            "w-full rounded-md border-2 px-3 font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2",
            large ? "py-3.5 text-xl" : "py-3 text-lg",
            valid
              ? "border-gray-300 focus:border-blue-600 focus:ring-blue-200"
              : "border-red-400 focus:border-red-600 focus:ring-red-200"
          )}
        />
        <div className="mt-3 grid grid-cols-4 gap-2">
          {["7", "8", "9", "/"].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => appendChar(k)}
              className="rounded-md border border-gray-300 bg-white py-2 text-sm font-mono text-gray-800 hover:bg-gray-50"
            >
              {k}
            </button>
          ))}
          {["4", "5", "6", "."].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => appendChar(k)}
              className="rounded-md border border-gray-300 bg-white py-2 text-sm font-mono text-gray-800 hover:bg-gray-50"
            >
              {k}
            </button>
          ))}
          {["1", "2", "3", "-"].map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => appendChar(k)}
              className="rounded-md border border-gray-300 bg-white py-2 text-sm font-mono text-gray-800 hover:bg-gray-50"
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            onClick={() => appendChar("0")}
            className="col-span-2 rounded-md border border-gray-300 bg-white py-2 text-sm font-mono text-gray-800 hover:bg-gray-50"
          >
            0
          </button>
          <button
            type="button"
            onClick={backspace}
            className="rounded-md border border-gray-300 bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ←
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded-md border border-red-200 bg-red-50 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
          >
            Clear
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          You can type with your keyboard or use the keypad. Fractions like 3/2 and decimals like 1.5 are both accepted.
        </p>
      </div>
    </div>
  );
}
