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
  image_description?: string | null;
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

    const userPrompt = `Analyze the attached PDF and extract exactly up to ${questionCount} multiple-choice questions. Return ONLY a JSON array of objects. Each object must have: "type" ("code" | "image" | "text"), "content" (question text or code), "image_description" (SVG/table or null), "options" (array of option texts in order A, B, C, D [and E if present]), "correct" (letter A/B/C/D/E). Do not include any markdown or explanation, only the JSON array.`;

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
    const rows = questions.slice(0, questionCount).map((q, i) => {
      const opts = optionsToColumns(q.options);
      const correct = normalizeCorrect(q.correct);
      const questionText = (q.content ?? "").trim() || "No question text.";
      const passageText =
        (q.type === "code" ? q.content : q.image_description ?? q.content)?.trim() || null;

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
