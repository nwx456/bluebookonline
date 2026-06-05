import type { SubjectKey } from "@/lib/gemini-prompts";
import { SUBJECT_LABELS } from "@/lib/gemini-prompts";
import {
  isSatFullTest,
  isSatMath,
  isSatRw,
  type SatModuleDef,
  type SatModuleId,
} from "@/lib/exam-program";

/** Bluebook-style exam shell tokens (active attempt UI only). */
export const examUi = {
  headerBg: "bg-[#f2f5f9]",
  footerBg: "bg-[#f2f5f9]",
  contentBg: "bg-white",
  chromeBorderBottom: "border-b border-[#e2e8f0]",
  chromeBorderTop: "border-t border-[#e2e8f0]",
  nextBlue: "bg-[#2563eb] hover:bg-[#1d4ed8]",
  backGray: "bg-[#36454F] hover:bg-[#2d3748]",
  footerNavPill:
    "rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-300",
  questionBadge: "bg-black text-white",
  hideTimerPill: "rounded-full border border-gray-900 px-3 py-0.5 text-sm text-gray-900",
  optionBorder: "border border-gray-300",
  optionSelected: "border-2 border-[#3b5ce8] bg-[#3b5ce8]/12",
  optionLetterSelected: "border-[#3b5ce8] bg-[#3b5ce8] text-white",
  questionGridCurrent: "bg-[#3b5ce8] text-white",
  eliminateCircle: "h-8 w-8 rounded-full border border-gray-400 flex items-center justify-center text-sm font-semibold text-gray-700",
  eliminateCircleActive: "bg-gray-100 text-gray-500 line-through",
  abcToolDecor: "flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-blue-600 text-[10px] font-bold leading-none text-white",
} as const;

export const examContentSerifClass =
  "[font-family:var(--font-exam-serif),ui-serif,Georgia,serif]";

const SAT_HEADER_BY_MODULE: Record<SatModuleId, string> = {
  rw1: "Section 1, Module 1: Reading and Writing",
  rw2: "Section 1, Module 2: Reading and Writing",
  math1: "Section 2, Module 1: Math",
  math2: "Section 2, Module 2: Math",
};

export function formatExamHeaderTitle(
  isSat: boolean,
  subject: SubjectKey,
  currentModuleDef: SatModuleDef | null,
  currentModuleId: SatModuleId | null
): string {
  if (!isSat) {
    return SUBJECT_LABELS[subject] ?? subject;
  }
  if (currentModuleId && SAT_HEADER_BY_MODULE[currentModuleId]) {
    return SAT_HEADER_BY_MODULE[currentModuleId];
  }
  if (currentModuleDef?.label) {
    const id = currentModuleDef.id as SatModuleId;
    if (SAT_HEADER_BY_MODULE[id]) return SAT_HEADER_BY_MODULE[id];
    return currentModuleDef.label;
  }
  if (isSatFullTest(subject)) return "SAT Full Test";
  if (isSatRw(subject)) return SAT_HEADER_BY_MODULE.rw1;
  if (isSatMath(subject)) return SAT_HEADER_BY_MODULE.math1;
  return "SAT Practice";
}

export function formatDisplayUsername(username: string, email: string): string {
  const u = username.trim();
  if (u) return u;
  const e = email.trim();
  if (!e) return "User";
  const at = e.indexOf("@");
  return at > 0 ? e.slice(0, at) : e;
}
