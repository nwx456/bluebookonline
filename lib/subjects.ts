/**
 * Lightweight subject keys and labels shared by client and server code.
 * Keep prompt strings in gemini-prompts.ts — import from here in client bundles.
 */

export const SUBJECT_KEYS = [
  "AP_CSA",
  "AP_CSP",
  "AP_MICROECONOMICS",
  "AP_MACROECONOMICS",
  "AP_PSYCHOLOGY",
  "AP_STATISTICS",
  "AP_BIOLOGY",
  "AP_CHEMISTRY",
  "AP_PHYSICS_1",
  "AP_PHYSICS_2",
  "AP_PHYSICS_C_MECH",
  "AP_PHYSICS_C_EM",
  "AP_ENVIRONMENTAL_SCIENCE",
  "AP_HUMAN_GEOGRAPHY",
  "AP_ENGLISH_LANG",
  "AP_ENGLISH_LIT",
  "AP_US_HISTORY",
  "AP_WORLD_HISTORY",
  "AP_EUROPEAN_HISTORY",
  "AP_US_GOVERNMENT",
  "AP_COMPARATIVE_GOVERNMENT",
  "AP_CALCULUS_AB",
  "AP_CALCULUS_BC",
  "AP_PRECALCULUS",
  "SAT_RW",
  "SAT_MATH",
  "SAT_FULL_TEST",
] as const;

export type SubjectKey = (typeof SUBJECT_KEYS)[number];

/** Default hasVisuals for each subject (code=skip, visual=true, text=false) */
export const SUBJECT_DEFAULT_HAS_VISUALS: Record<SubjectKey, boolean | "code"> = {
  AP_CSA: "code",
  AP_CSP: "code",
  AP_MICROECONOMICS: true,
  AP_MACROECONOMICS: true,
  AP_PSYCHOLOGY: false,
  AP_STATISTICS: true,
  AP_BIOLOGY: true,
  AP_CHEMISTRY: true,
  AP_PHYSICS_1: true,
  AP_PHYSICS_2: true,
  AP_PHYSICS_C_MECH: true,
  AP_PHYSICS_C_EM: true,
  AP_ENVIRONMENTAL_SCIENCE: true,
  AP_HUMAN_GEOGRAPHY: true,
  AP_ENGLISH_LANG: false,
  AP_ENGLISH_LIT: false,
  AP_US_HISTORY: false,
  AP_WORLD_HISTORY: false,
  AP_EUROPEAN_HISTORY: false,
  AP_US_GOVERNMENT: false,
  AP_COMPARATIVE_GOVERNMENT: false,
  AP_CALCULUS_AB: false,
  AP_CALCULUS_BC: false,
  AP_PRECALCULUS: false,
  SAT_RW: false,
  SAT_MATH: true,
  SAT_FULL_TEST: true,
};

export const SUBJECT_LABELS: Record<SubjectKey, string> = {
  AP_CSA: "AP CSA (Computer Science)",
  AP_CSP: "AP Computer Science Principles",
  AP_MICROECONOMICS: "AP Microeconomics",
  AP_MACROECONOMICS: "AP Macroeconomics",
  AP_PSYCHOLOGY: "AP Psychology",
  AP_STATISTICS: "AP Statistics",
  AP_BIOLOGY: "AP Biology",
  AP_CHEMISTRY: "AP Chemistry",
  AP_PHYSICS_1: "AP Physics 1",
  AP_PHYSICS_2: "AP Physics 2",
  AP_PHYSICS_C_MECH: "AP Physics C: Mechanics",
  AP_PHYSICS_C_EM: "AP Physics C: E&M",
  AP_ENVIRONMENTAL_SCIENCE: "AP Environmental Science",
  AP_HUMAN_GEOGRAPHY: "AP Human Geography",
  AP_ENGLISH_LANG: "AP English Language",
  AP_ENGLISH_LIT: "AP English Literature",
  AP_US_HISTORY: "AP US History",
  AP_WORLD_HISTORY: "AP World History",
  AP_EUROPEAN_HISTORY: "AP European History",
  AP_US_GOVERNMENT: "AP US Government",
  AP_COMPARATIVE_GOVERNMENT: "AP Comparative Government",
  AP_CALCULUS_AB: "AP Calculus AB",
  AP_CALCULUS_BC: "AP Calculus BC",
  AP_PRECALCULUS: "AP Precalculus",
  SAT_RW: "SAT Reading & Writing",
  SAT_MATH: "SAT Math",
  SAT_FULL_TEST: "SAT Full Test",
};

export function isCodeSubject(subject: SubjectKey): boolean {
  return subject === "AP_CSA" || subject === "AP_CSP";
}

export function isSatSubjectKey(subject: SubjectKey): boolean {
  return subject === "SAT_RW" || subject === "SAT_MATH" || subject === "SAT_FULL_TEST";
}
