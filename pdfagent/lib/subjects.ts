/**
 * Ana sitenin desteklediği subject anahtarları (lib/gemini-prompts.ts ile uyumlu).
 * Bu liste pdfagent'ın UI'ında dropdown olarak kullanılır.
 */
export const MAIN_APP_SUBJECT_KEYS = [
  "AP_BIOLOGY",
  "AP_CALCULUS_AB",
  "AP_CALCULUS_BC",
  "AP_CHEMISTRY",
  "AP_CSA",
  "AP_CSP",
  "AP_ENGLISH_LANGUAGE",
  "AP_ENGLISH_LITERATURE",
  "AP_ENVIRONMENTAL_SCIENCE",
  "AP_HUMAN_GEOGRAPHY",
  "AP_MACROECONOMICS",
  "AP_MICROECONOMICS",
  "AP_PHYSICS_1",
  "AP_PHYSICS_2",
  "AP_PHYSICS_C_E_M",
  "AP_PHYSICS_C_MECHANICS",
  "AP_PSYCHOLOGY",
  "AP_STATISTICS",
  "AP_US_GOVERNMENT",
  "AP_US_HISTORY",
  "AP_WORLD_HISTORY",
] as const;

export type MainAppSubjectKey = (typeof MAIN_APP_SUBJECT_KEYS)[number];

export function isValidSubject(s: string): s is MainAppSubjectKey {
  return (MAIN_APP_SUBJECT_KEYS as readonly string[]).includes(s);
}
