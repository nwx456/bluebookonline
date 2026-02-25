/**
 * One-time script to clear all files from exam-graphs bucket.
 * Run: node --env-file=.env.local scripts/clear-exam-graphs.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const GRAPHS_BUCKET = "exam-graphs";

const { data: uploads } = await supabase.from("pdf_uploads").select("id");
const uploadIds = (uploads ?? []).map((u) => u.id);
let removed = 0;

for (const uploadId of uploadIds) {
  const { data: files } = await supabase.storage.from(GRAPHS_BUCKET).list(uploadId);
  if (files?.length) {
    const paths = files.map((f) => `${uploadId}/${f.name}`);
    await supabase.storage.from(GRAPHS_BUCKET).remove(paths);
    removed += paths.length;
  }
}

console.log(`Removed ${removed} graph file(s) from exam-graphs bucket.`);
