export type SatQuestionModuleRow = {
  sat_section?: string | null;
  sat_module?: number | null;
  sat_module_variant?: string | null;
};

/** Effective question count for SAT six_module adaptive exams (M1 + one M2 path per section). */
export function computeSatSixModuleEffectiveCount(rows: SatQuestionModuleRow[]): number {
  if (rows.length === 0) return 0;
  let total = 0;
  for (const section of ["rw", "math"] as const) {
    const sectionRows = rows.filter((r) => r.sat_section === section);
    if (sectionRows.length === 0) continue;
    const m1 = sectionRows.filter((r) => r.sat_module !== 2).length;
    const m2easy = sectionRows.filter(
      (r) => r.sat_module === 2 && r.sat_module_variant === "easy"
    ).length;
    const m2hard = sectionRows.filter(
      (r) => r.sat_module === 2 && r.sat_module_variant === "hard"
    ).length;
    const m2plain = sectionRows.filter(
      (r) => r.sat_module === 2 && !r.sat_module_variant
    ).length;
    total += m1 + Math.max(m2plain, m2easy, m2hard);
  }
  return total > 0 ? total : rows.length;
}
