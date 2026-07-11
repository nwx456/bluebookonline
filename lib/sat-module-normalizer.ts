import type {
  SatModuleBucket,
  SatModuleVariant,
  SatSection,
} from "@/lib/exam-program";

export type { SatModuleBucket };

/** Strip diacritics and normalize whitespace for cross-language label matching. */
export function normalizeLabelForMatch(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function includesHint(normalized: string, hint: string): boolean {
  return normalized.includes(normalizeLabelForMatch(hint));
}

const M1_LABELS_EN = [
  "Module 1",
  "Module One",
  "Mod 1",
  "Part 1",
  "Part I",
  "Form 1",
  "Section 1 Module 1",
  "first module",
  "Module I",
];

const M1_LABELS_TR = ["Modül 1", "Bölüm 1", "Kısım 1", "Form 1"];

const M1_LABELS_ES = ["Módulo 1", "Parte 1", "Sección 1", "Seccion 1"];

const M1_LABELS_DE = ["Modul 1", "Teil 1", "Abschnitt 1"];

const M1_LABELS_FR = ["Module 1", "Partie 1", "Section 1"];

const M1_LABELS_PT = ["Módulo 1", "Parte 1"];

const M1_LABELS_AR = ["وحدة 1", "الوحدة 1", "Module 1"];

const M1_LABELS_ZH = ["模块 1", "模块一", "第1模块", "第 1 模块"];

const M1_LABELS = [
  ...M1_LABELS_EN,
  ...M1_LABELS_TR,
  ...M1_LABELS_ES,
  ...M1_LABELS_DE,
  ...M1_LABELS_FR,
  ...M1_LABELS_PT,
  ...M1_LABELS_AR,
  ...M1_LABELS_ZH,
];

const M2_SINGLE_LABELS_EN = [
  "Module 2",
  "Module Two",
  "Mod 2",
  "Part 2",
  "Part II",
  "Form 2",
  "Section 1 Module 2",
  "Section 2 Module 2",
  "second module",
  "Module II",
];

const M2_SINGLE_LABELS_TR = ["Modül 2", "Bölüm 2", "Kısım 2"];

const M2_SINGLE_LABELS_ES = ["Módulo 2", "Parte 2", "Sección 2", "Seccion 2"];

const M2_SINGLE_LABELS_DE = ["Modul 2", "Teil 2", "Abschnitt 2"];

const M2_SINGLE_LABELS_FR = ["Module 2", "Partie 2", "Section 2"];

const M2_SINGLE_LABELS_PT = ["Módulo 2", "Parte 2"];

const M2_SINGLE_LABELS_AR = ["وحدة 2", "الوحدة 2", "Module 2"];

const M2_SINGLE_LABELS_ZH = ["模块 2", "模块二", "第2模块", "第 2 模块"];

const M2_SINGLE_LABELS = [
  ...M2_SINGLE_LABELS_EN,
  ...M2_SINGLE_LABELS_TR,
  ...M2_SINGLE_LABELS_ES,
  ...M2_SINGLE_LABELS_DE,
  ...M2_SINGLE_LABELS_FR,
  ...M2_SINGLE_LABELS_PT,
  ...M2_SINGLE_LABELS_AR,
  ...M2_SINGLE_LABELS_ZH,
];

const M2_EASY_LABELS_EN = [
  "Module A",
  "Mod A",
  "Route A",
  "Form A",
  "Easy",
  "Below the bar",
  "Lower difficulty",
  "easier module",
  "Module 2 Easy",
  "Module 2 — Easy",
  "M2 Easy",
];

const M2_EASY_LABELS_TR = ["Modül A", "Kolay", "Alt seviye", "Rota A"];

const M2_EASY_LABELS_ES = ["Módulo A", "Fácil", "Facil", "Ruta A"];

const M2_EASY_LABELS_DE = ["Modul A", "Leicht", "Einfach", "Route A"];

const M2_EASY_LABELS_FR = ["Module A", "Module facile", "Facile", "Route A"];

const M2_EASY_LABELS_PT = ["Módulo A", "Fácil", "Facil", "Rota A"];

const M2_EASY_LABELS_AR = ["وحدة أ", "وحدة ا", "سهل", "المسار أ", "المسار ا"];

const M2_EASY_LABELS_ZH = ["模块 A", "模块A", "简单", "较易", "简易"];

const M2_EASY_LABELS = [
  ...M2_EASY_LABELS_EN,
  ...M2_EASY_LABELS_TR,
  ...M2_EASY_LABELS_ES,
  ...M2_EASY_LABELS_DE,
  ...M2_EASY_LABELS_FR,
  ...M2_EASY_LABELS_PT,
  ...M2_EASY_LABELS_AR,
  ...M2_EASY_LABELS_ZH,
];

const M2_HARD_LABELS_EN = [
  "Module B",
  "Mod B",
  "Route B",
  "Form B",
  "Hard",
  "Above the bar",
  "Higher difficulty",
  "harder module",
  "Module 2 Hard",
  "Module 2 — Hard",
  "M2 Hard",
];

const M2_HARD_LABELS_TR = ["Modül B", "Zor", "Üst seviye", "Rota B"];

const M2_HARD_LABELS_ES = ["Módulo B", "Difícil", "Dificil", "Ruta B"];

const M2_HARD_LABELS_DE = ["Modul B", "Schwer", "Schwierig", "Route B"];

const M2_HARD_LABELS_FR = ["Module B", "Module difficile", "Difficile", "Route B"];

const M2_HARD_LABELS_PT = ["Módulo B", "Difícil", "Dificil", "Rota B"];

const M2_HARD_LABELS_AR = ["وحدة ب", "صعب", "المسار ب"];

const M2_HARD_LABELS_ZH = ["模块 B", "模块B", "困难", "较难", "较难模块"];

const M2_HARD_LABELS = [
  ...M2_HARD_LABELS_EN,
  ...M2_HARD_LABELS_TR,
  ...M2_HARD_LABELS_ES,
  ...M2_HARD_LABELS_DE,
  ...M2_HARD_LABELS_FR,
  ...M2_HARD_LABELS_PT,
  ...M2_HARD_LABELS_AR,
  ...M2_HARD_LABELS_ZH,
];

function inferVariantFromNormalized(normalized: string): SatModuleVariant | null {
  if (!normalized) return null;

  for (const hint of M1_LABELS) {
    if (includesHint(normalized, hint)) return null;
  }

  for (const hint of M2_HARD_LABELS) {
    if (includesHint(normalized, hint)) return "hard";
  }
  for (const hint of M2_EASY_LABELS) {
    if (includesHint(normalized, hint)) return "easy";
  }

  if (
    /\b(module|modulo|modul|mod)\s+b\b/.test(normalized) ||
    /\bform\s+b\b/.test(normalized) ||
    /\broute\s+b\b/.test(normalized) ||
    /\bruta\s+b\b/.test(normalized) ||
    /\brota\s+b\b/.test(normalized) ||
    /\bmodule\s+difficile\b/.test(normalized) ||
    /\b模块\s*b\b/.test(normalized)
  ) {
    return "hard";
  }

  if (
    /\b(module|modulo|modul|mod)\s+a\b/.test(normalized) ||
    /\bform\s+a\b/.test(normalized) ||
    /\broute\s+a\b/.test(normalized) ||
    /\bruta\s+a\b/.test(normalized) ||
    /\brota\s+a\b/.test(normalized) ||
    /\bmodule\s+facile\b/.test(normalized) ||
    /\b模块\s*a\b/.test(normalized)
  ) {
    return "easy";
  }

  if (/وحدة\s*ب/.test(normalized) || /المسار\s*ب/.test(normalized)) return "hard";
  if (/وحدة\s*أ/.test(normalized) || /وحدة\s*ا/.test(normalized) || /المسار\s*أ/.test(normalized)) {
    return "easy";
  }

  return null;
}

function inferModuleFromNormalized(normalized: string): 1 | 2 | null {
  if (!normalized) return null;

  for (const hint of M1_LABELS) {
    if (includesHint(normalized, hint)) return 1;
  }

  if (inferVariantFromNormalized(normalized)) return 2;
  for (const hint of M2_SINGLE_LABELS) {
    if (includesHint(normalized, hint)) return 2;
  }

  if (
    /\b(module|modulo|modul|mod)\s+1\b/.test(normalized) ||
    /\bparte?\s+1\b/.test(normalized) ||
    /\bpartie\s+1\b/.test(normalized) ||
    /\bpart\s+1\b/.test(normalized) ||
    /\bform\s+1\b/.test(normalized) ||
    /\bteil\s+1\b/.test(normalized) ||
    /\babschnitt\s+1\b/.test(normalized) ||
    /\bseccion\s+1\b/.test(normalized) ||
    /\bbolum\s+1\b/.test(normalized) ||
    /\b模块\s*1\b/.test(normalized) ||
    /\b模块\s*一\b/.test(normalized) ||
    /第\s*1\s*模块/.test(normalized) ||
    /وحدة\s*1/.test(normalized) ||
    /الوحدة\s*1/.test(normalized)
  ) {
    return 1;
  }

  if (
    /\b(module|modulo|modul|mod)\s+2\b/.test(normalized) ||
    /\bparte?\s+2\b/.test(normalized) ||
    /\bpartie\s+2\b/.test(normalized) ||
    /\bpart\s+2\b/.test(normalized) ||
    /\bform\s+2\b/.test(normalized) ||
    /\bteil\s+2\b/.test(normalized) ||
    /\babschnitt\s+2\b/.test(normalized) ||
    /\bseccion\s+2\b/.test(normalized) ||
    /\bbolum\s+2\b/.test(normalized) ||
    /\b模块\s*2\b/.test(normalized) ||
    /\b模块\s*二\b/.test(normalized) ||
    /第\s*2\s*模块/.test(normalized) ||
    /وحدة\s*2/.test(normalized) ||
    /الوحدة\s*2/.test(normalized)
  ) {
    return 2;
  }

  return null;
}

/** Infer easy/hard from a PDF module header/title string (not MCQ choice letters). */
export function inferVariantFromLabel(label: string): SatModuleVariant | null {
  return inferVariantFromNormalized(normalizeLabelForMatch(label));
}

export function inferModuleNumberFromLabel(label: string): 1 | 2 | null {
  return inferModuleFromNormalized(normalizeLabelForMatch(label));
}

export function bucketKey(bucket: SatModuleBucket): string {
  return `${bucket.section}${bucket.module}${bucket.variant ?? ""}`;
}

export function applyBucketToQuestion<T extends object>(
  q: T,
  bucket: SatModuleBucket
): T & {
  sat_section: SatSection;
  sat_module: 1 | 2;
  sat_module_variant: SatModuleVariant | null;
  sat_pdf_module_label?: string | null;
} {
  const rec = q as {
    sat_pdf_module_label?: unknown;
    pdf_module_label?: unknown;
  };
  const pdfLabel =
    typeof rec.sat_pdf_module_label === "string"
      ? rec.sat_pdf_module_label
      : typeof rec.pdf_module_label === "string"
        ? rec.pdf_module_label
        : bucket.detectedTitle ?? null;

  return {
    ...q,
    sat_section: bucket.section,
    sat_module: bucket.module,
    sat_module_variant: bucket.variant,
    sat_pdf_module_label: pdfLabel,
  };
}
