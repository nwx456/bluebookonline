import {
  isSatFullTest,
  isSatMath,
  isSatRw,
  isSatSectionTest,
  SAT_MODULES,
  type SatAdaptiveMode,
  type SatFormat,
  type SatModuleId,
  type SatModuleVariant,
  type SatSection,
} from "@/lib/exam-program";

export interface SatQuestionLike {
  id?: string;
  question_number: number;
  sat_section?: SatSection | null;
  sat_module?: number | null;
  sat_module_variant?: SatModuleVariant | null;
}

export interface SatModuleGroup {
  id: string;
  label: string;
  shortLabel: string;
  questions: SatQuestionLike[];
}

function sortByQuestionNumber(a: SatQuestionLike, b: SatQuestionLike): number {
  return a.question_number - b.question_number || (a.id ?? "").localeCompare(b.id ?? "");
}

export function sameSatModuleBucket(a: SatQuestionLike, b: SatQuestionLike): boolean {
  if (a.sat_section !== b.sat_section) return false;
  if (a.sat_module !== b.sat_module) return false;
  if (a.sat_module === 2) {
    return (a.sat_module_variant ?? null) === (b.sat_module_variant ?? null);
  }
  return true;
}

/** 1-based display number within the question's SAT module bucket (UI only). */
export function getModuleDisplayNumber(
  questions: SatQuestionLike[],
  q: SatQuestionLike
): number {
  const peers = questions.filter((p) => sameSatModuleBucket(p, q)).sort(sortByQuestionNumber);
  const idx = peers.findIndex(
    (p) =>
      p.question_number === q.question_number &&
      (p.id == null || q.id == null || p.id === q.id)
  );
  if (idx >= 0) return idx + 1;
  const fallback = peers.findIndex((p) => p.question_number === q.question_number);
  return fallback >= 0 ? fallback + 1 : q.question_number;
}

function groupLabel(
  section: SatSection,
  module: number,
  variant: SatModuleVariant | null,
  hasVariants: boolean
): { label: string; shortLabel: string; id: string } {
  const base = SAT_MODULES.find((m) => m.section === section && m.module === module);
  if (module === 2 && hasVariants && variant) {
    const vLabel = variant === "easy" ? "Easy" : "Hard";
    return {
      id: `${section}${module}-${variant}`,
      label: `${base?.label ?? section} (${vLabel})`,
      shortLabel: `${base?.shortLabel ?? section} ${vLabel}`,
    };
  }
  return {
    id: `${section}${module}`,
    label: base?.label ?? `${section} M${module}`,
    shortLabel: base?.shortLabel ?? `${section} M${module}`,
  };
}

export interface SatModuleGroupOptions {
  satFormat?: SatFormat | string | null;
  satAdaptiveMode?: SatAdaptiveMode | string | null;
}

function buildModuleBucketGroups(
  satQs: SatQuestionLike[],
  sectionFilter?: SatSection | null
): SatModuleGroup[] {
  const hasVariants = satQs.some((q) => q.sat_module === 2 && q.sat_module_variant);
  const buckets: Array<{
    section: SatSection;
    module: 1 | 2;
    variant: SatModuleVariant | null;
  }> = [];

  for (const mod of SAT_MODULES) {
    if (sectionFilter && mod.section !== sectionFilter) continue;
    if (mod.module === 2 && hasVariants) {
      buckets.push({ section: mod.section, module: 2, variant: "easy" });
      buckets.push({ section: mod.section, module: 2, variant: "hard" });
    } else {
      buckets.push({ section: mod.section, module: mod.module, variant: null });
    }
  }

  const groups: SatModuleGroup[] = [];
  for (const b of buckets) {
    const inBucket = satQs
      .filter(
        (q) =>
          q.sat_section === b.section &&
          q.sat_module === b.module &&
          (b.module === 2 && hasVariants
            ? q.sat_module_variant === b.variant
            : !q.sat_module_variant || !hasVariants)
      )
      .sort(sortByQuestionNumber);
    if (!inBucket.length) continue;
    const meta = groupLabel(b.section, b.module, b.variant, hasVariants);
    groups.push({
      id: meta.id,
      label: meta.label,
      shortLabel: meta.shortLabel,
      questions: inBucket,
    });
  }
  return groups;
}

/**
 * Group SAT questions for results accordion (Full Test modules or single RW/Math upload).
 */
export function getSatModuleGroups(
  questions: SatQuestionLike[],
  subject: string | null | undefined,
  opts?: SatModuleGroupOptions
): SatModuleGroup[] {
  const satQs = questions.filter((q) => q.sat_section && q.sat_module);
  if (!satQs.length) return [];

  const hasVariants = satQs.some((q) => q.sat_module === 2 && q.sat_module_variant);
  const usesSectionModules =
    isSatSectionTest(subject, opts?.satFormat) &&
    (opts?.satAdaptiveMode === "six_module" || hasVariants);

  if (isSatFullTest(subject)) {
    return buildModuleBucketGroups(satQs);
  }

  if (isSatRw(subject) && usesSectionModules) {
    return buildModuleBucketGroups(satQs, "rw");
  }

  if (isSatMath(subject) && usesSectionModules) {
    return buildModuleBucketGroups(satQs, "math");
  }

  if (isSatRw(subject) && isSatSectionTest(subject, opts?.satFormat)) {
    return buildModuleBucketGroups(satQs, "rw");
  }

  if (isSatMath(subject) && isSatSectionTest(subject, opts?.satFormat)) {
    return buildModuleBucketGroups(satQs, "math");
  }

  if (isSatRw(subject)) {
    return [
      {
        id: "rw-single",
        label: "Reading & Writing",
        shortLabel: "R&W",
        questions: satQs.sort(sortByQuestionNumber),
      },
    ];
  }

  if (isSatMath(subject)) {
    return [
      {
        id: "math-single",
        label: "Math",
        shortLabel: "Math",
        questions: satQs.sort(sortByQuestionNumber),
      },
    ];
  }

  return [
    {
      id: "sat-all",
      label: "All questions",
      shortLabel: "SAT",
      questions: satQs.sort(sortByQuestionNumber),
    },
  ];
}

export function findQuestionInGroups(
  groups: SatModuleGroup[],
  questionNumber: number
): { group: SatModuleGroup; question: SatQuestionLike; displayNumber: number } | null {
  for (const group of groups) {
    const q = group.questions.find((qq) => qq.question_number === questionNumber);
    if (q) {
      return {
        group,
        question: q,
        displayNumber: getModuleDisplayNumber(group.questions, q),
      };
    }
  }
  return null;
}

export function satModuleIdFromQuestion(q: SatQuestionLike): SatModuleId | null {
  if (!q.sat_section || !q.sat_module) return null;
  return `${q.sat_section === "rw" ? "rw" : "math"}${q.sat_module}` as SatModuleId;
}
