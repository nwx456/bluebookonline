import {
  isSatFullTest,
  isSatMath,
  isSatRw,
  isSatSectionTest,
  SAT_MODULES,
  satSectionForSubject,
  type SatAdaptiveMode,
  type SatFormat,
  type SatModuleBucket,
} from "@/lib/exam-program";
import { buildSatExtractionPlan } from "@/lib/sat-extraction";
import { bucketKey } from "@/lib/sat-module-normalizer";

export interface SatUploadModuleField {
  key: string;
  label: string;
  shortLabel: string;
  defaultCount: number;
}

function bucketDisplayLabel(bucket: SatModuleBucket): { label: string; shortLabel: string } {
  const base = SAT_MODULES.find((m) => m.section === bucket.section && m.module === bucket.module);
  const baseLabel =
    base?.label ?? `${bucket.section === "rw" ? "Reading & Writing" : "Math"} – Module ${bucket.module}`;
  const short = base?.shortLabel ?? `${bucket.section === "rw" ? "R&W" : "Math"} M${bucket.module}`;
  if (bucket.module === 2 && bucket.variant) {
    const v = bucket.variant === "easy" ? "Easy" : "Hard";
    return {
      label: `${baseLabel} (${v})`,
      shortLabel: `${short} ${v}`,
    };
  }
  return { label: baseLabel, shortLabel: short };
}

function defaultCountForBucket(bucket: SatModuleBucket): number {
  const mod = SAT_MODULES.find((m) => m.section === bucket.section && m.module === bucket.module);
  return mod?.questionCount ?? (bucket.section === "rw" ? 27 : 22);
}

/** Active module count fields for SAT upload UI (matches bucket extraction plan). */
export function getSatUploadModuleFields(opts: {
  subject: string;
  satFormat: SatFormat;
  satAdaptiveMode: SatAdaptiveMode;
}): SatUploadModuleField[] {
  const { subject, satFormat, satAdaptiveMode } = opts;
  const sectionFilter = satSectionForSubject(subject);
  const usesBuckets = isSatFullTest(subject) || isSatSectionTest(subject, satFormat);

  if (usesBuckets) {
    const plan = buildSatExtractionPlan(satAdaptiveMode, sectionFilter);
    return plan.map((bucket) => {
      const { label, shortLabel } = bucketDisplayLabel(bucket);
      return {
        key: bucketKey(bucket),
        label,
        shortLabel,
        defaultCount: bucket.expectedCount ?? defaultCountForBucket(bucket),
      };
    });
  }

  if (isSatRw(subject)) {
    return [
      {
        key: "rw1",
        label: "Reading & Writing",
        shortLabel: "R&W",
        defaultCount: 27,
      },
    ];
  }
  if (isSatMath(subject)) {
    return [
      {
        key: "math1",
        label: "Math",
        shortLabel: "Math",
        defaultCount: 22,
      },
    ];
  }
  return [];
}

export function parseSatModuleQuestionCounts(
  raw: unknown,
  fields: SatUploadModuleField[]
): Record<string, number> | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const field of fields) {
    const v = o[field.key];
    const n =
      typeof v === "number"
        ? v
        : typeof v === "string"
          ? parseInt(v, 10)
          : NaN;
    if (!Number.isInteger(n) || n < 1 || n > 99) return null;
    out[field.key] = n;
  }
  return out;
}

export function sumModuleCounts(counts: Record<string, number>): number {
  return Object.values(counts).reduce((s, n) => s + n, 0);
}

export function defaultSatModuleCounts(fields: SatUploadModuleField[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of fields) out[f.key] = f.defaultCount;
  return out;
}
