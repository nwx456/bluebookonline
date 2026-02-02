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
  LogOut,
  X,
  Sparkles,
} from "lucide-react";
import { cn, generateId } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";

const SUBJECTS = [
  { value: "AP_CSA", label: "AP CSA (Computer Science)" },
  { value: "AP_MICROECONOMICS", label: "AP Microeconomics" },
  { value: "AP_MACROECONOMICS", label: "AP Macroeconomics" },
  { value: "AP_PSYCHOLOGY", label: "AP Psychology" },
  { value: "AP_STATISTICS", label: "AP Statistics" },
] as const;

type SubjectValue = (typeof SUBJECTS)[number]["value"];

interface UploadedExam {
  id: string;
  name: string;
  subject: SubjectValue;
  questionCount: number;
  uploadedAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [subject, setSubject] = useState<SubjectValue>("AP_CSA");
  const [questionCount, setQuestionCount] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadedExam[]>([]);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);

  const questionCountNum = parseInt(questionCount, 10);
  const isQuestionCountValid = Number.isInteger(questionCountNum) && questionCountNum >= 1;
  const canAnalyze = selectedFile !== null && isQuestionCountValid;

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCheckingAuth(false);
      if (!session) {
        router.replace("/login");
        return;
      }
      const email = session.user.email ?? "";
      supabase
        .from("pdf_uploads")
        .select("id, filename, subject, created_at")
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
            }))
          );
        });
    });
  }, [router]);

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
    if (!selectedFile || !canAnalyze) return;
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
        ...prev,
        {
          id: data.examId ?? generateId(),
          name: selectedFile.name,
          subject,
          questionCount: questionCountNum,
          uploadedAt: new Date().toISOString(),
        },
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

  const subjectLabel = SUBJECTS.find((s) => s.value === subject)?.label ?? subject;

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center">
        <div className="text-sm text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/dashboard" className="font-semibold text-gray-900">
            Bluebook Online
          </Link>
          <nav className="flex items-center gap-4">
            <span className="text-sm text-gray-500">Dashboard</span>
            <Link
              href="/"
              className="text-sm font-medium text-gray-600 hover:text-[#1B365D]"
            >
              Home
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-[#1B365D]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">
          Upload exam PDF
        </h1>

        {!showUploadForm ? (
          <section className="mb-8">
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              className="inline-flex items-center gap-3 rounded-xl border-2 border-[#1B365D] bg-[#1B365D] px-6 py-4 text-base font-medium text-white shadow-sm hover:bg-[#152a4a] hover:border-[#152a4a] transition-colors"
            >
              <Sparkles className="h-6 w-6" />
              AI Analiz Et
            </button>
            <p className="mt-2 text-sm text-gray-500">
              Click to open the file selection and analysis form.
            </p>
          </section>
        ) : (
          <>
            {/* 1. Sadece dosya seçimi – tıklanınca dosya penceresi bu alanda açılır */}
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900">
                  PDF dosyası seçin
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadForm(false);
                    setUploadError(null);
                    setSelectedFile(null);
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
                    ? "border-[#1B365D] bg-[#1B365D]/5"
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
                  PDF sürükleyip bırakın veya tıklayıp dosya seçin
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Tıklayınca klasör / dosya seçim penceresi açılır.
                </p>
                {selectedFile && (
                  <div className="mt-4 flex items-center justify-center gap-2 rounded-md bg-white border border-gray-200 px-4 py-2 max-w-md mx-auto">
                    <FileText className="h-4 w-4 text-[#1B365D]" />
                    <span className="text-sm font-medium text-gray-800 truncate flex-1">
                      {selectedFile.name}
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

            {/* 2. Ders, soru sayısı ve AI Analiz Et butonu – ayrı alan */}
            <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Ders ve analiz
              </h2>
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
                        "focus:border-[#1B365D] focus:ring-1 focus:ring-[#1B365D] focus:outline-none"
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
                              setSubjectOpen(false);
                            }}
                            className={cn(
                              "w-full px-3 py-2 text-left text-sm",
                              subject === s.value
                                ? "bg-[#1B365D] text-white"
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
                    className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#1B365D] focus:ring-1 focus:ring-[#1B365D] focus:outline-none"
                  />
                </div>
              </div>
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
                      ? "bg-[#1B365D] text-white hover:bg-[#152a4a]"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  )}
                >
                  <Sparkles className="h-4 w-4" />
                  {isUploading ? "Analiz ediliyor…" : "AI Analiz Et"}
                </button>
                <p className="mt-1.5 text-xs text-gray-500">
                  Önce yukarıdan PDF seçin; ders ve soru sayısını girin. Sonra bu buton aktif olur.
                </p>
              </div>
              {isUploading && (
                <div className="mt-4 w-full max-w-xs">
                  <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div
                      className="h-full bg-[#1B365D] transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Analiz ediliyor…</p>
                </div>
              )}
            </section>
          </>
        )}

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            My exams
          </h2>
          {uploads.length === 0 ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              No exams yet. Upload a PDF above.
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
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {uploads.map((exam) => (
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
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/exam/${exam.id}`}
                            className="inline-flex items-center gap-1 rounded-md bg-[#1B365D] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#152a4a]"
                          >
                            <Play className="h-3.5 w-3.5" />
                            Start exam
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              setUploads((prev) => prev.filter((u) => u.id !== exam.id))
                            }
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
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
      </main>
    </div>
  );
}
