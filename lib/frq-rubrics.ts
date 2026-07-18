import type { FrqCourseId } from "./frq-courses";

export interface RubricRow {
  criterion: string;
  maxPoints: number;
  description: string;
}

export interface RubricTemplate {
  id: string;
  name: string;
  rows: RubricRow[];
}

export const RUBRIC_TEMPLATES: Record<string, RubricTemplate> = {
  english_6pt: {
    id: "english_6pt",
    name: "AP English Essay (6-point)",
    rows: [
      { criterion: "Thesis", maxPoints: 1, description: "Responds to the prompt with a defensible thesis that establishes a line of reasoning." },
      { criterion: "Evidence and Commentary", maxPoints: 4, description: "Provides specific evidence and explains how it supports the line of reasoning." },
      { criterion: "Sophistication", maxPoints: 1, description: "Demonstrates sophistication of thought and/or complex understanding." },
    ],
  },
  history_saq: {
    id: "history_saq",
    name: "AP History Short Answer (3-point per part)",
    rows: [
      { criterion: "Part A", maxPoints: 1, description: "Accurately responds to the prompt with relevant historical information." },
      { criterion: "Part B", maxPoints: 1, description: "Accurately responds with relevant historical information or analysis." },
      { criterion: "Part C", maxPoints: 1, description: "Accurately responds with relevant historical information or analysis." },
    ],
  },
  history_dbq: {
    id: "history_dbq",
    name: "AP History DBQ (7-point)",
    rows: [
      { criterion: "Thesis/Claim", maxPoints: 1, description: "Responds to the prompt with a historically defensible thesis." },
      { criterion: "Contextualization", maxPoints: 1, description: "Describes broader historical context relevant to the prompt." },
      { criterion: "Evidence from Documents", maxPoints: 2, description: "Uses content from documents to support an argument." },
      { criterion: "Evidence Beyond Documents", maxPoints: 1, description: "Uses at least one additional piece of specific evidence." },
      { criterion: "Analysis and Reasoning", maxPoints: 2, description: "Uses documents to support an argument and analyzes at least two documents." },
    ],
  },
  history_leq: {
    id: "history_leq",
    name: "AP History LEQ (6-point)",
    rows: [
      { criterion: "Thesis/Claim", maxPoints: 1, description: "Responds to the prompt with a historically defensible thesis." },
      { criterion: "Contextualization", maxPoints: 1, description: "Describes broader historical context relevant to the prompt." },
      { criterion: "Evidence", maxPoints: 2, description: "Provides specific examples of evidence relevant to the topic." },
      { criterion: "Analysis and Reasoning", maxPoints: 2, description: "Uses historical reasoning and demonstrates complex understanding." },
    ],
  },
  csa_java: {
    id: "csa_java",
    name: "AP CSA Java FRQ (9-point typical)",
    rows: [
      { criterion: "Method/Class Structure", maxPoints: 2, description: "Correct method/class header, access modifiers, return types." },
      { criterion: "Algorithm Logic", maxPoints: 4, description: "Correct algorithm implementation with proper control structures." },
      { criterion: "Data Access", maxPoints: 2, description: "Correct use of instance variables, parameters, and method calls." },
      { criterion: "Return/Output", maxPoints: 1, description: "Returns correct value or produces correct side effect." },
    ],
  },
  psychology_aaq_ebq: {
    id: "psychology_aaq_ebq",
    name: "AP Psychology AAQ/EBQ (7-point)",
    rows: [
      { criterion: "Claim/Thesis", maxPoints: 1, description: "Makes a claim that responds to the prompt." },
      { criterion: "Evidence", maxPoints: 3, description: "Uses specific and relevant evidence from the scenario or course concepts." },
      { criterion: "Reasoning", maxPoints: 2, description: "Explains how evidence supports the claim using psychological concepts." },
      { criterion: "Alternative Perspective", maxPoints: 1, description: "Discusses an alternative perspective or limitation where required." },
    ],
  },
  generic_points: {
    id: "generic_points",
    name: "Generic Point-Based FRQ",
    rows: [
      { criterion: "Part A", maxPoints: 1, description: "Accurately addresses part (a) of the question." },
      { criterion: "Part B", maxPoints: 1, description: "Accurately addresses part (b) of the question." },
      { criterion: "Part C", maxPoints: 1, description: "Accurately addresses part (c) of the question." },
    ],
  },
  essay_6pt: {
    id: "essay_6pt",
    name: "6-Point Essay Rubric",
    rows: [
      { criterion: "Thesis/Claim", maxPoints: 1, description: "Presents a clear, defensible claim." },
      { criterion: "Evidence", maxPoints: 3, description: "Provides relevant evidence and analysis." },
      { criterion: "Reasoning", maxPoints: 2, description: "Demonstrates logical reasoning and complex understanding." },
    ],
  },
};

export function getRubricForQuestionType(
  courseId: FrqCourseId,
  questionType: string,
  rubricTemplateId: string
): RubricTemplate {
  if (questionType === "dbq") return RUBRIC_TEMPLATES.history_dbq;
  if (questionType === "leq") return RUBRIC_TEMPLATES.history_leq;
  if (questionType === "saq") return RUBRIC_TEMPLATES.history_saq;
  if (questionType === "code") return RUBRIC_TEMPLATES.csa_java;
  if (questionType === "aaq" || questionType === "ebq") return RUBRIC_TEMPLATES.psychology_aaq_ebq;
  return RUBRIC_TEMPLATES[rubricTemplateId] ?? RUBRIC_TEMPLATES.generic_points;
}

export function rubricTemplateToPromptText(template: RubricTemplate): string {
  const rows = template.rows
    .map((r) => `- ${r.criterion} (${r.maxPoints} pt): ${r.description}`)
    .join("\n");
  return `${template.name}\n${rows}`;
}
