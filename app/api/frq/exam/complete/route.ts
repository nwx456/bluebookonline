import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseAdmin } from "@/lib/supabase/server";
import { gradeFrqResponse } from "@/lib/frq-grade";
import { ensureScoringGuidelines } from "@/lib/frq-scoring-guidelines";
import { isFrqCourseId, type FrqCourseId } from "@/lib/frq-courses";
import { getExamMaxScore, normalizeFrqParts, type FrqQuestionRow } from "@/lib/frq-server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const attemptId = (body.attemptId ?? body.attempt_id) as string | undefined;

    if (!attemptId?.trim()) {
      return NextResponse.json({ error: "attemptId is required." }, { status: 400 });
    }

    const supabase = createServerSupabaseAdmin();

    const { data: attempt } = await supabase
      .from("frq_attempts")
      .select("id, frq_upload_id, status, user_email")
      .eq("id", attemptId.trim())
      .single();

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found." }, { status: 404 });
    }

    if (attempt.status === "graded" || attempt.status === "completed") {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    await supabase
      .from("frq_attempts")
      .update({ status: "grading" })
      .eq("id", attemptId.trim());

    const { data: upload } = await supabase
      .from("frq_uploads")
      .select("course_id, max_score, title")
      .eq("id", attempt.frq_upload_id)
      .single();

    if (!upload || !isFrqCourseId(upload.course_id as string)) {
      return NextResponse.json({ error: "Invalid course." }, { status: 400 });
    }

    const courseId = upload.course_id as FrqCourseId;

    const { data: questions } = await supabase
      .from("frq_questions")
      .select("*")
      .eq("frq_upload_id", attempt.frq_upload_id)
      .order("question_number", { ascending: true });

    const { data: responses } = await supabase
      .from("frq_responses")
      .select("*")
      .eq("attempt_id", attemptId.trim());

    let totalScore = 0;
    const gradedResponses: Array<{
      questionId: string;
      partLabel: string;
      score: number;
      maxScore: number;
      feedback: string;
      rubricBreakdown: unknown[];
      strengths: string[];
      improvements: string[];
    }> = [];

    for (const question of questions ?? []) {
      const qRow = question as FrqQuestionRow;
      const guidelines = await ensureScoringGuidelines(supabase, qRow, courseId);
      qRow.scoring_guidelines = guidelines;

      const parts = Array.isArray(qRow.parts) && qRow.parts.length > 0
        ? qRow.parts
        : [{ label: "", prompt: "" }];

      for (const part of parts) {
        const label = part.label ?? "";
        const response = (responses ?? []).find(
          (r) => r.question_id === qRow.id && (r.part_label ?? "") === label
        );

        const result = await gradeFrqResponse({
          courseId,
          question: qRow,
          partLabel: label,
          partPrompt: part.prompt,
          responseText: (response?.response_text as string) ?? "",
        });

        totalScore += result.score;

        if (response) {
          await supabase
            .from("frq_responses")
            .update({
              score: result.score,
              rubric_breakdown: result.rubricBreakdown,
              ai_feedback: result.feedback,
              strengths: result.strengths,
              improvements: result.improvements,
              graded_at: new Date().toISOString(),
            })
            .eq("id", response.id);
        } else {
          await supabase.from("frq_responses").insert({
            attempt_id: attemptId.trim(),
            question_id: qRow.id,
            part_label: label,
            response_text: "",
            score: result.score,
            rubric_breakdown: result.rubricBreakdown,
            ai_feedback: result.feedback,
            strengths: result.strengths,
            improvements: result.improvements,
            graded_at: new Date().toISOString(),
          });
        }

        gradedResponses.push({
          questionId: qRow.id,
          partLabel: label,
          score: result.score,
          maxScore: result.maxScore,
          feedback: result.feedback,
          rubricBreakdown: result.rubricBreakdown,
          strengths: result.strengths,
          improvements: result.improvements,
        });
      }
    }

    const maxScore =
      getExamMaxScore((questions ?? []) as FrqQuestionRow[]) ||
      Number(upload.max_score) ||
      0;
    const now = new Date().toISOString();

    await supabase
      .from("frq_attempts")
      .update({
        status: "graded",
        total_score: totalScore,
        max_score: maxScore,
        completed_at: now,
        graded_at: now,
      })
      .eq("id", attemptId.trim());

    return NextResponse.json({
      ok: true,
      totalScore,
      maxScore,
      responses: gradedResponses,
    });
  } catch (err) {
    console.error("frq complete error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Grading failed." },
      { status: 500 }
    );
  }
}
