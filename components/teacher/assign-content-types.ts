export type AssignableMcqExam = {
  id: string;
  title: string;
  subject: string;
  subjectLabel: string;
  examProgram: "AP" | "SAT";
  questionCount: number;
  source: "mine" | "public";
  ownerUsername?: string;
  moderationStatus?: string;
  alreadyAssigned: boolean;
  createdAt: string;
};

export type AssignableFrqExam = {
  id: string;
  title: string;
  courseId: string;
  courseLabel: string;
  questionCount: number;
  maxScore: number;
  alreadyAssigned: boolean;
  createdAt: string;
};

export type AssignableResource = {
  id: string;
  title: string;
  resourceType: "file" | "link";
  visibility: "private" | "public";
  externalUrl: string | null;
  alreadyAssigned: boolean;
  createdAt: string;
};

export type AssignableContentResponse = {
  mcqExams: AssignableMcqExam[];
  frqExams: AssignableFrqExam[];
  resources: AssignableResource[];
};

export type AssignKind = "exam" | "frq_exam" | "resource";
