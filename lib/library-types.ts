import type { ModerationStatus } from "@/lib/moderator-auth";

export type LibraryEntityType = "upload" | "attempt" | "frq_upload" | "frq_attempt";

export type LibraryExamKind = "mcq" | "frq";

export type LibrarySort = "newest" | "oldest" | "title" | "score";

export interface LibraryTag {
  id: string;
  name: string;
  color: string | null;
  createdAt: string;
}

export interface LibraryUploadItem {
  id: string;
  examKind: LibraryExamKind;
  filename: string;
  displayTitle: string | null;
  personalNotes: string | null;
  archivedAt: string | null;
  title: string;
  subject: string;
  examProgram: "AP" | "SAT";
  questionCount: number;
  maxScore?: number;
  courseId?: string;
  courseLabel?: string;
  uploadedAt: string;
  isPublished: boolean;
  moderationStatus: ModerationStatus;
  sourceType: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  tags: LibraryTag[];
}

export interface LibraryAttemptItem {
  id: string;
  examKind: LibraryExamKind;
  uploadId: string;
  filename: string;
  displayTitle: string | null;
  personalNotes: string | null;
  archivedAt: string | null;
  title: string;
  subject: string;
  examProgram: "AP" | "SAT";
  completedAt: string;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  notGradedCount: number;
  skipAiGrading: boolean;
  totalQuestions: number;
  percentage: number | null;
  totalScore?: number | null;
  maxScore?: number | null;
  moduleProgress: Record<string, { correct: number; total: number }> | null;
  rwScaledScore: number | null;
  mathScaledScore: number | null;
  totalScaledScore: number | null;
  tags: LibraryTag[];
}

export interface LibraryInsights {
  attemptCount: number;
  averagePercentage: number | null;
  averageSatTotal: number | null;
  bestScore: number | null;
  latestScore: number | null;
  scoreDelta: number | null;
  trend: Array<{
    id: string;
    completedAt: string;
    title: string;
    examProgram: "AP" | "SAT";
    examKind?: LibraryExamKind;
    percentage: number | null;
    totalScaledScore: number | null;
    accuracy: number | null;
  }>;
  accuracyTrend: Array<{
    id: string;
    completedAt: string;
    title: string;
    accuracy: number;
  }>;
  weeklyAttempts: Array<{
    weekStart: string;
    label: string;
    count: number;
  }>;
  subjectPerformance: Array<{
    subject: string;
    attemptCount: number;
    averageScore: number | null;
    mistakeCount: number;
  }>;
  bySubject: Array<{
    subject: string;
    attemptCount: number;
    averagePercentage: number | null;
    mistakeCount: number;
  }>;
  bySatSection: Array<{
    section: "rw" | "math";
    mistakeCount: number;
    averageScaled: number | null;
  }>;
  totalMistakes: number;
}

export interface LibrarySummary {
  program: "AP" | "SAT";
  activeUploads: number;
  activeAttempts: number;
  inProgress: number;
  mistakeCount: number;
  archivedUploads: number;
  archivedAttempts: number;
  recentAttempts: Array<{
    id: string;
    uploadId: string;
    title: string;
    subject: string;
    examProgram: "AP" | "SAT";
    examKind?: LibraryExamKind;
    completedAt: string;
    percentage: number | null;
    totalScaledScore: number | null;
    totalScore?: number | null;
    maxScore?: number | null;
    rwScaledScore: number | null;
    mathScaledScore: number | null;
  }>;
  inProgressAttempts: Array<{
    id: string;
    uploadId: string;
    filename: string;
    subject: string;
    examProgram: "AP" | "SAT";
    startedAt: string;
  }>;
}

export interface LibraryFilters {
  q?: string;
  subject?: string;
  program?: "AP" | "SAT";
  examKind?: "mcq" | "frq" | "all";
  archived?: boolean;
  tagIds?: string[];
  sort?: LibrarySort;
  dateFrom?: string;
  dateTo?: string;
  scoreMin?: number;
  scoreMax?: number;
}
