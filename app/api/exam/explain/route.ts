import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey?.trim()) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not set." },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const questionText = (body.questionText ?? body.question_text ?? "") as string;
    const passageText = (body.passageText ?? body.passage_text ?? "") as string;
    const options = (body.options ?? []) as string[];
    const correctAnswer = (body.correctAnswer ?? body.correct_answer ?? "A") as string;
    const subject = (body.subject ?? "AP_PSYCHOLOGY") as string;

    if (!questionText?.trim()) {
      return NextResponse.json(
        { error: "questionText is required." },
        { status: 400 }
      );
    }

    const optsText = options
      .map((o: string, i: number) => `${["A", "B", "C", "D", "E"][i] ?? i + 1}. ${o}`)
      .join("\n");

    const passageBlock = passageText?.trim()
      ? `\nReference material (code, graph, or passage):\n${passageText.trim()}\n`
      : "";

    const prompt = `You are an expert tutor. Explain concisely why the correct answer is ${correctAnswer} for this multiple-choice question. Be clear and educational. Write 2-4 short paragraphs.

Question: ${questionText.trim()}
${passageBlock}
Options:
${optsText}

Explain why ${correctAnswer} is correct:`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const result = await model.generateContent(prompt);
    const text = result.response.text()?.trim() ?? "";

    return NextResponse.json({ explanation: text || "No explanation available." });
  } catch (err) {
    console.error("exam explain error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate explanation." },
      { status: 500 }
    );
  }
}
