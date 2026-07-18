/**
 * Registry of the 16 fully digital AP courses with Bluebook FRQ typing.
 * Hybrid courses (Calculus, Physics, etc.) are excluded — FRQs are handwritten on paper.
 */

export type FrqEditorType = "code" | "richtext";

export type FrqQuestionType =
  | "essay"
  | "saq"
  | "dbq"
  | "leq"
  | "code"
  | "generic"
  | "aaq"
  | "ebq";

export type FrqCourseId =
  | "AP_AFRICAN_AMERICAN_STUDIES"
  | "AP_ART_HISTORY"
  | "AP_COMPARATIVE_GOVERNMENT"
  | "AP_CSA"
  | "AP_CSP"
  | "AP_ENGLISH_LANG"
  | "AP_ENGLISH_LIT"
  | "AP_ENVIRONMENTAL_SCIENCE"
  | "AP_EUROPEAN_HISTORY"
  | "AP_HUMAN_GEOGRAPHY"
  | "AP_LATIN"
  | "AP_PSYCHOLOGY"
  | "AP_SEMINAR"
  | "AP_US_GOVERNMENT"
  | "AP_US_HISTORY"
  | "AP_WORLD_HISTORY";

export interface FrqSectionQuestion {
  type: FrqQuestionType;
  label: string;
  maxPoints: number;
  durationMin?: number;
}

export interface FrqCourseConfig {
  id: FrqCourseId;
  shortName: string;
  fullName: string;
  editorType: FrqEditorType;
  rubricTemplateId: string;
  sectionDurationMin: number;
  sectionDirections: string;
  questions: FrqSectionQuestion[];
  category: "english" | "history" | "social" | "science" | "cs" | "humanities";
}

const COMMON_HISTORY_DIRECTIONS = `Section II has free-response questions. Read each question carefully and write your responses in the editor provided. You may go back and forth between questions in this section until time expires. Credit for partial solutions will be given where applicable. Your responses are saved as you enter them.`;

const COMMON_ENGLISH_DIRECTIONS = `Section II has free-response questions. Read each question carefully. Write your responses in the editor provided. You may go back and forth between questions in this section until time expires. Your spelling will not be checked. Credit for partial solutions will be given where applicable. Your responses are saved as you enter them.`;

const CSA_DIRECTIONS = `Section II has 4 free-response questions and lasts 1 hour and 30 minutes. All program segments must be written in Java. Show all your work. Credit for partial solutions will be given. Java Quick Reference information is available throughout the exam. You may go back and forth between questions in this section until time expires. Credit will only be given for responses entered in this application.`;

export const FRQ_COURSES: Record<FrqCourseId, FrqCourseConfig> = {
  AP_AFRICAN_AMERICAN_STUDIES: {
    id: "AP_AFRICAN_AMERICAN_STUDIES",
    shortName: "African American Studies",
    fullName: "AP African American Studies",
    editorType: "richtext",
    rubricTemplateId: "history_saq",
    sectionDurationMin: 75,
    sectionDirections: COMMON_HISTORY_DIRECTIONS,
    questions: [
      { type: "saq", label: "Short Answer Question 1", maxPoints: 3 },
      { type: "saq", label: "Short Answer Question 2", maxPoints: 3 },
      { type: "saq", label: "Short Answer Question 3", maxPoints: 3 },
      { type: "dbq", label: "Document-Based Question", maxPoints: 7 },
      { type: "leq", label: "Long Essay Question", maxPoints: 6 },
    ],
    category: "history",
  },
  AP_ART_HISTORY: {
    id: "AP_ART_HISTORY",
    shortName: "Art History",
    fullName: "AP Art History",
    editorType: "richtext",
    rubricTemplateId: "essay_6pt",
    sectionDurationMin: 120,
    sectionDirections: COMMON_ENGLISH_DIRECTIONS,
    questions: [
      { type: "essay", label: "Long Essay Question 1", maxPoints: 8 },
      { type: "essay", label: "Long Essay Question 2", maxPoints: 8 },
      { type: "essay", label: "Long Essay Question 3", maxPoints: 8 },
      { type: "essay", label: "Long Essay Question 4", maxPoints: 8 },
      { type: "essay", label: "Long Essay Question 5", maxPoints: 8 },
      { type: "essay", label: "Long Essay Question 6", maxPoints: 8 },
    ],
    category: "humanities",
  },
  AP_COMPARATIVE_GOVERNMENT: {
    id: "AP_COMPARATIVE_GOVERNMENT",
    shortName: "Comparative Government",
    fullName: "AP Comparative Government and Politics",
    editorType: "richtext",
    rubricTemplateId: "generic_points",
    sectionDurationMin: 100,
    sectionDirections: COMMON_HISTORY_DIRECTIONS,
    questions: [
      { type: "generic", label: "Free Response Question 1", maxPoints: 6 },
      { type: "generic", label: "Free Response Question 2", maxPoints: 6 },
      { type: "generic", label: "Free Response Question 3", maxPoints: 6 },
      { type: "generic", label: "Free Response Question 4", maxPoints: 6 },
    ],
    category: "social",
  },
  AP_CSA: {
    id: "AP_CSA",
    shortName: "Computer Science A",
    fullName: "AP Computer Science A",
    editorType: "code",
    rubricTemplateId: "csa_java",
    sectionDurationMin: 90,
    sectionDirections: CSA_DIRECTIONS,
    questions: [
      { type: "code", label: "Question 1: Methods and Control Structures", maxPoints: 9 },
      { type: "code", label: "Question 2: Class Design", maxPoints: 9 },
      { type: "code", label: "Question 3: Array/ArrayList", maxPoints: 9 },
      { type: "code", label: "Question 4: 2D Array", maxPoints: 9 },
    ],
    category: "cs",
  },
  AP_CSP: {
    id: "AP_CSP",
    shortName: "Computer Science Principles",
    fullName: "AP Computer Science Principles",
    editorType: "richtext",
    rubricTemplateId: "generic_points",
    sectionDurationMin: 120,
    sectionDirections: COMMON_ENGLISH_DIRECTIONS,
    questions: [
      { type: "generic", label: "Free Response Question 1", maxPoints: 6 },
      { type: "generic", label: "Free Response Question 2", maxPoints: 6 },
    ],
    category: "cs",
  },
  AP_ENGLISH_LANG: {
    id: "AP_ENGLISH_LANG",
    shortName: "English Language",
    fullName: "AP English Language and Composition",
    editorType: "richtext",
    rubricTemplateId: "english_6pt",
    sectionDurationMin: 135,
    sectionDirections: COMMON_ENGLISH_DIRECTIONS,
    questions: [
      { type: "essay", label: "Synthesis Essay", maxPoints: 6 },
      { type: "essay", label: "Rhetorical Analysis Essay", maxPoints: 6 },
      { type: "essay", label: "Argument Essay", maxPoints: 6 },
    ],
    category: "english",
  },
  AP_ENGLISH_LIT: {
    id: "AP_ENGLISH_LIT",
    shortName: "English Literature",
    fullName: "AP English Literature and Composition",
    editorType: "richtext",
    rubricTemplateId: "english_6pt",
    sectionDurationMin: 120,
    sectionDirections: COMMON_ENGLISH_DIRECTIONS,
    questions: [
      { type: "essay", label: "Poetry Analysis Essay", maxPoints: 6 },
      { type: "essay", label: "Prose Fiction Analysis Essay", maxPoints: 6 },
      { type: "essay", label: "Literary Argument Essay", maxPoints: 6 },
    ],
    category: "english",
  },
  AP_ENVIRONMENTAL_SCIENCE: {
    id: "AP_ENVIRONMENTAL_SCIENCE",
    shortName: "Environmental Science",
    fullName: "AP Environmental Science",
    editorType: "richtext",
    rubricTemplateId: "generic_points",
    sectionDurationMin: 70,
    sectionDirections: COMMON_HISTORY_DIRECTIONS,
    questions: [
      { type: "generic", label: "Free Response Question 1", maxPoints: 10 },
      { type: "generic", label: "Free Response Question 2", maxPoints: 10 },
      { type: "generic", label: "Free Response Question 3", maxPoints: 4 },
    ],
    category: "science",
  },
  AP_EUROPEAN_HISTORY: {
    id: "AP_EUROPEAN_HISTORY",
    shortName: "European History",
    fullName: "AP European History",
    editorType: "richtext",
    rubricTemplateId: "history_saq",
    sectionDurationMin: 100,
    sectionDirections: COMMON_HISTORY_DIRECTIONS,
    questions: [
      { type: "saq", label: "Short Answer Question 1", maxPoints: 3 },
      { type: "saq", label: "Short Answer Question 2", maxPoints: 3 },
      { type: "saq", label: "Short Answer Question 3", maxPoints: 3 },
      { type: "dbq", label: "Document-Based Question", maxPoints: 7 },
      { type: "leq", label: "Long Essay Question", maxPoints: 6 },
    ],
    category: "history",
  },
  AP_HUMAN_GEOGRAPHY: {
    id: "AP_HUMAN_GEOGRAPHY",
    shortName: "Human Geography",
    fullName: "AP Human Geography",
    editorType: "richtext",
    rubricTemplateId: "generic_points",
    sectionDurationMin: 75,
    sectionDirections: COMMON_HISTORY_DIRECTIONS,
    questions: [
      { type: "generic", label: "Free Response Question 1", maxPoints: 7 },
      { type: "generic", label: "Free Response Question 2", maxPoints: 7 },
      { type: "generic", label: "Free Response Question 3", maxPoints: 7 },
    ],
    category: "social",
  },
  AP_LATIN: {
    id: "AP_LATIN",
    shortName: "Latin",
    fullName: "AP Latin",
    editorType: "richtext",
    rubricTemplateId: "generic_points",
    sectionDurationMin: 120,
    sectionDirections: COMMON_ENGLISH_DIRECTIONS,
    questions: [
      { type: "generic", label: "Short Answer Set 1", maxPoints: 15 },
      { type: "generic", label: "Short Answer Set 2", maxPoints: 15 },
      { type: "essay", label: "Essay 1", maxPoints: 15 },
      { type: "essay", label: "Essay 2", maxPoints: 15 },
    ],
    category: "humanities",
  },
  AP_PSYCHOLOGY: {
    id: "AP_PSYCHOLOGY",
    shortName: "Psychology",
    fullName: "AP Psychology",
    editorType: "richtext",
    rubricTemplateId: "psychology_aaq_ebq",
    sectionDurationMin: 70,
    sectionDirections: COMMON_HISTORY_DIRECTIONS,
    questions: [
      { type: "aaq", label: "Article Analysis Question", maxPoints: 7 },
      { type: "ebq", label: "Evidence-Based Question", maxPoints: 7 },
    ],
    category: "social",
  },
  AP_SEMINAR: {
    id: "AP_SEMINAR",
    shortName: "Seminar",
    fullName: "AP Seminar",
    editorType: "richtext",
    rubricTemplateId: "generic_points",
    sectionDurationMin: 120,
    sectionDirections: COMMON_ENGLISH_DIRECTIONS,
    questions: [
      { type: "generic", label: "Free Response Question 1", maxPoints: 6 },
      { type: "generic", label: "Free Response Question 2", maxPoints: 6 },
    ],
    category: "humanities",
  },
  AP_US_GOVERNMENT: {
    id: "AP_US_GOVERNMENT",
    shortName: "US Government",
    fullName: "AP United States Government and Politics",
    editorType: "richtext",
    rubricTemplateId: "generic_points",
    sectionDurationMin: 100,
    sectionDirections: COMMON_HISTORY_DIRECTIONS,
    questions: [
      { type: "generic", label: "Concept Application", maxPoints: 3 },
      { type: "generic", label: "Quantitative Analysis", maxPoints: 4 },
      { type: "generic", label: "SCOTUS Comparison", maxPoints: 4 },
      { type: "generic", label: "Argument Essay", maxPoints: 6 },
    ],
    category: "social",
  },
  AP_US_HISTORY: {
    id: "AP_US_HISTORY",
    shortName: "US History",
    fullName: "AP United States History",
    editorType: "richtext",
    rubricTemplateId: "history_saq",
    sectionDurationMin: 100,
    sectionDirections: COMMON_HISTORY_DIRECTIONS,
    questions: [
      { type: "saq", label: "Short Answer Question 1", maxPoints: 3 },
      { type: "saq", label: "Short Answer Question 2", maxPoints: 3 },
      { type: "saq", label: "Short Answer Question 3", maxPoints: 3 },
      { type: "dbq", label: "Document-Based Question", maxPoints: 7 },
      { type: "leq", label: "Long Essay Question", maxPoints: 6 },
    ],
    category: "history",
  },
  AP_WORLD_HISTORY: {
    id: "AP_WORLD_HISTORY",
    shortName: "World History",
    fullName: "AP World History: Modern",
    editorType: "richtext",
    rubricTemplateId: "history_saq",
    sectionDurationMin: 100,
    sectionDirections: COMMON_HISTORY_DIRECTIONS,
    questions: [
      { type: "saq", label: "Short Answer Question 1", maxPoints: 3 },
      { type: "saq", label: "Short Answer Question 2", maxPoints: 3 },
      { type: "saq", label: "Short Answer Question 3", maxPoints: 3 },
      { type: "dbq", label: "Document-Based Question", maxPoints: 7 },
      { type: "leq", label: "Long Essay Question", maxPoints: 6 },
    ],
    category: "history",
  },
};

export const FRQ_COURSE_IDS = Object.keys(FRQ_COURSES) as FrqCourseId[];

export const HYBRID_COURSE_IDS = [
  "AP_CALCULUS_AB",
  "AP_CALCULUS_BC",
  "AP_CHEMISTRY",
  "AP_BIOLOGY",
  "AP_PHYSICS_1",
  "AP_PHYSICS_2",
  "AP_PHYSICS_C_MECH",
  "AP_PHYSICS_C_EM",
  "AP_PRECALCULUS",
  "AP_STATISTICS",
  "AP_MICROECONOMICS",
  "AP_MACROECONOMICS",
] as const;

export function isFrqCourseId(value: string): value is FrqCourseId {
  return value in FRQ_COURSES;
}

export function getFrqCourse(id: string): FrqCourseConfig | null {
  return isFrqCourseId(id) ? FRQ_COURSES[id] : null;
}

export function getFrqCourseLabel(id: string): string {
  return getFrqCourse(id)?.fullName ?? id;
}

export interface FrqQuestionPart {
  label: string;
  prompt?: string;
  maxPoints?: number;
}
