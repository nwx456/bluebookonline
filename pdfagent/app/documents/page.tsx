import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import DocumentsClient from "./DocumentsClient";

interface DocRow {
  id: string;
  source_url: string;
  sha256: string | null;
  size_bytes: string | null;
  status: string;
  reject_reason: string | null;
  subject: string | null;
  question_count: number;
  has_visuals: boolean;
  exam_id: string | null;
  discovered_at: string;
  uploaded_at: string | null;
}

export const dynamic = "force-dynamic";

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const sp = await searchParams;
  const filter = sp.status?.trim();

  const where = filter ? `WHERE status = $1` : "";
  const params = filter ? [filter] : [];
  const { rows } = await query<DocRow>(
    `SELECT id, source_url, sha256, size_bytes::text, status, reject_reason,
            subject, question_count, has_visuals, exam_id, discovered_at, uploaded_at
       FROM documents ${where}
       ORDER BY discovered_at DESC
       LIMIT 200`,
    params
  );

  return (
    <Shell email={session.email}>
      <DocumentsClient initialDocs={rows} initialFilter={filter ?? ""} />
    </Shell>
  );
}
