"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Delete,
  Eraser,
  Flag,
  Highlighter,
  Calculator,
  Maximize2,
  Minus,
  MoreHorizontal,
  Plus,
  RotateCcw,
  RotateCw,
  Star,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { SUBJECT_KEYS, SUBJECT_LABELS, isCodeSubject, type SubjectKey } from "@/lib/gemini-prompts";

const PdfPageView = dynamic(() => import("./PdfPageView"), { ssr: false });
const TableImageView = dynamic(() => import("./TableImageView"), { ssr: false });
const ZoomableImagePanel = dynamic(() => import("./ZoomableImagePanel"), { ssr: false });
const FullPageModal = dynamic(() => import("./FullPageModal"), { ssr: false });

const TABLE_FALLBACK_CLASS =
  "overflow-auto max-w-full [&_table]:table-auto [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-gray-300 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium [&_th]:text-left [&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2.5";

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

const SUBJECTS = SUBJECT_KEYS.map((v) => ({ value: v, label: SUBJECT_LABELS[v] }));

type SubjectValue = SubjectKey;

interface PdfUpload {
  id: string;
  subject: string | null;
  filename: string | null;
  storage_path?: string | null;
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

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
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
  const reviewQuestionNum = searchParams.get("question");
  const reviewQuestion = reviewQuestionNum ? parseInt(reviewQuestionNum, 10) : null;
  const [upload, setUpload] = useState<PdfUpload | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [userEmail, setUserEmail] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [timerVisible, setTimerVisible] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [leftPanelPercent, setLeftPanelPercent] = useState(45);
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
  const [examCompleted, setExamCompleted] = useState(false);
  const [examResult, setExamResult] = useState<{
    total: number;
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    percentage: number;
    timeSpentSeconds: number;
    breakdown: { questionNumber: number; userAnswer: string | null; correctAnswer: string | null; isCorrect: boolean }[];
  } | null>(null);
  const [completing, setCompleting] = useState(false);
  const [selectedResultQuestion, setSelectedResultQuestion] = useState<number | null>(null);
  const [resultViewMode, setResultViewMode] = useState<"explanation" | "question">("explanation");
  const [resultExplanation, setResultExplanation] = useState<string | null>(null);
  const [resultExplanationLoading, setResultExplanationLoading] = useState(false);
  const [fullPageModalOpen, setFullPageModalOpen] = useState(false);
  const [showEndExamConfirm, setShowEndExamConfirm] = useState(false);
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
    if (!id) {
      setLoading(false);
      return;
    }
    if (reviewAttemptId) {
      const supabase = createClient();
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) {
          setLoading(false);
          return;
        }
        fetch(`/api/exam/attempt/${reviewAttemptId}`, {
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
            setUpload(data.upload as PdfUpload);
            setQuestions((data.questions ?? []) as Question[]);
            setExamCompleted(true);
            setExamResult({
              total: data.result?.total ?? 0,
              correctCount: data.result?.correctCount ?? 0,
              incorrectCount: data.result?.incorrectCount ?? 0,
              unansweredCount: data.result?.unansweredCount ?? 0,
              percentage: data.result?.percentage ?? 0,
              timeSpentSeconds: data.result?.timeSpentSeconds ?? 0,
              breakdown: data.result?.breakdown ?? [],
            });
            if (reviewQuestion != null && !Number.isNaN(reviewQuestion)) {
              setSelectedResultQuestion(reviewQuestion);
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
        .select("id, subject, filename, storage_path")
        .eq("id", id)
        .single(),
      supabase
        .from("questions")
        .select("*")
        .eq("upload_id", id)
        .order("question_number", { ascending: true }),
    ]).then(([uploadRes, questionsRes]) => {
      setLoading(false);
      if (uploadRes.data) setUpload(uploadRes.data as PdfUpload);
      if (questionsRes.data) setQuestions((questionsRes.data as Question[]) ?? []);
    });
  }, [id, reviewAttemptId, reviewQuestion]);

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
    async (questionId: string, userAnswer: string, isFlagged: boolean) => {
      if (!attemptId) return;
      await fetch("/api/exam/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId,
          questionId,
          userAnswer: userAnswer || null,
          isFlagged,
        }),
      });
    },
    [attemptId]
  );

  useEffect(() => {
    if (!attemptId) return;
    const t = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [attemptId]);

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

  const completeExam = useCallback(async () => {
    if (!attemptId || completing) return;
    setCompleting(true);
    try {
      await Promise.all(
        Object.entries(answers).map(([qId, ans]) =>
          saveAnswer(qId, ans, markedForReview.has(qId))
        )
      );
      const res = await fetch("/api/exam/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to complete exam");
      setExamResult({
        total: data.total ?? 0,
        correctCount: data.correctCount ?? 0,
        incorrectCount: data.incorrectCount ?? 0,
        unansweredCount: data.unansweredCount ?? 0,
        percentage: data.percentage ?? 0,
        timeSpentSeconds: data.timeSpentSeconds ?? 0,
        breakdown: data.breakdown ?? [],
      });
      setExamCompleted(true);
    } catch (e) {
      console.error(e);
      alert("Failed to complete exam. Please try again.");
    } finally {
      setCompleting(false);
    }
  }, [attemptId, completing, answers, saveAnswer, markedForReview]);

  const handleExplainClick = useCallback(
    async (questionNumber: number) => {
      const q = questions.find((qq) => qq.question_number === questionNumber);
      const row = examResult?.breakdown.find((b) => b.questionNumber === questionNumber);
      if (!q || !upload) return;
      setSelectedResultQuestion(questionNumber);
      setResultViewMode("explanation");
      setResultExplanationLoading(true);
      setResultExplanation(null);
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
            correctAnswer: row?.correctAnswer ?? "A",
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

  const currentQuestion = questions[currentIndex] ?? null;
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
  const subject = (upload?.subject ?? "AP_CSA") as SubjectValue;
  const subjectLabel = SUBJECT_LABELS[subject] ?? subject;
  const isCsa = isCodeSubject(subject);
  const isEconomics = subject === "AP_MICROECONOMICS" || subject === "AP_MACROECONOMICS";
  const isMicro = subject === "AP_MICROECONOMICS";
  const isCalculatorAllowed = CALCULATOR_ALLOWED_SUBJECTS.has(subject);
  const isCalculatorScientific =
    isCalculatorAllowed &&
    !["AP_MICROECONOMICS", "AP_MACROECONOMICS"].includes(subject);
  const isCsaLegacyFallback =
    isCsa &&
    !currentQuestion?.passage_text?.trim() &&
    !!currentQuestion?.question_text?.trim() &&
    looksLikeCode(currentQuestion.question_text);
  const csaSplit = isCsaLegacyFallback
    ? splitCsaQuestionStem(currentQuestion?.question_text ?? null)
    : null;
  const leftPanelContent = isCsaLegacyFallback
    ? (csaSplit?.codePart ?? currentQuestion?.question_text ?? "")
    : (currentQuestion?.passage_text ?? "");
  const isEconomicsOrPassage = !isCsa;
  let rawStem = isCsaLegacyFallback
    ? (csaSplit?.questionStem ?? "No question text.")
    : (currentQuestion?.question_text ?? "");
  if (
    !isCsaLegacyFallback &&
    isEconomicsOrPassage &&
    currentQuestion?.passage_text?.trim() &&
    rawStem
  ) {
    rawStem = getStemOnlyIfListPresent(rawStem, currentQuestion.passage_text) || rawStem;
  }
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
  const hasMeaningfulLeftContent =
    showTablePanel ||
    showGraphPanel ||
    (!!leftPanelContent?.trim() &&
      (subject === "AP_CSA" ||
        isTableHtml(leftPanelContent) ||
        isTableWithOptionLettersFormat(leftPanelContent) ||
        looksLikeTableText(leftPanelContent) ||
        isSvgContent(leftPanelContent) ||
        (isEconomicsOrPassage && !looksLikeQuestionStem(leftPanelContent))));

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
          <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm max-w-md w-full text-center">
            <h1 className="text-xl font-semibold text-gray-900">Start Exam</h1>
            <p className="mt-2 text-sm text-gray-600">{subjectLabel}</p>
            <p className="mt-1 text-sm text-gray-500">
              {questions.length} question{questions.length !== 1 ? "s" : ""}
            </p>
            <button
              type="button"
              onClick={startExam}
              disabled={starting}
              className={cn(
                "mt-6 w-full rounded-md px-4 py-3 text-sm font-medium text-white",
                starting ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
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
    const scoreLabel = r.percentage >= 70 ? "Well done" : r.percentage >= 50 ? "Good effort" : "Keep practicing";
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
                  <div className="text-5xl sm:text-6xl font-bold text-blue-600">{r.percentage}%</div>
                  <p className="text-sm font-medium text-gray-600 mt-1">{scoreLabel}</p>
                </div>
                <div className="h-16 w-px bg-gray-200 hidden sm:block" />
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="h-4 w-4" />
                  <span>Time: {m}:{s.toString().padStart(2, "0")}</span>
                </div>
              </div>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
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
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-center">
                <BarChart3 className="h-8 w-8 mx-auto text-blue-600 mb-1" />
                <p className="text-2xl font-bold text-blue-700">{r.total}</p>
                <p className="text-xs font-medium text-blue-600">Total</p>
              </div>
            </div>

            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <strong>Note:</strong> Results may not be 100% accurate. AI-generated answers and explanations are for reference only.
            </div>
            <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-gray-50 px-4 py-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">Question Details</h2>
                <p className="text-xs text-gray-500 mt-0.5">Click a row to view solution or show question</p>
              </div>
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
                      const status = row.userAnswer == null || row.userAnswer === "" ? "unanswered" : row.isCorrect ? "correct" : "incorrect";
                      return (
                        <tr
                          key={row.questionNumber}
                          onClick={() => handleExplainClick(row.questionNumber)}
                          className={cn(
                            "border-b border-gray-100 cursor-pointer transition-colors",
                            selectedResultQuestion === row.questionNumber ? "bg-blue-50" : "hover:bg-gray-50"
                          )}
                        >
                          <td className="px-4 py-3 font-medium text-gray-900">{row.questionNumber}</td>
                          <td className="px-4 py-3">{row.userAnswer ?? "—"}</td>
                          <td className="px-4 py-3">{row.correctAnswer ?? "—"}</td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                              status === "correct" && "bg-green-100 text-green-800",
                              status === "incorrect" && "bg-red-100 text-red-800",
                              status === "unanswered" && "bg-gray-100 text-gray-600"
                            )}>
                              {status === "correct" ? "Correct" : status === "incorrect" ? "Incorrect" : "Unanswered"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {selectedResultQuestion != null && (() => {
              const selectedQ = questions.find((q) => q.question_number === selectedResultQuestion);
              return (
                <div className="mt-6 rounded-xl border-2 border-blue-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setResultViewMode("explanation")}
                        className={cn(
                          "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                          resultViewMode === "explanation"
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        )}
                      >
                        Solution explanation
                      </button>
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
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedResultQuestion(null);
                        setResultExplanation(null);
                        setResultViewMode("explanation");
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
                        {selectedQ.question_number}
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

  const questionBlockContent = (
    <>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gray-200 text-gray-900 font-bold">
          {currentQuestion?.question_number ?? 0}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
          <input
            type="checkbox"
            checked={currentQuestion ? markedForReview.has(currentQuestion.id) : false}
            onChange={() => currentQuestion && toggleMarkForReview(currentQuestion.id)}
            className="rounded border-gray-300"
          />
          <Flag className="h-4 w-4" />
          Mark for Review
        </label>
        <div className="ml-auto flex items-center justify-center rounded bg-blue-600 px-2 py-1 text-white text-xs font-medium">
          AP
        </div>
      </div>
      <p
        className="text-gray-900 font-medium select-text cursor-text"
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
      <div className="space-y-2">
        {options.map(({ key, text }) => {
          const isSelected = currentQuestion && answers[currentQuestion.id] === key;
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
                "w-full flex items-start gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors cursor-pointer",
                isSelected
                  ? "border-blue-600 bg-blue-600/5 text-gray-900"
                  : "border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50 text-gray-800"
              )}
            >
              <div
                className={cn(
                  "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 font-medium mt-0.5 transition-colors",
                  isSelected ? "border-blue-600 bg-blue-50 text-blue-600" : "border-gray-400 bg-transparent"
                )}
              >
                {key}
              </div>
              <span
                className="flex-1 min-w-0 select-text"
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
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-400">
                <Plus className="h-4 w-4 text-gray-500" />
              </span>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
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

      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 bg-[#E5E7EB] text-gray-900">
        <div className="relative flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-gray-900 hover:text-gray-700 hover:underline">
              <span className="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white">
                <Star className="h-5 w-5 text-blue-600 fill-blue-600" />
              </span>
              Bluebook
            </Link>
            <div>
              <p className="text-xl font-bold text-gray-900">Section I</p>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDirectionsOpen((o) => !o)}
                  className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                >
                  Directions <ChevronDown className="h-4 w-4" />
                </button>
                {directionsOpen && (
                  <div className="absolute left-0 top-full mt-1 w-64 rounded border border-gray-200 bg-white p-3 text-left text-sm text-gray-800 shadow-lg z-10">
                    Answer the multiple-choice questions. You can mark questions for review and
                    navigate with Back/Next.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            {timerVisible && (
              <div className="text-center">
                <p className="text-lg font-mono text-gray-900">{formatTimer(elapsedSeconds)}</p>
                <button
                  type="button"
                  onClick={() => setTimerVisible(false)}
                  className="mt-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Hide
                </button>
              </div>
            )}
            {!timerVisible && (
              <button
                type="button"
                onClick={() => setTimerVisible(true)}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Show timer
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0 relative">
            <div className="flex items-center gap-1 bg-[#E5E7EB] rounded-lg px-2 py-1.5">
              <button
                type="button"
                onClick={() => setHighlightToolbarOpen((o) => !o)}
                className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors bg-[#E5E7EB] text-gray-600 hover:text-gray-900"
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
                    {currentQuestion ? `Q${currentQuestion.question_number}` : "Note"}
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
            <button type="button" className="p-1 rounded hover:bg-gray-100">
              <MoreHorizontal className="h-5 w-5" />
            </button>
          </div>
        </div>
        {isCsa && (
          <div className="bg-[#f8d7da] border border-dashed border-red-300 px-4 py-2 flex items-center justify-center gap-2 text-sm font-medium text-white">
            <Calculator className="h-4 w-4" />
            NO CALCULATOR ALLOWED
          </div>
        )}
      </header>

      {/* Main: split when left content exists, else single centered column */}
      <main className={cn("flex-1 flex overflow-hidden min-h-0", hasMeaningfulLeftContent && "bg-gray-100")}>
        {hasMeaningfulLeftContent ? (
          <>
            {/* Left panel */}
            <div
              className={cn(
                "flex-shrink-0 overflow-auto border-r bg-white",
                isCsa && leftPanelContent?.trim()
                  ? "border-2 border-amber-400"
                  : "border-r border-gray-200"
              )}
              style={{ width: `${leftPanelPercent}%` }}
            >
              <div className="p-4 h-full relative">
                {pdfUrl && (
                    <button
                      type="button"
                      onClick={() => setFullPageModalOpen(true)}
                      className="absolute bottom-2 left-2 rounded border border-gray-300 bg-white/90 px-2 py-1 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50"
                      aria-label="Show page"
                    >
                      <Maximize2 className="mr-1 inline h-3.5 w-3.5" />
                      Show page
                    </button>
                  )}
                {isCsa && leftPanelContent?.trim() && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 rounded border border-dashed border-red-300 bg-[#f8d7da] px-2 py-1 text-xs font-medium text-white">
                    <Calculator className="h-3.5 w-3.5" />
                    NO CALCULATOR ALLOWED
                  </div>
                )}
                {showTablePanel ? (
                  <ZoomableImagePanel key={currentQuestion?.id} className="max-w-full">
                    {(currentQuestion?.image_url ?? questionIdToImageUrl[currentQuestion?.id ?? ""]) ? (
                      <img
                        src={currentQuestion?.image_url ?? questionIdToImageUrl[currentQuestion?.id ?? ""] ?? ""}
                        alt="Table"
                        className="max-w-full h-auto block object-contain"
                        style={{ imageRendering: "crisp-edges" } as React.CSSProperties}
                      />
                    ) : pdfUrl &&
                      currentQuestion?.page_number != null &&
                      currentQuestion?.bbox != null ? (
                      <PdfPageView
                        pdfUrl={pdfUrl}
                        pageNumber={currentQuestion.page_number}
                        bbox={currentQuestion.bbox}
                        onRendered={handleGraphRendered}
                        className="max-w-full h-auto"
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
                ) : showGraphPanel ? (
                  <ZoomableImagePanel key={currentQuestion?.id} className="max-w-full">
                    {(currentQuestion.image_url ?? questionIdToImageUrl[currentQuestion.id]) ? (
                      <img
                        src={currentQuestion.image_url ?? questionIdToImageUrl[currentQuestion.id] ?? ""}
                        alt="Graph"
                        className="max-w-full h-auto block object-contain"
                        style={{ imageRendering: "crisp-edges" } as React.CSSProperties}
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
                ) : leftPanelContent ? (
                  subject === "AP_CSA" ? (
                    <>
                      {(() => {
                        const { referenceList, codePart } = splitCsaPassage(leftPanelContent);
                        return (
                          <>
                            {referenceList && (
                              <>
                                <p className="text-sm font-medium text-gray-900 mb-2">Consider the following.</p>
                                <div className="text-sm text-gray-900 whitespace-pre-wrap mb-4 rounded-md border border-gray-200 bg-gray-50 p-4">
                                  {referenceList}
                                </div>
                              </>
                            )}
                            {codePart && (
                              <>
                                <p className="text-sm font-medium text-gray-900 mb-2">Consider the following code segment.</p>
                                <pre className="text-sm font-mono bg-gray-100 text-gray-900 p-4 rounded-md overflow-auto whitespace-pre border border-gray-200">
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
                          <pre className="text-sm font-mono text-gray-700 whitespace-pre-wrap bg-gray-50 p-3 rounded-md overflow-auto">
                            {currentQuestion.precondition_text}
                          </pre>
                        </div>
                      ) : null}
                    </>
                  ) : (isTableHtml(leftPanelContent) ||
                      isTableWithOptionLettersFormat(leftPanelContent) ||
                      looksLikeTableText(leftPanelContent)) ? (
                    (currentQuestion?.image_url ?? questionIdToImageUrl[currentQuestion?.id ?? ""]) ? (
                      <ZoomableImagePanel key={currentQuestion?.id} className="max-w-full">
                        <img
                          src={currentQuestion?.image_url ?? questionIdToImageUrl[currentQuestion?.id ?? ""] ?? ""}
                          alt="Table"
                          className="max-w-full h-auto block object-contain"
                          style={{ imageRendering: "crisp-edges" } as React.CSSProperties}
                        />
                      </ZoomableImagePanel>
                    ) : pdfUrl &&
                      currentQuestion?.page_number != null &&
                      currentQuestion?.bbox != null ? (
                      <ZoomableImagePanel key={currentQuestion?.id} className="max-w-full">
                        <PdfPageView
                          pdfUrl={pdfUrl}
                          pageNumber={currentQuestion.page_number}
                          bbox={currentQuestion.bbox}
                          onRendered={handleGraphRendered}
                          className="max-w-full h-auto"
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
                    pdfUrl && currentQuestion?.page_number != null ? (
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
                  ) : isEconomicsOrPassage && looksLikeQuestionStem(leftPanelContent) ? (
                    <p className="text-sm text-gray-500">No graph or table for this question.</p>
                  ) : (
                    <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
                      {leftPanelContent}
                    </div>
                  )
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
              {pdfUrl && (
                <div className="flex justify-end -mt-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setFullPageModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50"
                    aria-label="Show page"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Show page
                  </button>
                </div>
              )}
              {questionBlockContent}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 border-t border-gray-200 bg-[#E5E7EB] px-4 py-3 text-gray-900">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-700">{userName || userEmail || "User"}</p>
          <div className="relative">
            <button
              type="button"
              onClick={() => setQuestionListOpen((o) => !o)}
              className="flex items-center gap-2 rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300"
            >
              Question {currentIndex + 1} of {questions.length}
              <ChevronUp className="h-4 w-4" />
            </button>
            {questionListOpen && (
              <div className="absolute bottom-full left-0 mb-1 max-h-48 w-64 overflow-auto rounded border border-gray-200 bg-white py-2 text-gray-800 shadow-lg z-20">
                <div className="grid grid-cols-5 gap-1 p-2">
                  {questions.map((q, i) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(i);
                        setQuestionListOpen(false);
                      }}
                      className={cn(
                        "h-8 w-8 rounded text-sm font-medium",
                        i === currentIndex
                          ? "bg-blue-600 text-white"
                          : answers[q.id]
                            ? "bg-gray-200 text-gray-800"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="rounded-xl bg-[#36454F] px-4 py-2 text-sm font-medium text-white hover:bg-[#2d3748] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
              }
              disabled={currentIndex >= questions.length - 1}
              className="rounded-xl bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            {currentIndex === questions.length - 1 && (
              <button
                type="button"
                onClick={() => {
                  if (markedForReview.size > 0) {
                    setShowEndExamConfirm(true);
                  } else if (window.confirm("Are you sure you want to end the exam?")) {
                    completeExam();
                  }
                }}
                disabled={completing}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-medium",
                  completing
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-green-600 text-white hover:bg-green-700"
                )}
              >
                {completing ? "Calculating results…" : "End Exam"}
              </button>
            )}
          </div>
        </div>
        {currentIndex === questions.length - 1 && (
          <p className="text-xs text-gray-500 text-center mt-2">
            This process may take a while.
          </p>
        )}
      </footer>
      {pdfUrl && (
        <FullPageModal
          open={fullPageModalOpen}
          onClose={() => setFullPageModalOpen(false)}
          pdfUrl={pdfUrl}
          pageNumber={currentQuestion?.page_number ?? currentQuestion?.question_number ?? 1}
        />
      )}
      {showEndExamConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <p className="mb-4 text-sm text-gray-700">
              You marked these questions for review. Are you sure you want to end the exam?
            </p>
            <p className="mb-4 text-xs text-gray-500">
              This process may take a while.
            </p>
            <div className="mb-4 flex flex-wrap gap-2">
              {questions
                .filter((q) => markedForReview.has(q.id))
                .map((q) => (
                  <span
                    key={q.id}
                    className="inline-block rounded border border-amber-200 bg-amber-50 px-2 py-1 text-sm font-medium"
                  >
                    {q.question_number}
                  </span>
                ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEndExamConfirm(false)}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEndExamConfirm(false);
                  completeExam();
                }}
                disabled={completing}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                Yes, End Exam
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
