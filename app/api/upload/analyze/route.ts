import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSystemPrompt, isCodeSubject, SUBJECT_KEYS, type SubjectKey } from "@/lib/gemini-prompts";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { generateWithFallback } from "@/lib/gemini-client";
import { partitionStemAndSharedIntro } from "@/lib/shared-stimulus";

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

/** Expected shape of one question from Gemini (matches lib/gemini-prompts.ts OUTPUT_SCHEMA) */
interface GeminiQuestion {
  type?: "code" | "image" | "text";
  content?: string;
  code?: string;
  question?: string;
  precondition?: string;
  image_description?: string | null;
  has_graph?: boolean;
  page_number?: number | null;
  bbox?: { x: number; y: number; width: number; height: number } | null;
  options?: string[];
  correct?: string;
}

/** Parse and validate bbox (0-1 normalized). Returns null if invalid. */
function parseBbox(bbox: unknown): { x: number; y: number; width: number; height: number } | null {
  if (!bbox || typeof bbox !== "object") return null;
  const o = bbox as Record<string, unknown>;
  const x = Number(o.x);
  const y = Number(o.y);
  const width = Number(o.width);
  const height = Number(o.height);
  if (
    !Number.isFinite(x) || !Number.isFinite(y) ||
    !Number.isFinite(width) || !Number.isFinite(height) ||
    x < 0 || x > 1 || y < 0 || y > 1 ||
    width <= 0 || width > 1 || height <= 0 || height > 1 ||
    x + width > 1 || y + height > 1
  ) {
    return null;
  }
  return { x, y, width, height };
}

function parseJsonFromResponse(raw: string): GeminiQuestion[] {
  let text = raw.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/m;
  const match = text.match(codeBlock);
  if (match) text = match[1].trim();
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as GeminiQuestion[];
  } catch {
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      try {
        const slice = text.slice(start, end + 1);
        const parsed = JSON.parse(slice) as unknown;
        if (Array.isArray(parsed)) return parsed as GeminiQuestion[];
      } catch {
        // fallback failed
      }
    }
    return [];
  }
}

function normalizeCorrect(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).toUpperCase().trim();
  if (["A", "B", "C", "D", "E"].includes(s)) return s;
  return null;
}

function optionsToColumns(options: unknown): {
  option_a: string | null;
  option_b: string | null;
  option_c: string | null;
  option_d: string | null;
  option_e: string | null;
} {
  const arr = Array.isArray(options) ? options : [];
  const strings = arr.map((o) => (o != null ? String(o).trim() : ""));
  return {
    option_a: strings[0] || null,
    option_b: strings[1] || null,
    option_c: strings[2] || null,
    option_d: strings[3] || null,
    option_e: strings[4] || null,
  };
}

/** CSA: Strip trailing question sentence from code so only reference code remains in passage_text. */
function stripQuestionFromCode(code: string | null | undefined): {
  codeOnly: string | null;
  strippedQuestion: string | null;
} {
  if (!code?.trim()) return { codeOnly: code?.trim() || null, strippedQuestion: null };
  const t = code.trim();
  // Match trailing question: line(s) that look like "Which...?", "What...?", or any sentence ending with ?
  const questionPattern = /\n?\s*(Which\s+.+\?|What\s+(?:is|does|will|would)\s+.+\?|\.\s+\d+\.\s+.+\?)(\s*)$/is;
  const match = t.match(questionPattern);
  if (match) {
    const idx = t.indexOf(match[1]);
    const codeOnly = t.slice(0, idx).trim();
    const strippedQuestion = match[1].trim();
    return { codeOnly: codeOnly || null, strippedQuestion: strippedQuestion || null };
  }
  // Fallback: last line ending with ? (sentence that shouldn't be in code)
  const lastLineQ = /\n([^\n]*\?)\s*$/;
  const m2 = t.match(lastLineQ);
  if (m2) {
    const idx = t.lastIndexOf(m2[1]);
    const codeOnly = t.slice(0, idx).trim();
    return { codeOnly: codeOnly || null, strippedQuestion: m2[1].trim() };
  }
  return { codeOnly: t, strippedQuestion: null };
}

/** Treat known placeholder or trivial text as empty so it is not shown as question/passage. */
function isPlaceholderText(text: string | null | undefined): boolean {
  if (text == null) return true;
  const t = text.trim();
  if (t.length < 3) return true;
  if (/^\d+$/.test(t)) return true;
  if (t === "geriye dönük uyumluluk için") return true;
  return false;
}

/** For Economics/Stats/Psych: strip numbered list block (I. II. III. ...) from questionText so only stem remains. */
function stripReferenceListFromStem(questionText: string, passageText: string | null): string {
  const q = questionText.trim();
  if (!q) return q;
  if (!passageText?.trim()) return q;
  // Match stem (up to and including "?") followed by optional whitespace and "I." starting the list
  const match = q.match(/^([\s\S]*?\?)\s*(?:\r?\n[\s\S]*?)?\s*I\.\s+[\s\S]*$/);
  if (match) {
    const stripped = match[1].trim();
    if (stripped.length >= 30) return stripped;
  }
  return q;
}

/** True if text looks like a question stem only; should not go to left panel. */
function looksLikeQuestionStemOnly(text: string | null): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  if (t.includes("<table") || t.includes("<svg") || /^\|/.test(t)) return false;
  // I. II. III. öncül listesi ise stem değildir
  if (/\n\s*I[I]?\.\s/m.test(t) || /^\s*I\.\s/m.test(t)) return false;
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const listLike = lines.filter((l) => /^\s*[IVX]+\.\s/.test(l) || /^\s*\d+\.\s/.test(l));
  if (listLike.length >= 2 || (lines.length >= 2 && listLike.length >= 1)) return false;
  return lines.length <= 3 && t.length < 600 && (t.endsWith("?") || /^(Which|What|How)\s/i.test(t));
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const subjectRaw = formData.get("subject") as string | null;
    const questionCountRaw = formData.get("questionCount") as string | null;
    const hasVisualsRaw = formData.get("hasVisuals") as string | null;
    const hasVisuals = hasVisualsRaw === "true";
    const aiProviderRaw = (formData.get("aiProvider") as string | null)?.trim();
    const aiProvider = aiProviderRaw === "claude" ? "claude" : "gemini";
    const userEmail = (formData.get("userEmail") as string | null)?.trim();

    if (aiProvider === "gemini") {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey?.trim()) {
        return NextResponse.json(
          { error: "GEMINI_API_KEY is not set. Add it to .env for PDF analysis." },
          { status: 500 }
        );
      }
    } else {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey?.trim()) {
        return NextResponse.json(
          { error: "ANTHROPIC_API_KEY is not set. Add it to .env to use Claude for PDF analysis." },
          { status: 500 }
        );
      }
    }

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { error: "No PDF file provided." },
        { status: 400 }
      );
    }
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "File must be a PDF." },
        { status: 400 }
      );
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `PDF must be under ${MAX_FILE_SIZE_MB} MB.` },
        { status: 400 }
      );
    }

    const subject = subjectRaw?.trim();
    if (!subject || !SUBJECT_KEYS.includes(subject as SubjectKey)) {
      return NextResponse.json(
        { error: "Invalid or missing subject." },
        { status: 400 }
      );
    }

    const questionCount = parseInt(questionCountRaw ?? "", 10);
    if (!Number.isInteger(questionCount) || questionCount < 1) {
      return NextResponse.json(
        { error: "Question count must be a positive number." },
        { status: 400 }
      );
    }

    if (!userEmail) {
      return NextResponse.json(
        { error: "User email is required." },
        { status: 401 }
      );
    }

    const supabase = createServerSupabaseAdmin();
    const { data: userRow, error: userCheckError } = await supabase
      .from("usertable")
      .select("email")
      .eq("email", userEmail)
      .maybeSingle();

    if (userCheckError || !userRow) {
      return NextResponse.json(
        {
          error:
            "Account not fully set up. Please sign out and complete registration again, or contact support.",
        },
        { status: 403 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const subjectKey = subject as SubjectKey;
    const isCode = isCodeSubject(subjectKey);
    const useHasVisuals = isCode ? true : hasVisuals;

    const isCsa = subject === "AP_CSA" || subject === "AP_CSP";
    const userPrompt = isCsa
      ? `Extract only multiple-choice questions (MSQ). Ignore FRQ sections and instruction-only text. Analyze the attached PDF and return a JSON array of up to ${questionCount} MSQ objects. Each object: **code** (reference Java/code only), **question** (ONLY the MCQ sentence that asks the question; exclude "This question refers to…", "Questions X–Y refer to…", block headers—those belong in image_description if needed), **precondition** (optional; Precondition/Javadoc text), **options** (array of choice texts A–E), **correct** (A/B/C/D/E ONLY if the PDF contains an answer key for this question; otherwise null—do NOT guess or default to A), **page_number** (1-based; the PDF page where the code and question appear—required for each question). Preserve question order as in the PDF. Do not output markdown or explanation, only the JSON array.`
      : useHasVisuals
        ? `Analyze the attached PDF and extract exactly up to ${questionCount} multiple-choice questions. Extract only multiple-choice questions (MSQ). Do not include free-response questions (FRQ) or content from FRQ sections. Return ONLY a JSON array of objects. Each object must have: "type" ("code" | "image" | "text"), "content" (ONLY the actual MCQ stem—the sentence that asks the question; exclude block headers like "This question refers to…", "These questions refer to…", "Questions X–Y refer to…", "Directions:…", "Use the figure/table above"—put those in "image_description"), "image_description" (SVG/table/block intro/passage or null), "options" (array of option texts in order A, B, C, D [and E if present]), "correct" (letter A/B/C/D/E ONLY if the PDF contains an answer key for this question; otherwise null—do NOT guess or default to A). Do not leave content or question empty. When options reference I, II, III (e.g. (A) I only, (B) II only), you MUST include the premise list in image_description: "I. First statement. II. Second statement. III. Third statement." Do not omit this. Include "has_graph" (true/false) for each question—true when the question references a graph, table, or diagram. When has_graph is true, include "page_number" (1-based) and "bbox" (0-1 normalized: x, y, width, height) for the graph/table region in the PDF. Do not include any markdown or explanation, only the JSON array.`
        : `Analyze the attached PDF and extract exactly up to ${questionCount} multiple-choice questions. Extract only multiple-choice questions (MSQ). Do not include free-response questions (FRQ). Return ONLY a JSON array of objects. Each object: "type" ("text"), "content" (ONLY the actual MCQ stem; exclude shared block headers like "This question refers to…"—put those in "image_description"), "image_description" (passage or list as text, or null), "options" (array A–E), "correct" (A/B/C/D/E ONLY if the PDF contains an answer key for this question; otherwise null—do NOT guess or default to A). When options reference I, II, III (e.g. (A) I only, (B) II only), you MUST include the premise list in image_description: "I. First statement. II. Second statement. III. Third statement." Do not omit this. Do NOT include has_graph, page_number, or bbox. Do not include any markdown or explanation, only the JSON array.`;

    let text: string;

    if (aiProvider === "claude") {
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 8192,
        system: getSystemPrompt(subjectKey, useHasVisuals),
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf" as const,
                  data: base64,
                },
              },
              {
                type: "text",
                text: userPrompt,
              },
            ],
          },
        ],
      });
      const textBlock = message.content.find((b) => b.type === "text");
      text = textBlock && "text" in textBlock ? textBlock.text : "";
    } else {
      const { text: analyzed } = await generateWithFallback({
        apiKey: process.env.GEMINI_API_KEY!,
        systemInstruction: getSystemPrompt(subjectKey, useHasVisuals),
        contents: [
          { text: userPrompt },
          {
            inlineData: {
              data: base64,
              mimeType: "application/pdf",
            },
          },
        ],
      });
      text = analyzed;
    }

    if (!text?.trim()) {
      return NextResponse.json(
        { error: `${aiProvider === "claude" ? "Claude" : "Gemini"} returned no content. The PDF may be unreadable or empty.` },
        { status: 502 }
      );
    }

    let questions: GeminiQuestion[];
    try {
      questions = parseJsonFromResponse(text);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse AI response as JSON. Try again or use a simpler PDF." },
        { status: 502 }
      );
    }

    // Skip items with no options (avoid irrelevant/instruction-only entries)
    questions = questions.filter((q) => {
      const opts = optionsToColumns(q.options);
      const hasAnyOption = [
        opts.option_a,
        opts.option_b,
        opts.option_c,
        opts.option_d,
        opts.option_e,
      ].some((o) => o != null && o.trim() !== "");
      return hasAnyOption;
    });

    const { data: uploadRow, error: uploadError } = await supabase
      .from("pdf_uploads")
      .insert({
        user_email: userEmail,
        filename: file.name,
        storage_path: `pending/${file.name}`,
        subject,
        original_text: text.slice(0, 50_000),
        is_published: true,
      })
      .select("id")
      .single();

    if (uploadError || !uploadRow?.id) {
      console.error("pdf_uploads insert error:", uploadError);
      const isDev = process.env.NODE_ENV === "development";
      const detail = isDev && uploadError
        ? ` ${uploadError.code ?? ""} ${uploadError.message ?? ""}`.trim()
        : "";
      return NextResponse.json(
        { error: `Failed to save upload record.${detail}` },
        { status: 500 }
      );
    }

    const uploadId = uploadRow.id;

    // Store PDF in Storage for exam page rendering (Macro/Micro graph = exact page image)
    const bucket = "pdf_uploads";
    const storageKey = `${uploadId}.pdf`;
    try {
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .upload(storageKey, buffer, { contentType: "application/pdf", upsert: true });
      if (storageError) {
        console.error("PDF storage upload error:", storageError);
      }
      // Always set storage_path to uploadId.pdf (canonical path)
      await supabase.from("pdf_uploads").update({ storage_path: storageKey }).eq("id", uploadId);
    } catch (e) {
      console.error("PDF storage error:", e);
      await supabase.from("pdf_uploads").update({ storage_path: storageKey }).eq("id", uploadId);
    }

    const rows = questions.slice(0, questionCount).map((q, i) => {
      const opts = optionsToColumns(q.options);
      const correct = normalizeCorrect(q.correct);
      const isCodeType = q.type === "code";
      let questionText = isCodeType
        ? (q.question ?? q.content ?? "").trim() || "No question text."
        : (q.content ?? "").trim() || "No question text.";
      let passageText: string | null;
      if (isCodeType) {
        const rawCode = (q.code ?? q.content)?.trim() ?? "";
        const { codeOnly, strippedQuestion } = stripQuestionFromCode(rawCode || null);
        const refList = (q.image_description ?? "").trim() || null;
        passageText =
          refList && codeOnly
            ? `${refList}\n\n${codeOnly}`
            : refList || codeOnly || null;
        if (strippedQuestion && (!questionText || questionText === "No question text.")) {
          questionText = strippedQuestion;
        }
      } else {
        passageText = (q.image_description ?? "")?.trim() || null;
      }

      const shared = partitionStemAndSharedIntro(questionText);
      if (shared.intro?.trim() && shared.stem?.trim()) {
        questionText = shared.stem.trim();
        const intro = shared.intro.trim();
        passageText = passageText?.trim()
          ? `${intro}\n\n${passageText}`
          : intro;
      }

      if (isPlaceholderText(questionText)) questionText = "No question text.";
      if (passageText != null && isPlaceholderText(passageText)) passageText = null;

      const isVisualOrPassageSubject = !isCodeSubject(subjectKey);
      if (isVisualOrPassageSubject && passageText != null && looksLikeQuestionStemOnly(passageText)) {
        passageText = null;
      }

      if (isVisualOrPassageSubject) {
        questionText = stripReferenceListFromStem(questionText, passageText);
      }

      const hasAnyOption = [opts.option_a, opts.option_b, opts.option_c, opts.option_d, opts.option_e].some(
        (o) => o != null && o.trim() !== ""
      );
      if (questionText === "No question text." && hasAnyOption) {
        questionText = "Which of the following is correct?";
      }

      const hasGraphExplicit = q.has_graph === true;
      const hasGraphDenied = q.has_graph === false;
      const pageNum =
        q.page_number != null && Number.isInteger(Number(q.page_number))
          ? Number(q.page_number)
          : null;
      const parsedBbox = parseBbox(q.bbox);

      const preconditionText =
        (q.precondition ?? "").trim() || null;

      const hasGraph =
        isVisualOrPassageSubject &&
        useHasVisuals &&
        (hasGraphExplicit || (!hasGraphDenied && pageNum != null));
      const pageNumFinal = isCodeType
        ? (pageNum ?? null)
        : isVisualOrPassageSubject && hasGraph && pageNum != null
          ? pageNum
          : null;
      const bboxVal = isCodeType
        ? null
        : isVisualOrPassageSubject && hasGraph && pageNumFinal != null
          ? parsedBbox
          : null;

      return {
        upload_id: uploadId,
        question_number: i + 1,
        question_text: questionText,
        passage_text: passageText,
        precondition_text: preconditionText,
        option_a: opts.option_a,
        option_b: opts.option_b,
        option_c: opts.option_c,
        option_d: opts.option_d,
        option_e: opts.option_e,
        correct_answer: correct,
        image_url: null,
        has_graph: isVisualOrPassageSubject ? hasGraph : null,
        page_number: pageNumFinal,
        bbox: bboxVal,
      };
    });

    if (rows.length > 0) {
      const { error: questionsError } = await supabase.from("questions").insert(rows);
      if (questionsError) {
        console.error("questions insert error:", questionsError);
        await supabase.from("pdf_uploads").delete().eq("id", uploadId);
        return NextResponse.json(
          { error: "Failed to save questions." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ examId: uploadId });
  } catch (err) {
    console.error("Upload analyze error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed." },
      { status: 500 }
    );
  }
}
