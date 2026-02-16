"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Delete,
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
  Superscript,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const PdfPageView = dynamic(() => import("./PdfPageView"), { ssr: false });

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

const SUBJECTS = [
  { value: "AP_CSA", label: "AP CSA (Computer Science)" },
  { value: "AP_MICROECONOMICS", label: "AP Microeconomics" },
  { value: "AP_MACROECONOMICS", label: "AP Macroeconomics" },
  { value: "AP_PSYCHOLOGY", label: "AP Psychology" },
  { value: "AP_STATISTICS", label: "AP Statistics" },
] as const;

type SubjectValue = (typeof SUBJECTS)[number]["value"];

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
  page_number?: number | null;
}

const OPTION_KEYS = ["A", "B", "C", "D", "E"] as const;

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
  if (mode === "pipe") return line.split("|").map((p) => p.trim()).filter(Boolean);
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
    if (dataRows.every((r) => r.length === colCount) && lines.some((l) => (l.match(/\|/g)?.length ?? 0) >= 2))
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
  if (isTableHtml(t) || looksLikeTableText(t) || isSvgContent(t)) return false;
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
  return (
    (t.includes("public ") || t.includes("private ") || t.includes("void ") || t.includes("int ")) &&
    (t.includes("{") || t.includes("}"))
  );
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
  if (match) return match[1].trim();
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

export default function ExamPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [upload, setUpload] = useState<PdfUpload | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [markedForReview, setMarkedForReview] = useState<Set<string>>(new Set());
  const [userEmail, setUserEmail] = useState<string>("");
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
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
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
    });
  }, [router]);

  useEffect(() => {
    if (!id) {
      setLoading(false);
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
  }, [id]);

  useEffect(() => {
    const isEconomics =
      upload?.subject === "AP_MICROECONOMICS" || upload?.subject === "AP_MACROECONOMICS";
    if (!id || !upload?.storage_path || !isEconomics) {
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
          if (!cancelled && data?.url) setPdfUrl(data.url);
        })
        .catch(() => setPdfUrl(null));
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

  const currentQuestion = questions[currentIndex] ?? null;
  const subject = (upload?.subject ?? "AP_CSA") as SubjectValue;
  const subjectLabel = SUBJECTS.find((s) => s.value === subject)?.label ?? subject;
  const isCsa = subject === "AP_CSA";
  const isEconomics = subject === "AP_MICROECONOMICS" || subject === "AP_MACROECONOMICS";
  const isMicro = subject === "AP_MICROECONOMICS";
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
  const isEconomicsOrPassage =
    isEconomics || subject === "AP_PSYCHOLOGY" || subject === "AP_STATISTICS";
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

  const hasMeaningfulLeftContent =
    (isEconomics && !!pdfUrl && currentQuestion?.page_number != null) ||
    (!!leftPanelContent?.trim() &&
      (subject === "AP_CSA" ||
        isTableHtml(leftPanelContent) ||
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
        <Link href="/dashboard" className="text-[#1B365D] font-medium hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!attemptId) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
        <header className="bg-[#1B365D] text-white px-6 py-4">
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
                starting ? "bg-gray-400 cursor-not-allowed" : "bg-[#1B365D] hover:bg-[#152a4a]"
              )}
            >
              {starting ? "Starting…" : "Start Exam"}
            </button>
            <Link
              href="/dashboard"
              className="mt-4 inline-block text-sm text-gray-500 hover:text-[#1B365D]"
            >
              Back to Dashboard
            </Link>
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
      <p className="text-gray-900 font-medium">{rightPanelQuestionText}</p>
      <div className="space-y-2">
        {options.map(({ key, text }) => {
          const isSelected = currentQuestion && answers[currentQuestion.id] === key;
          const showAsCode = isCsa && optionLooksLikeCode(text ?? null);
          const optionContent = text ?? "";
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (!currentQuestion) return;
                setAnswers((prev) => ({ ...prev, [currentQuestion.id]: key }));
                saveAnswer(
                  currentQuestion.id,
                  key,
                  markedForReview.has(currentQuestion.id)
                );
              }}
              className={cn(
                "w-full flex items-start gap-3 rounded-lg border border-gray-300 px-4 py-3 text-left text-sm transition-colors",
                isSelected
                  ? "border-[#1B365D] bg-[#1B365D]/5 text-gray-900"
                  : "bg-white hover:border-gray-400 hover:bg-gray-50 text-gray-800"
              )}
            >
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-400 font-medium mt-0.5 bg-transparent">
                {key}
              </span>
              <span className="flex-1 min-w-0">
                {showAsCode ? (
                  <pre className="text-sm font-mono whitespace-pre-wrap break-words bg-gray-50 rounded p-2 overflow-x-auto">
                    <code>{optionContent}</code>
                  </pre>
                ) : (
                  optionContent
                )}
              </span>
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-gray-400">
                <Plus className="h-4 w-4 text-gray-500" />
              </span>
            </button>
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

      {/* Calculator - Micro only */}
      {isMicro && (
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
              "fixed z-50 w-72 rounded-lg bg-white shadow-2xl overflow-hidden transition-opacity duration-300",
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
            <div className="p-3 bg-gray-100">
              <div className="bg-white border border-gray-300 rounded px-3 py-2 mb-3 font-mono text-xl text-right min-h-[2.5rem]">
                {calculatorDisplay || "0"}
              </div>
              {/* Top row: 5 columns */}
              <div className="grid grid-cols-5 gap-1 mb-1">
                <button
                  type="button"
                  onClick={() => setCalculatorDisplay("")}
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  <RotateCcw className="h-4 w-4 mx-auto" />
                </button>
                <button
                  type="button"
                  onClick={() => setCalculatorDisplay("")}
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  <RotateCw className="h-4 w-4 mx-auto" />
                </button>
                <button
                  type="button"
                  onClick={() => setCalculatorDisplay("")}
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-xs"
                >
                  clear all
                </button>
                <button
                  type="button"
                  onClick={() => setCalculatorDisplay((d) => d.slice(0, -1))}
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  <Delete className="h-4 w-4 mx-auto" />
                </button>
                <button
                  type="button"
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300"
                >
                  <Wrench className="h-4 w-4 mx-auto" />
                </button>
              </div>
              {/* Main grid: 4 columns, 6 rows; = spans 2 rows */}
              <div className="grid grid-cols-4 gap-1 grid-rows-[repeat(6,auto)]">
                <button
                  type="button"
                  onClick={() => setCalculatorDisplay((d) => d + "(")}
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium"
                >
                  (
                </button>
                <button
                  type="button"
                  onClick={() => setCalculatorDisplay((d) => d + ")")}
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium"
                >
                  )
                </button>
                <button
                  type="button"
                  onClick={() => setCalculatorDisplay((d) => d + "√")}
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium"
                >
                  √
                </button>
                <button
                  type="button"
                  onClick={() => setCalculatorDisplay((d) => d + "÷")}
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium"
                >
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
                <button
                  type="button"
                  onClick={() => setCalculatorDisplay((d) => d + "0")}
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setCalculatorDisplay((d) => d + ".")}
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-lg font-medium"
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCalculatorDisplay(
                      (d) => d + (d && /\d$/.test(d) ? "*" : "") + "ans"
                    )
                  }
                  className="p-2 rounded bg-gray-200 hover:bg-gray-300 text-sm"
                >
                  ans
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const result = safeCalculatorEval(
                      calculatorDisplay || "0",
                      calculatorLastResult
                    );
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
            </div>
          </div>
        </>
      )}

      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 bg-white text-gray-900">
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
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <span className="flex items-center gap-1 text-sm text-gray-600">
              <Highlighter className="h-4 w-4" /> Highlights & Notes
            </span>
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
            {isMicro ? (
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
        <div className="bg-[#f8d7da] border border-dashed border-red-300 px-4 py-2 text-center text-sm font-medium text-white">
          THIS IS A TEST PREVIEW
        </div>
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
                {isCsa && leftPanelContent?.trim() && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 rounded border border-dashed border-red-300 bg-[#f8d7da] px-2 py-1 text-xs font-medium text-white">
                    <Calculator className="h-3.5 w-3.5" />
                    NO CALCULATOR ALLOWED
                  </div>
                )}
                {isEconomics && pdfUrl && currentQuestion?.page_number != null ? (
                  <div className="overflow-auto max-w-full">
                    <PdfPageView
                      pdfUrl={pdfUrl}
                      pageNumber={currentQuestion.page_number}
                      className="max-w-full h-auto"
                    />
                  </div>
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
                  ) : isTableHtml(leftPanelContent) ? (
                    <div
                      className="overflow-auto max-w-full [&_table]:table-auto [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-gray-300 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium [&_th]:text-left [&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2.5"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeTableHtml(leftPanelContent),
                      }}
                    />
                  ) : looksLikeTableText(leftPanelContent) ? (
                    <div
                      className="overflow-auto max-w-full [&_table]:table-auto [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-gray-300 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium [&_th]:text-left [&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2.5"
                      dangerouslySetInnerHTML={{
                        __html: sanitizeTableHtml(plainTextToTableHtml(leftPanelContent)),
                      }}
                    />
                  ) : isSvgContent(leftPanelContent) ? (
                    <div
                      className="overflow-auto max-w-full"
                      dangerouslySetInnerHTML={{
                        __html: leftPanelContent.trim(),
                      }}
                    />
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
              <ArrowLeftRight className="h-5 w-5 text-gray-500 group-hover:text-[#1B365D]" />
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
              {questionBlockContent}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="flex-shrink-0 border-t border-gray-200 bg-white px-4 py-3 text-gray-900">
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-700">{userEmail || "User"}</p>
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
              className="rounded-md bg-[#36454F] px-4 py-2 text-sm font-medium text-white hover:bg-[#2d3748] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() =>
                setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))
              }
              disabled={currentIndex >= questions.length - 1}
              className="rounded-md bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
