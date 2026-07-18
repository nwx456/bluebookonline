import { createServerSupabaseAdmin } from "@/lib/supabase/server";

export type ReportResolvedNotificationParams = {
  reporters: string[];
  questionId: string;
  questionNumber: number;
  examName: string;
  uploadId: string;
};

export async function createReportResolvedNotifications(
  params: ReportResolvedNotificationParams
): Promise<number> {
  const supabase = createServerSupabaseAdmin();
  const uniqueEmails = [...new Set(params.reporters.map((e) => e.trim().toLowerCase()))];
  if (uniqueEmails.length === 0) return 0;

  const shortId = params.questionId.slice(0, 8);
  const title = "Question report update";
  const body = `Question #${params.questionNumber} (ID: ${shortId}) in ${params.examName} has been fixed. Thank you for your feedback!`;

  const rows = uniqueEmails.map((userEmail) => ({
    user_email: userEmail,
    type: "report_resolved",
    title,
    body,
    metadata: {
      questionId: params.questionId,
      uploadId: params.uploadId,
      questionNumber: params.questionNumber,
      examName: params.examName,
    },
  }));

  const { error } = await supabase.from("user_notifications").insert(rows);
  if (error) {
    console.error("createReportResolvedNotifications error:", error);
    throw new Error("Failed to create notifications.");
  }

  return rows.length;
}

export async function getUnreadNotificationCount(userEmail: string): Promise<number> {
  const supabase = createServerSupabaseAdmin();
  const { count, error } = await supabase
    .from("user_notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_email", userEmail.trim().toLowerCase())
    .is("read_at", null);

  if (error) {
    console.error("getUnreadNotificationCount error:", error);
    return 0;
  }
  return count ?? 0;
}
