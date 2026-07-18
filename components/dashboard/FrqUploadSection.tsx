"use client";

import { useMemo, useRef, useState } from "react";
import {
  Upload,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/library/DashboardAuthProvider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  FRQ_COURSE_IDS,
  FRQ_COURSES,
  HYBRID_COURSE_IDS,
  type FrqCourseId,
} from "@/lib/frq-courses";
import { SUBJECT_LABELS, type SubjectKey } from "@/lib/gemini-prompts";
import { MAX_PDF_UPLOAD_BYTES, MAX_PDF_UPLOAD_MB } from "@/lib/pdf-upload-limits";
import { PdfDropzone } from "@/components/dashboard/PdfDropzone";
import { UploadStepIndicator } from "@/components/dashboard/UploadStepIndicator";
import {
  EXAM_SOURCE_TYPE_LABELS,
  validateExamSource,
  type ExamSourceType,
} from "@/lib/exam-source";

const HYBRID_LABELS: Record<string, string> = Object.fromEntries(
  HYBRID_COURSE_IDS.map((id) => [id, SUBJECT_LABELS[id as SubjectKey] ?? id])
);

const FRQ_UPLOAD_STEPS = [
  { id: 1, label: "Upload PDF" },
  { id: 2, label: "Course details" },
  { id: 3, label: "Exam source" },
  { id: 4, label: "Analyze" },
] as const;

export function FrqUploadSection() {
  const { userEmail, accessToken, checkingAuth } = useDashboardAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rubricInputRef = useRef<HTMLInputElement>(null);

  const [courseId, setCourseId] = useState<FrqCourseId>("AP_US_HISTORY");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rubricFile, setRubricFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHybrid, setShowHybrid] = useState(false);
  const [sourceType, setSourceType] = useState<ExamSourceType | "">("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notOfficialConfirmed, setNotOfficialConfirmed] = useState(false);
  const [uploadSuccessMessage, setUploadSuccessMessage] = useState<string | null>(null);

  const sourceValidation = useMemo(() => {
    if (!sourceType) return { ok: false as const, error: "Select a source type." };
    return validateExamSource({
      sourceType,
      sourceName,
      sourceUrl: sourceType === "school" ? undefined : sourceUrl,
      notOfficialConfirmed,
    });
  }, [sourceType, sourceName, sourceUrl, notOfficialConfirmed]);

  const isSourceValid = sourceValidation.ok;

  const activeStep: 1 | 2 | 3 | 4 = !file
    ? 1
    : analyzing
      ? 4
      : !isSourceValid
        ? 3
        : 2;

  const handleAnalyze = async () => {
    if (!userEmail || !file) {
      setError("Please select a PDF file.");
      return;
    }
    if (file.size > MAX_PDF_UPLOAD_BYTES) {
      setError(`PDF must be at most ${MAX_PDF_UPLOAD_MB} MB.`);
      return;
    }
    if (!sourceValidation.ok) {
      setError(sourceValidation.error);
      return;
    }

    setAnalyzing(true);
    setError(null);
    setUploadSuccessMessage(null);

    try {
      const supabase = createClient();
      const token = accessToken ?? (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error("Please sign in again.");

      const signedRes = await fetch("/api/frq/upload/create-signed-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      if (!signedRes.ok) {
        const err = await signedRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Upload URL failed.");
      }
      const { bucket, storagePath, token: uploadToken } = await signedRes.json();

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(storagePath, uploadToken, file, { contentType: "application/pdf" });

      if (uploadError) throw new Error(uploadError.message);

      let rubricStoragePath: string | undefined;
      if (rubricFile) {
        const rubricSigned = await fetch("/api/frq/upload/create-signed-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            filename: rubricFile.name,
            contentType: rubricFile.type,
            size: rubricFile.size,
          }),
        });
        if (rubricSigned.ok) {
          const rubricData = await rubricSigned.json();
          await supabase.storage
            .from(rubricData.bucket)
            .uploadToSignedUrl(rubricData.storagePath, rubricData.token, rubricFile, {
              contentType: "application/pdf",
            });
          rubricStoragePath = rubricData.storagePath;
        }
      }

      const analyzeRes = await fetch("/api/frq/upload/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          courseId,
          title: title.trim() || file.name.replace(/\.pdf$/i, ""),
          storagePath,
          rubricStoragePath,
          sourceType: sourceValidation.normalized.sourceType,
          sourceName: sourceValidation.normalized.sourceName,
          sourceUrl: sourceValidation.normalized.sourceUrl,
          notOfficialConfirmed: true,
        }),
      });

      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) {
        throw new Error(analyzeData.error ?? "Analysis failed.");
      }

      setFile(null);
      setRubricFile(null);
      setTitle("");
      setSourceType("");
      setSourceName("");
      setSourceUrl("");
      setNotOfficialConfirmed(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (rubricInputRef.current) rubricInputRef.current.value = "";
      setUploadSuccessMessage(
        "Publish pending — track status in Library."
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const groupedCourses = {
    english: FRQ_COURSE_IDS.filter((id) => FRQ_COURSES[id].category === "english"),
    history: FRQ_COURSE_IDS.filter((id) => FRQ_COURSES[id].category === "history"),
    social: FRQ_COURSE_IDS.filter((id) => FRQ_COURSES[id].category === "social"),
    science: FRQ_COURSE_IDS.filter((id) => FRQ_COURSES[id].category === "science"),
    cs: FRQ_COURSE_IDS.filter((id) => FRQ_COURSES[id].category === "cs"),
    humanities: FRQ_COURSE_IDS.filter((id) => FRQ_COURSES[id].category === "humanities"),
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-[20vh] items-center justify-center text-sm text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Free Response Exams</h1>
        <p className="mt-1 text-sm text-gray-600">
          Upload AP Free Response practice exams for the 16 fully digital Bluebook courses.
          Hybrid courses (Calculus, Physics, etc.) use handwritten booklets and are not supported.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          Manage uploaded FRQ exams in{" "}
          <Link href="/dashboard/library?examKind=frq" className="text-blue-600 hover:underline">
            Library
          </Link>
          .
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Create New FRQ Exam</h2>
          <UploadStepIndicator steps={FRQ_UPLOAD_STEPS} activeStep={activeStep} />
        </div>

        <div className="space-y-8">
          <section aria-labelledby="frq-pdf-step">
            <h3 id="frq-pdf-step" className="sr-only">
              Step 1: Upload PDF
            </h3>
            <PdfDropzone
              file={file}
              onFileChange={setFile}
              disabled={analyzing}
              variant="hero"
              title="FRQ PDF"
              description="Drag and drop your FRQ PDF, or click to browse"
              inputRef={fileInputRef}
            />
          </section>

          <section aria-labelledby="frq-course-step" className="space-y-4 border-t border-gray-100 pt-6">
            <h3 id="frq-course-step" className="text-sm font-semibold text-gray-900">
              Course details
            </h3>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">AP Course</label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value as FrqCourseId)}
                disabled={analyzing}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
              >
                {Object.entries(groupedCourses).map(([cat, ids]) => (
                  <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
                    {ids.map((id) => (
                      <option key={id} value={id}>
                        {FRQ_COURSES[id].fullName}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Editor: {FRQ_COURSES[courseId].editorType === "code" ? "Java code editor" : "Rich text (Bluebook)"} ·{" "}
                {FRQ_COURSES[courseId].sectionDurationMin} min section
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Title (optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={analyzing}
                placeholder="e.g. 2025 APUSH FRQ Practice"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
          </section>

          <section aria-labelledby="frq-rubric-step" className="border-t border-gray-100 pt-6">
            <h3 id="frq-rubric-step" className="sr-only">
              Optional scoring guidelines
            </h3>
            <PdfDropzone
              file={rubricFile}
              onFileChange={setRubricFile}
              disabled={analyzing}
              variant="compact"
              title="Scoring guidelines PDF (optional)"
              description="Upload College Board scoring guidelines for more accurate AI grading"
              inputRef={rubricInputRef}
            />
          </section>

          <section aria-labelledby="frq-source-step" className="border-t border-gray-100 pt-6">
            <h3 id="frq-source-step" className="text-sm font-semibold text-gray-900">
              Exam source
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Tell us where this PDF comes from. This information is shown to other users after moderator approval.
            </p>
            <div className="mt-3 space-y-2">
              {(Object.keys(EXAM_SOURCE_TYPE_LABELS) as ExamSourceType[]).map((type) => (
                <label
                  key={type}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors",
                    sourceType === type
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  )}
                >
                  <input
                    type="radio"
                    name="frqSourceType"
                    value={type}
                    checked={sourceType === type}
                    onChange={() => {
                      setSourceType(type);
                      if (type === "school") {
                        setSourceUrl("");
                        setSourceName("");
                      }
                    }}
                    className="mt-0.5"
                    disabled={analyzing}
                  />
                  <span className="text-gray-800">{EXAM_SOURCE_TYPE_LABELS[type]}</span>
                </label>
              ))}
            </div>
            {sourceType && sourceType !== "school" ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label htmlFor="frqSourceName" className="block text-xs font-medium text-gray-700">
                    {sourceType === "book" ? "Book title" : "Agency name"}
                    <span className="text-red-600"> *</span>
                  </label>
                  <input
                    id="frqSourceName"
                    type="text"
                    value={sourceName}
                    onChange={(e) => setSourceName(e.target.value)}
                    maxLength={200}
                    disabled={analyzing}
                    placeholder={
                      sourceType === "book"
                        ? "e.g. Barron's AP US History"
                        : "e.g. Princeton Review"
                    }
                    className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label htmlFor="frqSourceUrl" className="block text-xs font-medium text-gray-700">
                    Source URL <span className="text-red-600">*</span>
                  </label>
                  <input
                    id="frqSourceUrl"
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    disabled={analyzing}
                    placeholder="https://publisher or agency website"
                    className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>
              </div>
            ) : null}
            <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={notOfficialConfirmed}
                onChange={(e) => setNotOfficialConfirmed(e.target.checked)}
                disabled={analyzing}
                className="mt-0.5 rounded border-gray-300"
              />
              <span>
                I confirm this is not official College Board, ACT, or Bluebook material.
              </span>
            </label>
            {!isSourceValid && sourceType && !sourceValidation.ok ? (
              <p className="mt-2 text-xs text-amber-700">{sourceValidation.error}</p>
            ) : null}
          </section>

          {uploadSuccessMessage && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
              {uploadSuccessMessage}{" "}
              <Link href="/dashboard/library?examKind=frq" className="text-blue-600 hover:underline">
                Open Library
              </Link>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || !file || !isSourceValid}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto",
              (analyzing || !file || !isSourceValid) && "cursor-not-allowed opacity-60"
            )}
          >
            {analyzing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Analyzing with AI…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" /> Upload & Analyze
              </>
            )}
          </button>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <button
            type="button"
            onClick={() => setShowHybrid((s) => !s)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            {showHybrid ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Hybrid digital courses (not supported — handwritten FRQs)
          </button>
          {showHybrid && (
            <ul className="mt-2 space-y-1 text-xs text-gray-400">
              {HYBRID_COURSE_IDS.map((id) => (
                <li key={id}>• {HYBRID_LABELS[id] ?? id}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
