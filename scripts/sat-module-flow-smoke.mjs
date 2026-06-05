/**
 * SAT module flow smoke checks against live Supabase data.
 * Run: node --env-file=.env scripts/sat-module-flow-smoke.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SAT_MODULES = [
  { id: "rw1", section: "rw", module: 1, shortLabel: "R&W M1" },
  { id: "rw2", section: "rw", module: 2, shortLabel: "R&W M2" },
  { id: "math1", section: "math", module: 1, shortLabel: "Math M1" },
  { id: "math2", section: "math", module: 2, shortLabel: "Math M2" },
];

const MIN = { rw1: 20, rw2: 20, math1: 18, math2: 18 };

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function buildModuleReport(questions) {
  const report = {
    rw1: 0,
    rw2: 0,
    rw2Easy: 0,
    rw2Hard: 0,
    math1: 0,
    math2: 0,
    math2Easy: 0,
    math2Hard: 0,
  };
  for (const q of questions) {
    const section = q.sat_section;
    const module = q.sat_module;
    const variant = q.sat_module_variant;
    if (section === "rw" && module === 1) report.rw1++;
    else if (section === "rw" && module === 2 && variant === "easy") report.rw2Easy++;
    else if (section === "rw" && module === 2 && variant === "hard") report.rw2Hard++;
    else if (section === "rw" && module === 2) report.rw2++;
    else if (section === "math" && module === 1) report.math1++;
    else if (section === "math" && module === 2 && variant === "easy") report.math2Easy++;
    else if (section === "math" && module === 2 && variant === "hard") report.math2Hard++;
    else if (section === "math" && module === 2) report.math2++;
  }
  return report;
}

function formatReport(report) {
  return [
    `R&W M1=${report.rw1}`,
    `R&W M2=${report.rw2}`,
    `R&W M2-Easy=${report.rw2Easy}`,
    `R&W M2-Hard=${report.rw2Hard}`,
    `Math M1=${report.math1}`,
    `Math M2=${report.math2}`,
    `Math M2-Easy=${report.math2Easy}`,
    `Math M2-Hard=${report.math2Hard}`,
  ].join(", ");
}

function validateReport(report, adaptiveMode) {
  if (adaptiveMode === "six_module") {
    const issues = [];
    if (report.rw1 < MIN.rw1) issues.push(`R&W M1 (${report.rw1})`);
    if (report.rw2Easy + report.rw2Hard < MIN.rw2) {
      issues.push(`R&W M2 adaptive (${report.rw2Easy + report.rw2Hard})`);
    }
    if (report.math1 < MIN.math1) issues.push(`Math M1 (${report.math1})`);
    if (report.math2Easy + report.math2Hard < MIN.math2) {
      issues.push(`Math M2 adaptive (${report.math2Easy + report.math2Hard})`);
    }
    return { ok: issues.length === 0, issues };
  }
  const issues = [];
  for (const mod of SAT_MODULES) {
    if ((report[mod.id] ?? 0) < MIN[mod.id]) {
      issues.push(`${mod.shortLabel} (${report[mod.id] ?? 0})`);
    }
  }
  return { ok: issues.length === 0, issues };
}

function availableModules(questions) {
  return SAT_MODULES.filter((mod) =>
    questions.some((q) => q.sat_section === mod.section && q.sat_module === mod.module)
  );
}

let failed = 0;

const { data: gridInProbe, error: gridInError } = await supabase
  .from("questions")
  .select("id, correct_answer, question_type")
  .eq("question_type", "grid_in")
  .limit(1);
if (gridInError) {
  console.error("FAIL: could not query grid-in questions:", gridInError.message);
  failed++;
} else if (gridInProbe?.length) {
  const sample = gridInProbe[0];
  const val = String(sample.correct_answer ?? "");
  if (!/^-?[\d./]+$/.test(val)) {
    console.error(`FAIL: grid-in sample has unexpected correct_answer: ${val}`);
    failed++;
  } else {
    console.log(`OK: grid-in rows readable (sample answer "${val}")`);
  }
} else {
  console.log("OK: no grid-in rows yet (constraint applied via migration)");
}

const { data: structureProbe, error: structureError } = await supabase
  .from("pdf_uploads")
  .select("sat_structure_detected")
  .limit(1);
if (structureError && /sat_structure_detected/.test(structureError.message)) {
  console.error("FAIL: sat_structure_detected column missing — apply migration 20260527100000");
  failed++;
} else if (structureError) {
  console.error("FAIL: could not probe pdf_uploads:", structureError.message);
  failed++;
} else {
  console.log("OK: sat_structure_detected column present");
}

const { data: uploads, error: uploadsError } = await supabase
  .from("pdf_uploads")
  .select("id, subject, sat_format, sat_adaptive_mode")
  .or("exam_program.eq.SAT,subject.like.SAT_%")
  .eq("sat_format", "full_test")
  .order("created_at", { ascending: false })
  .limit(5);

if (uploadsError) {
  console.error("FAIL: could not list SAT uploads:", uploadsError.message);
  process.exit(1);
}

if (!uploads?.length) {
  console.log("SKIP: no SAT full_test uploads in database to validate navigation");
} else {
  for (const upload of uploads) {
    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("sat_section, sat_module, sat_module_variant")
      .eq("upload_id", upload.id);
    if (qError) {
      console.error(`FAIL: questions for ${upload.id}:`, qError.message);
      failed++;
      continue;
    }
    const report = buildModuleReport(questions ?? []);
    const adaptiveMode = upload.sat_adaptive_mode ?? "none";
    const validation = validateReport(report, adaptiveMode);
    const modules = availableModules(questions ?? []);
    const navPath = modules.map((m) => m.shortLabel).join(" → ");

    console.log(`\nUpload ${upload.id.slice(0, 8)}… (${upload.subject}, mode=${adaptiveMode})`);
    console.log(`  Report: ${formatReport(report)}`);
    console.log(`  Available modules: ${navPath || "(none)"}`);

    if ((questions ?? []).length === 0) {
      console.error("  FAIL: upload has zero questions");
      failed++;
      continue;
    }

    if (modules.length === 0) {
      console.error("  FAIL: no navigable modules");
      failed++;
      continue;
    }

    if (validation.ok) {
      console.log(`  OK: module report passes ${adaptiveMode} validation`);
    } else {
      console.log(`  WARN: incomplete for ${adaptiveMode}: ${validation.issues.join(", ")}`);
    }

    for (let i = 0; i < modules.length - 1; i++) {
      const next = modules[i + 1];
      const nextCount =
        adaptiveMode === "six_module" && next.module === 2
          ? report[`${next.section}2Easy`] + report[`${next.section}2Hard`]
          : report[next.id];
      if (nextCount === 0) {
        console.error(`  FAIL: next module ${next.shortLabel} is empty but listed as available`);
        failed++;
      }
    }
  }
}

console.log(failed === 0 ? "\nSmoke test passed." : `\nSmoke test failed (${failed} issue(s)).`);
process.exit(failed === 0 ? 0 : 1);
