import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getCurrentSession } from "@/lib/auth";
import { query } from "@/lib/db";
import SourcesClient from "./SourcesClient";

interface SourceRow {
  id: string;
  domain: string;
  name: string;
  seed_urls: string[];
  enabled: boolean;
  default_subject: string | null;
  last_crawled_at: string | null;
}

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login");

  const { rows } = await query<SourceRow>(
    `SELECT id, domain, name, seed_urls, enabled, default_subject, last_crawled_at
       FROM sources
       ORDER BY created_at DESC`
  );

  return (
    <Shell email={session.email}>
      <SourcesClient initialSources={rows} />
    </Shell>
  );
}
