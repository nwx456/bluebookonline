import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSystemPrompt, SUBJECT_KEYS, type SubjectKey } from "@/lib/gemini-prompts";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";

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
  page_number?: number | null;
  options?: string[];
  correct?: string;
}

function parseJsonFromResponse(raw: string): GeminiQuestion[] {
  let text = raw.trim();
  const codeBlock = /^```(?:json)?\s*([\s\S]*?)```\s*$/m;
  const match = text.match(codeBlock);
  if (match) text = match[1].trim();
  const parsed = JSON.parse(text) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed as GeminiQuestion[];
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

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not set. Add it to .env for PDF analysis." },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const subjectRaw = formData.get("subject") as string | null;
    const questionCountRaw = formData.get("questionCount") as string | null;
    const userEmail = (formData.get("userEmail") as string | null)?.trim();

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

    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString("base64");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: getSystemPrompt(subject as SubjectKey),
    });

    const userPrompt = `Analyze the attached PDF and extract exactly up to ${questionCount} multiple-choice questions. Extract only multiple-choice questions (MSQ). Do not include free-response questions (FRQ) or content from FRQ sections. Return ONLY a JSON array of objects. Each object must have: "type" ("code" | "image" | "text"), "content" (question text or code), "image_description" (SVG/table or null), "options" (array of option texts in order A, B, C, D [and E if present]), "correct" (letter A/B/C/D/E). For each question, the "content" (or "question" for code-type) must contain the full question stem—the sentence that asks the question before the choices. If the stem is not clearly separate in the PDF, infer a short stem from the options (e.g. "Which of the following is correct?"). Do not leave content or question empty. For CSA (code-type): Put ONLY the reference class/code block in "code". Put ONLY the multiple-choice question sentence(s) in "question". Do not repeat the class code in "question". In "options", preserve newlines (\\n) when the option is a code snippet. For Micro/Macro economics: include "page_number" (1-based) for each question—the PDF page where the question or its graph appears. Do not include any markdown or explanation, only the JSON array.`;

    const result = await model.generateContent([
      { text: userPrompt },
      {
        inlineData: {
          data: base64,
          mimeType: "application/pdf",
        },
      },
    ]);

    const response = result.response;
    const text = response.text();
    if (!text) {
      return NextResponse.json(
        { error: "Gemini returned no content. The PDF may be unreadable or empty." },
        { status: 502 }
      );
    }

    let questions: GeminiQuestion[];
    try {
      questions = parseJsonFromResponse(text);
    } catch {
      return NextResponse.json(
        { error: "Failed to parse Gemini response as JSON. Try again or use a simpler PDF." },
        { status: 502 }
      );
    }

    const supabase = createServerSupabaseAdmin();

    const { data: uploadRow, error: uploadError } = await supabase
      .from("pdf_uploads")
      .insert({
        user_email: userEmail,
        filename: file.name,
        storage_path: `pending/${file.name}`,
        subject,
        original_text: text.slice(0, 50_000),
      })
      .select("id")
      .single();

    if (uploadError || !uploadRow?.id) {
      console.error("pdf_uploads insert error:", uploadError);
      return NextResponse.json(
        { error: "Failed to save upload record." },
        { status: 500 }
      );
    }

    const uploadId = uploadRow.id;

    // Store PDF in Storage for exam page rendering (Macro/Micro graph = exact page image)
    const bucket = "exam-pdfs";
    const storageKey = `${uploadId}.pdf`;
    try {
      const { error: storageError } = await supabase.storage
        .from(bucket)
        .upload(storageKey, buffer, { contentType: "application/pdf", upsert: true });
      if (!storageError) {
        await supabase
          .from("pdf_uploads")
          .update({ storage_path: storageKey })
          .eq("id", uploadId);
      }
    } catch {
      // non-fatal; exam still works with passage_text/SVG
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
        passageText = codeOnly;
        if (strippedQuestion && (!questionText || questionText === "No question text.")) {
          questionText = strippedQuestion;
        }
      } else {
        passageText = (q.image_description ?? q.content)?.trim() || null;
      }

      if (isPlaceholderText(questionText)) questionText = "No question text.";
      if (passageText != null && isPlaceholderText(passageText)) passageText = null;

      const hasAnyOption = [opts.option_a, opts.option_b, opts.option_c, opts.option_d, opts.option_e].some(
        (o) => o != null && o.trim() !== ""
      );
      if (questionText === "No question text." && hasAnyOption) {
        questionText = "Which of the following is correct?";
      }

      const pageNum =
        q.page_number != null && Number.isInteger(Number(q.page_number))
          ? Number(q.page_number)
          : null;

      return {
        upload_id: uploadId,
        question_number: i + 1,
        question_text: questionText,
        passage_text: passageText,
        option_a: opts.option_a,
        option_b: opts.option_b,
        option_c: opts.option_c,
        option_d: opts.option_d,
        option_e: opts.option_e,
        correct_answer: correct,
        image_url: null,
        page_number: pageNum,
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
