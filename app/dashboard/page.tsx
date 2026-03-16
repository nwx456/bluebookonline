"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Trash2,
  Play,
  ChevronDown,
  BookOpen,
  X,
  AlertTriangle,
  Brain,
  Lightbulb,
  ImageIcon,
  Clock,
  XCircle,
} from "lucide-react";
import { HeaderNav } from "@/components/HeaderNav";
import { cn, generateId } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  SUBJECT_KEYS,
  SUBJECT_LABELS,
  SUBJECT_DEFAULT_HAS_VISUALS,
  isCodeSubject,
  type SubjectKey,
} from "@/lib/gemini-prompts";

const SUBJECTS = SUBJECT_KEYS.map((v) => ({ value: v, label: SUBJECT_LABELS[v] }));
const SUBJECTS_FILTER = [
  { value: "" as const, label: "All subjects" },
  ...SUBJECTS,
];

type SubjectValue = SubjectKey;

interface UploadedExam {
  id: string;
  name: string;
  subject: SubjectValue;
  questionCount: number;
  uploadedAt: string;
  isPublished: boolean;
}

interface RecentAttempt {
  id: string;
  uploadId: string;
  filename: string;
  subject: string;
  completedAt: string;
  correctCount: number;
  incorrectCount: number;
  totalQuestions: number;
  percentage: number;
}

interface AttemptQuestion {
  id: string;
  question_number: number;
  question_text: string;
  passage_text: string | null;
  precondition_text?: string | null;
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
}

interface AttemptBreakdownRow {
  questionNumber: number;
  userAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean;
}

interface ExpandedAttemptData {
  upload: { id: string; subject: string; filename: string };
  questions: AttemptQuestion[];
  result: { breakdown: AttemptBreakdownRow[] };
}

export default function DashboardPage() {
  const router = useRouter();
  const [subject, setSubject] = useState<SubjectValue | "">("");
  const [hasVisualsInPdf, setHasVisualsInPdf] = useState<boolean | null>(null);
  const [questionCount, setQuestionCount] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadedExam[]>([]);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState<SubjectValue | "">("");
  const [subjectFilterOpen, setSubjectFilterOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string>("");
  const [userEmail, setUserEmail] = useState<string>("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);
  const [expandedAttemptData, setExpandedAttemptData] = useState<ExpandedAttemptData | null>(null);
  const [expandedAttemptLoading, setExpandedAttemptLoading] = useState(false);
  const [selectedWrongQuestion, setSelectedWrongQuestion] = useState<number | null>(null);
  const [wrongResultViewMode, setWrongResultViewMode] = useState<"explanation" | "question">("explanation");
  const [wrongResultExplanation, setWrongResultExplanation] = useState<string | null>(null);
  const [wrongResultExplanationLoading, setWrongResultExplanationLoading] = useState(false);

  const questionCountNum = parseInt(questionCount, 10);
  const isQuestionCountValid = Number.isInteger(questionCountNum) && questionCountNum >= 1;
  const isCode = subject !== "" && isCodeSubject(subject as SubjectKey);
  const canAnalyze =
    selectedFile !== null &&
    isQuestionCountValid &&
    subject !== "" &&
    (isCode || hasVisualsInPdf !== null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCheckingAuth(false);
      if (!session) {
        router.replace("/login");
        return;
      }
      const email = session.user.email ?? "";
      setUserEmail(email);
      setAccessToken(session.access_token ?? null);
      const uname = (session.user?.user_metadata?.username as string)?.trim();
      setUserDisplayName(uname || email?.split("@")[0] || "Account");
      supabase
        .from("pdf_uploads")
        .select("id, filename, subject, created_at, is_published")
        .eq("user_email", email)
        .order("created_at", { ascending: false })
        .then(async ({ data: rows, error }) => {
          if (error) return;
          if (!rows?.length) {
            setUploads([]);
            return;
          }
          const ids = rows.map((r) => r.id);
          const { data: counts } = await supabase
            .from("questions")
            .select("upload_id")
            .in("upload_id", ids);
          const countByUpload: Record<string, number> = {};
          for (const c of counts ?? []) {
            const u = c.upload_id as string;
            countByUpload[u] = (countByUpload[u] ?? 0) + 1;
          }
          setUploads(
            rows.map((row) => ({
              id: row.id,
              name: row.filename ?? "PDF",
              subject: (row.subject ?? "AP_CSA") as SubjectValue,
              questionCount: countByUpload[row.id] ?? 0,
              uploadedAt: row.created_at ?? new Date().toISOString(),
              isPublished: row.is_published === true,
            }))
          );
        });
    });
  }, [router]);

  useEffect(() => {
    if (!accessToken) return;
    fetch("/api/exams/recent", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.attempts) setRecentAttempts(res.attempts);
      });
  }, [accessToken]);

  useEffect(() => {
    if (!expandedAttemptId || !accessToken) {
      setExpandedAttemptData(null);
      return;
    }
    setExpandedAttemptLoading(true);
    setSelectedWrongQuestion(null);
    setWrongResultExplanation(null);
    fetch(`/api/exam/attempt/${expandedAttemptId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setExpandedAttemptData(null);
          return;
        }
        setExpandedAttemptData({
          upload: data.upload,
          questions: data.questions ?? [],
          result: { breakdown: data.result?.breakdown ?? [] },
        });
      })
      .finally(() => setExpandedAttemptLoading(false));
  }, [expandedAttemptId, accessToken]);

  const handleWrongQuestionClick = useCallback(
    async (questionNumber: number) => {
      const data = expandedAttemptData;
      if (!data) return;
      const q = data.questions.find((qq) => qq.question_number === questionNumber);
      const row = data.result.breakdown.find((b) => b.questionNumber === questionNumber);
      if (!q || !row) return;
      setSelectedWrongQuestion(questionNumber);
      setWrongResultViewMode("explanation");
      setWrongResultExplanationLoading(true);
      setWrongResultExplanation(null);
      try {
        const opts = [q.option_a, q.option_b, q.option_c, q.option_d, q.option_e].filter(
          (o): o is string => o != null && String(o).trim() !== ""
        );
        const res = await fetch("/api/exam/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            questionText: q.question_text,
            passageText: q.passage_text ?? "",
            options: opts,
            correctAnswer: row.correctAnswer ?? "A",
            subject: data.upload.subject,
          }),
        });
        const json = await res.json();
        setWrongResultExplanation(json.explanation ?? "No explanation available.");
      } catch {
        setWrongResultExplanation("Failed to load explanation.");
      } finally {
        setWrongResultExplanationLoading(false);
      }
    },
    [expandedAttemptData]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type === "application/pdf"
    );
    if (files.length) {
      setSelectedFile(files[0]);
      setUploadError(null);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length) {
      setSelectedFile(files[0]);
      setUploadError(null);
    }
    e.target.value = "";
  }, []);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setUploadError(null);
  }, []);

  async function handleAnalyze() {
    if (!selectedFile || !canAnalyze || !subject) return;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    const steps = [0, 25, 50, 75, 100];
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      stepIndex = Math.min(stepIndex + 1, steps.length - 1);
      setUploadProgress(steps[stepIndex] ?? 0);
    }, 800);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const userEmail = session?.user?.email ?? "";

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("subject", subject);
      formData.append("questionCount", String(questionCountNum));
      formData.append("userEmail", userEmail);
      formData.append(
        "hasVisuals",
        isCode ? "true" : (hasVisualsInPdf ? "true" : "false")
      );
      formData.append("aiProvider", "gemini");

      const res = await fetch("/api/upload/analyze", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setUploadError(data.error ?? "Analysis failed. Try again.");
        return;
      }

      setUploads((prev) => [
        {
          id: data.examId ?? generateId(),
          name: selectedFile.name,
          subject,
          questionCount: questionCountNum,
          uploadedAt: new Date().toISOString(),
          isPublished: false,
        },
        ...prev,
      ]);
      setSelectedFile(null);
      setQuestionCount("");
    } catch {
      setUploadError("Connection error. Try again.");
    } finally {
      clearInterval(progressInterval);
      setUploadProgress(100);
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 300);
    }
  }

  const subjectLabel = subject
    ? (SUBJECTS.find((s) => s.value === subject)?.label ?? subject)
    : "Select subject";

  const filteredUploads = subjectFilter
    ? uploads.filter((u) => u.subject === subjectFilter)
    : uploads;

  const wrongAnswersFromAttempt = expandedAttemptData
    ? expandedAttemptData.result.breakdown.filter(
        (b) => !b.isCorrect && b.userAnswer != null && String(b.userAnswer).trim() !== ""
      )
    : [];

  const subjectFilterLabel =
    subjectFilter === ""
      ? "All subjects"
      : SUBJECTS_FILTER.find((s) => s.value === subjectFilter)?.label ?? subjectFilter;

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="border-b border-gray-200 bg-white shadow-sm sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold text-gray-900 hover:text-blue-600 transition-colors">
            <BookOpen className="h-6 w-6 text-blue-600" />
            Bluebook Online
          </Link>
          <HeaderNav />
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-900">
            Upload exam PDF
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Upload your AP exam PDF to get started. The AI will extract questions automatically.
          </p>
        </div>

        {recentAttempts.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              Recent exams
            </h2>
            <div className="space-y-4">
              {recentAttempts.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
                >
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate" title={a.filename}>
                        {a.filename}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {SUBJECT_LABELS[a.subject as SubjectKey] ?? a.subject}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        {a.percentage}% · {a.correctCount}/{a.totalQuestions}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(a.completedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedAttemptId(expandedAttemptId === a.id ? null : a.id)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                      >
                        <Play className="h-3.5 w-3.5" />
                        View
                      </button>
                      <Link
                        href={`/exam/${a.uploadId}`}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        Open exam
                      </Link>
                    </div>
                  </div>
                  {expandedAttemptId === a.id && (
                    <div className="border-t border-gray-100 bg-gray-50/50 p-4">
                      {expandedAttemptLoading ? (
                        <p className="text-sm text-gray-500">Loading…</p>
                      ) : expandedAttemptData ? (
                        <>
                          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            Wrong answers ({wrongAnswersFromAttempt.length})
                          </h3>
                          {wrongAnswersFromAttempt.length === 0 ? (
                            <p className="text-sm text-gray-500">No wrong answers (unanswered excluded).</p>
                          ) : (
                            <>
                              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
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
                                      {wrongAnswersFromAttempt.map((row) => (
                                        <tr
                                          key={row.questionNumber}
                                          onClick={() => handleWrongQuestionClick(row.questionNumber)}
                                          className={cn(
                                            "border-b border-gray-100 cursor-pointer transition-colors",
                                            selectedWrongQuestion === row.questionNumber ? "bg-blue-50" : "hover:bg-gray-50"
                                          )}
                                        >
                                          <td className="px-4 py-3 font-medium text-gray-900">{row.questionNumber}</td>
                                          <td className="px-4 py-3 text-red-600">{row.userAnswer ?? "—"}</td>
                                          <td className="px-4 py-3 text-green-600">{row.correctAnswer ?? "—"}</td>
                                          <td className="px-4 py-3">
                                            <span className="inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-100 text-red-800">
                                              Incorrect
                                            </span>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                              {selectedWrongQuestion != null && (() => {
                                const selectedQ = expandedAttemptData.questions.find((q) => q.question_number === selectedWrongQuestion);
                                return (
                                  <div className="mt-6 rounded-xl border-2 border-blue-200 bg-white p-6 shadow-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setWrongResultViewMode("explanation")}
                                          className={cn(
                                            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                                            wrongResultViewMode === "explanation"
                                              ? "bg-blue-600 text-white"
                                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                          )}
                                        >
                                          Solution explanation
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setWrongResultViewMode("question")}
                                          className={cn(
                                            "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                                            wrongResultViewMode === "question"
                                              ? "bg-blue-600 text-white"
                                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                          )}
                                        >
                                          Show question
                                        </button>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedWrongQuestion(null)}
                                        className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                                      >
                                        <X className="h-4 w-4" />
                                        Close
                                      </button>
                                    </div>
                                    {wrongResultViewMode === "explanation" ? (
                                      wrongResultExplanationLoading ? (
                                        <p className="text-sm text-gray-500">Loading explanation…</p>
                                      ) : wrongResultExplanation ? (
                                        <div className="text-sm text-gray-700 whitespace-pre-wrap">{wrongResultExplanation}</div>
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
                                            .filter((o): o is { key: string; text: string } => o.text != null && String(o.text).trim() !== "")
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
                            </>
                          )}
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {!showUploadForm ? (
          <section className="mb-8">
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              className="inline-flex items-center gap-3 rounded-xl border-2 border-blue-600 bg-blue-600 px-8 py-5 text-base font-semibold text-white shadow-md hover:bg-blue-700 hover:border-blue-700 hover:shadow-lg transition-all"
            >
              <Upload className="h-6 w-6" />
              Upload & Analyze with AI
            </button>
            <p className="mt-2 text-sm text-gray-500">
              Click to open the file selection and analysis form.
            </p>
          </section>
        ) : (
          <div className="grid lg:grid-cols-[1fr,380px] gap-8">
            <div>
            {/* Step indicator */}
            <div className="flex items-center gap-2 mb-6">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-sm font-semibold">1</span>
              <span className="text-sm text-gray-500">Select PDF</span>
              <span className="text-gray-300">→</span>
              <span className={cn("flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold", subject && selectedFile ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500")}>2</span>
              <span className="text-sm text-gray-500">Subject & count</span>
              <span className="text-gray-300">→</span>
              <span className={cn("flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold", canAnalyze ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500")}>3</span>
              <span className="text-sm text-gray-500">Analyze</span>
            </div>

            {/* File selection only – click to open file picker */}
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Upload className="h-5 w-5 text-blue-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Select PDF file
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadForm(false);
                    setUploadError(null);
                    setSelectedFile(null);
                    setSubject("");
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Close
                </button>
              </div>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                  "relative rounded-lg border-2 border-dashed p-10 text-center transition-colors",
                  isDragging
                    ? "border-blue-600 bg-blue-600/5"
                    : "border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"
                )}
              >
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                  disabled={isUploading}
                />
                <Upload className="mx-auto h-10 w-10 text-gray-400" />
                <p className="mt-2 text-sm font-medium text-gray-700">
                  Drag and drop a PDF or click to choose a file
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Click to open the file picker. This process may take a while.
                </p>
                <div className="mt-3 flex items-center justify-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
                  <span>Only PDF format is accepted.</span>
                </div>
                {selectedFile && (
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-md bg-white border border-gray-200 px-4 py-2 max-w-md mx-auto">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-800 truncate flex-1">
                      {selectedFile.name}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0">
                      ({selectedFile.size >= 1024 * 1024
                        ? `${(selectedFile.size / 1024 / 1024).toFixed(1)} MB`
                        : `${(selectedFile.size / 1024).toFixed(1)} KB`})
                    </span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      aria-label="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* Subject and analysis section */}
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-4">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Subject and analysis
                </h2>
              </div>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSubjectOpen((o) => !o)}
                      className={cn(
                        "w-full flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm",
                        "border-gray-200 bg-white text-gray-900",
                        "focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-gray-500" />
                        {subjectLabel}
                      </span>
                      <ChevronDown
                        className={cn("h-4 w-4 text-gray-500", subjectOpen && "rotate-180")}
                      />
                    </button>
                    {subjectOpen && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                        {SUBJECTS.map((s) => (
                          <button
                            key={s.value}
                            type="button"
                            onClick={() => {
                              setSubject(s.value);
                              const def = SUBJECT_DEFAULT_HAS_VISUALS[s.value];
                              setHasVisualsInPdf(def === "code" ? true : def);
                              setSubjectOpen(false);
                            }}
                            className={cn(
                              "w-full px-3 py-2 text-left text-sm",
                              subject === s.value
                                ? "bg-blue-600 text-white"
                                : "text-gray-700 hover:bg-gray-50"
                            )}
                          >
                            {s.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="w-full sm:w-40">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Question count
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={999}
                    value={questionCount}
                    onChange={(e) => setQuestionCount(e.target.value)}
                    placeholder="e.g. 50"
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>
              {subject && !isCode && (
                <label
                  className={cn(
                    "mb-4 flex cursor-pointer items-center gap-4 rounded-lg border-2 px-4 py-3 transition-colors",
                    hasVisualsInPdf
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={hasVisualsInPdf ?? false}
                    onChange={(e) => setHasVisualsInPdf(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      hasVisualsInPdf ? "bg-blue-100" : "bg-gray-200"
                    )}>
                      <ImageIcon className={cn("h-5 w-5", hasVisualsInPdf ? "text-blue-600" : "text-gray-500")} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        My PDF contains images, tables, or graphs
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Enable for better extraction of charts, diagrams, and data tables
                      </p>
                    </div>
                  </div>
                </label>
              )}
              {uploadError && (
                <p className="mb-3 text-sm text-red-600" role="alert">
                  {uploadError}
                </p>
              )}
              <div>
                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={!canAnalyze || isUploading}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium",
                    canAnalyze && !isUploading
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  )}
                >
                  <Brain className="h-4 w-4" />
                  {isUploading ? "Analyzing…" : "Analyze with AI"}
                </button>
                <p className="mt-1.5 text-xs text-gray-500">
                  Select a PDF above and enter subject and question count to enable this button. This process may take a while.
                </p>
              </div>
              {isUploading && (
                <div className="mt-4 w-full max-w-xs">
                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Analyzing…</p>
                </div>
              )}

              <div className="mt-6 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <Lightbulb className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="text-sm text-gray-700">
                  <p className="font-medium text-amber-800 mb-1">Tips</p>
                  <ul className="list-disc list-inside space-y-0.5 text-sm text-gray-600">
                    <li>Use clear scans for better question extraction.</li>
                    <li>Check &quot;My PDF contains images, tables, or graphs&quot; if your exam has visuals.</li>
                    <li>Only PDF format is accepted.</li>
                  </ul>
                </div>
              </div>
            </section>
            </div>

            {/* Right column: My exams */}
            <div className="lg:order-2">
              <section>
                {uploads.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm mb-6 ring-1 ring-gray-100/50">
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="font-medium text-gray-900">
                        {filteredUploads.length} exam{filteredUploads.length !== 1 ? "s" : ""}
                      </span>
                      <span className="text-gray-400">·</span>
                      <span className="text-gray-600">
                        {filteredUploads.reduce((s, e) => s + e.questionCount, 0)} total questions
                      </span>
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    My exams
                  </h2>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setSubjectFilterOpen((o) => !o)}
                      className={cn(
                        "flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700",
                        "hover:bg-gray-50 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                      )}
                    >
                      {subjectFilterLabel}
                      <ChevronDown className={cn("h-4 w-4 text-gray-500", subjectFilterOpen && "rotate-180")} />
                    </button>
                    {subjectFilterOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          aria-hidden
                          onClick={() => setSubjectFilterOpen(false)}
                        />
                        <div className="absolute right-0 z-20 mt-1 min-w-[220px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                          {SUBJECTS_FILTER.map((s) => (
                            <button
                              key={s.value || "all"}
                              type="button"
                              onClick={() => {
                                setSubjectFilter(s.value as SubjectValue | "");
                                setSubjectFilterOpen(false);
                              }}
                              className={cn(
                                "w-full px-3 py-2 text-left text-sm",
                                subjectFilter === s.value
                                  ? "bg-blue-600 text-white"
                                  : "text-gray-700 hover:bg-gray-50"
                              )}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {deleteError && (
            <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 flex items-center justify-between">
              <span>{deleteError}</span>
              <button
                type="button"
                onClick={() => setDeleteError(null)}
                className="text-red-500 hover:text-red-700 font-medium"
                aria-label="Dismiss"
              >
                Dismiss
              </button>
            </div>
          )}
          {filteredUploads.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              {uploads.length === 0 ? "No exams yet. Upload a PDF above." : "No exams match this filter."}
            </div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      PDF name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Questions
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploaded
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Publish
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredUploads.map((exam) => (
                    <tr key={exam.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />
                        <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                          {exam.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {SUBJECTS.find((s) => s.value === exam.subject)?.label ?? exam.subject}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {exam.questionCount || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(exam.uploadedAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={exam.isPublished}
                          disabled={togglingPublishId === exam.id}
                          onClick={async () => {
                            setTogglingPublishId(exam.id);
                            try {
                              const supabase = createClient();
                              const {
                                data: { session },
                              } = await supabase.auth.getSession();
                              const token = session?.access_token;
                              if (!token) return;
                              const newVal = !exam.isPublished;
                              const res = await fetch(`/api/upload/${exam.id}/publish`, {
                                method: "PATCH",
                                headers: {
                                  Authorization: `Bearer ${token}`,
                                  "Content-Type": "application/json",
                                },
                                body: JSON.stringify({ isPublished: newVal }),
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) {
                                setDeleteError((data.error as string) || "Failed to update publish status.");
                                return;
                              }
                              setUploads((prev) =>
                                prev.map((u) =>
                                  u.id === exam.id ? { ...u, isPublished: newVal } : u
                                )
                              );
                            } finally {
                              setTogglingPublishId(null);
                            }
                          }}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                            exam.isPublished
                              ? "bg-green-600 focus:ring-green-500"
                              : "bg-gray-200 focus:ring-blue-500"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition",
                              exam.isPublished ? "translate-x-5" : "translate-x-1"
                            )}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/exam/${exam.id}`}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Start exam
                          </Link>
                          <button
                            type="button"
                            disabled={deletingId === exam.id}
                            onClick={async () => {
                              setDeleteError(null);
                              setDeletingId(exam.id);
                              try {
                                const supabase = createClient();
                                const {
                                  data: { session },
                                } = await supabase.auth.getSession();
                                const token = session?.access_token;
                                if (!token) {
                                  setDeleteError("Please sign in again.");
                                  return;
                                }
                                const res = await fetch(`/api/upload/${exam.id}`, {
                                  method: "DELETE",
                                  headers: { Authorization: `Bearer ${token}` },
                                });
                                const data = await res.json().catch(() => ({}));
                                if (!res.ok) {
                                  setDeleteError((data.error as string) || "Failed to delete exam.");
                                  return;
                                }
                                setUploads((prev) => prev.filter((u) => u.id !== exam.id));
                              } finally {
                                setDeletingId(null);
                              }
                            }}
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
              </section>
            </div>
          </div>
        )}
        {!showUploadForm && (
          <section className="mt-8">
            {uploads.length > 0 && (
              <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm mb-6 ring-1 ring-gray-100/50">
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <span className="font-medium text-gray-900">
                    {filteredUploads.length} exam{filteredUploads.length !== 1 ? "s" : ""}
                  </span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-600">
                    {filteredUploads.reduce((s, e) => s + e.questionCount, 0)} total questions
                  </span>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-3">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-600" />
                My exams
              </h2>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSubjectFilterOpen((o) => !o)}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700",
                    "hover:bg-gray-50 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 focus:outline-none"
                  )}
                >
                  {subjectFilterLabel}
                  <ChevronDown className={cn("h-4 w-4 text-gray-500", subjectFilterOpen && "rotate-180")} />
                </button>
                {subjectFilterOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      aria-hidden
                      onClick={() => setSubjectFilterOpen(false)}
                    />
                    <div className="absolute right-0 z-20 mt-1 min-w-[220px] rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                      {SUBJECTS_FILTER.map((s) => (
                        <button
                          key={s.value || "all"}
                          type="button"
                          onClick={() => {
                            setSubjectFilter(s.value as SubjectValue | "");
                            setSubjectFilterOpen(false);
                          }}
                          className={cn(
                            "w-full px-3 py-2 text-left text-sm",
                            subjectFilter === s.value
                              ? "bg-blue-600 text-white"
                              : "text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            {deleteError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 flex items-center justify-between">
                <span>{deleteError}</span>
                <button type="button" onClick={() => setDeleteError(null)} className="text-red-500 hover:text-red-700 font-medium" aria-label="Dismiss">Dismiss</button>
              </div>
            )}
            {filteredUploads.length === 0 ? (
              <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{uploads.length === 0 ? "No exams yet. Upload a PDF above." : "No exams match this filter."}</div>
            ) : (
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PDF name</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Questions</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uploaded</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Publish</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredUploads.map((exam) => (
                      <tr key={exam.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{exam.name}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{SUBJECTS.find((s) => s.value === exam.subject)?.label ?? exam.subject}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{exam.questionCount || "—"}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{new Date(exam.uploadedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</td>
                        <td className="px-4 py-3">
                          <button type="button" role="switch" aria-checked={exam.isPublished} disabled={togglingPublishId === exam.id} onClick={async () => { setTogglingPublishId(exam.id); try { const supabase = createClient(); const { data: { session } } = await supabase.auth.getSession(); const token = session?.access_token; if (!token) return; const newVal = !exam.isPublished; const res = await fetch(`/api/upload/${exam.id}/publish`, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ isPublished: newVal }) }); const data = await res.json().catch(() => ({})); if (!res.ok) { setDeleteError((data.error as string) || "Failed to update publish status."); return; } setUploads((prev) => prev.map((u) => u.id === exam.id ? { ...u, isPublished: newVal } : u)); } finally { setTogglingPublishId(null); } }} className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", exam.isPublished ? "bg-green-600 focus:ring-green-500" : "bg-gray-200 focus:ring-blue-500")}><span className={cn("pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition", exam.isPublished ? "translate-x-5" : "translate-x-1")} /></button>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/exam/${exam.id}`} className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"><Play className="h-3.5 w-3.5" />Start exam</Link>
                            <button type="button" disabled={deletingId === exam.id} onClick={async () => { setDeleteError(null); setDeletingId(exam.id); try { const supabase = createClient(); const { data: { session } } = await supabase.auth.getSession(); const token = session?.access_token; if (!token) { setDeleteError("Please sign in again."); return; } const res = await fetch(`/api/upload/${exam.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }); const data = await res.json().catch(() => ({})); if (!res.ok) { setDeleteError((data.error as string) || "Failed to delete exam."); return; } setUploads((prev) => prev.filter((u) => u.id !== exam.id)); } finally { setDeletingId(null); } }} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
