/**
 * Lokal end-to-end smoke test.
 *
 * Önkoşullar:
 *  - docker compose up -d (postgres + redis ayakta)
 *  - npm run migrate
 *  - npm run seed:admin
 *  - npm run worker (ayrı terminalde)
 *  - Ana site (bluebookonline) :3000'de çalışıyor
 *  - Ana sitede MAIN_APP_BOT_EMAIL hesabı kayıtlı (usertable'da var)
 *
 * Kullanım:
 *   tsx scripts/smoke-test.ts <pdf_url> <subject>
 * Örn:
 *   tsx scripts/smoke-test.ts https://openstax.org/.../book.pdf AP_PSYCHOLOGY
 */
import { Pool } from "pg";

async function main() {
  const url = process.argv[2];
  const subject = process.argv[3] ?? "AP_PSYCHOLOGY";
  if (!url) {
    console.error("usage: tsx scripts/smoke-test.ts <pdf_url> [subject]");
    process.exit(1);
  }
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL not set");

  const pool = new Pool({ connectionString: dbUrl });
  try {
    const insert = await pool.query<{ id: string }>(
      `INSERT INTO documents (source_url, status, subject, question_count, has_visuals)
       VALUES ($1, 'discovered', $2, 20, FALSE)
       ON CONFLICT (source_url) DO UPDATE SET subject = EXCLUDED.subject
       RETURNING id`,
      [url, subject]
    );
    const id = insert.rows[0].id;
    console.log(`[smoke] inserted document ${id} → run worker, then approve via UI`);

    let lastStatus = "";
    for (let i = 0; i < 60; i++) {
      const { rows } = await pool.query<{ status: string; reject_reason: string | null; exam_id: string | null }>(
        `SELECT status, reject_reason, exam_id FROM documents WHERE id = $1`,
        [id]
      );
      const r = rows[0];
      if (r.status !== lastStatus) {
        lastStatus = r.status;
        console.log(`[smoke] status: ${r.status}${r.reject_reason ? ` (${r.reject_reason})` : ""}${r.exam_id ? ` examId=${r.exam_id}` : ""}`);
      }
      if (r.status === "uploaded" || r.status === "rejected" || r.status === "failed") break;
      await new Promise((res) => setTimeout(res, 5000));
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
