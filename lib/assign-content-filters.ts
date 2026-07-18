import type {
  AssignableFrqExam,
  AssignableMcqExam,
  AssignableResource,
} from "@/components/teacher/assign-content-types";

export type ExamProgramFilter = "all" | "AP" | "SAT";
export type McqSourceFilter = "all" | "mine" | "public";
export type QuestionCountBucket = "all" | "1-20" | "21-40" | "41+";
export type ResourceTypeFilter = "all" | "file" | "link";
export type VisibilityFilter = "all" | "private" | "public";
export type AssignContentSort = "newest" | "title" | "most_questions";

export type McqFilterState = {
  search: string;
  program: ExamProgramFilter;
  subject: string;
  source: McqSourceFilter;
  questionCount: QuestionCountBucket;
  sort: AssignContentSort;
};

export type FrqFilterState = {
  search: string;
  courseId: string;
  questionCount: QuestionCountBucket;
  sort: Exclude<AssignContentSort, "most_questions">;
};

export type ResourceFilterState = {
  search: string;
  resourceType: ResourceTypeFilter;
  visibility: VisibilityFilter;
  sort: Exclude<AssignContentSort, "most_questions">;
};

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

export function matchesQuestionCountBucket(
  count: number,
  bucket: QuestionCountBucket
): boolean {
  if (bucket === "all") return true;
  if (bucket === "1-20") return count >= 1 && count <= 20;
  if (bucket === "21-40") return count >= 21 && count <= 40;
  return count >= 41;
}

function sortByNewest<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

function sortByTitle<T extends { title: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

export function deriveMcqSubjects(items: AssignableMcqExam[]): string[] {
  const subjects = new Map<string, string>();
  for (const item of items) {
    subjects.set(item.subject, item.subjectLabel);
  }
  return [...subjects.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" }))
    .map(([subject]) => subject);
}

export function deriveFrqCourses(items: AssignableFrqExam[]): Array<{ id: string; label: string }> {
  const courses = new Map<string, string>();
  for (const item of items) {
    courses.set(item.courseId, item.courseLabel);
  }
  return [...courses.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: "base" }))
    .map(([id, label]) => ({ id, label }));
}

export function filterMcqExams(
  items: AssignableMcqExam[],
  filters: McqFilterState
): AssignableMcqExam[] {
  const q = normalizeSearch(filters.search);
  let result = items.filter((item) => {
    if (q) {
      const haystack = `${item.title} ${item.subjectLabel}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.program !== "all" && item.examProgram !== filters.program) return false;
    if (filters.subject && item.subject !== filters.subject) return false;
    if (filters.source !== "all" && item.source !== filters.source) return false;
    if (!matchesQuestionCountBucket(item.questionCount, filters.questionCount)) return false;
    return true;
  });

  if (filters.sort === "title") {
    result = sortByTitle(result);
  } else if (filters.sort === "most_questions") {
    result = [...result].sort((a, b) => {
      if (b.questionCount !== a.questionCount) return b.questionCount - a.questionCount;
      return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    });
  } else {
    result = sortByNewest(result);
  }

  return result;
}

export function filterFrqExams(
  items: AssignableFrqExam[],
  filters: FrqFilterState
): AssignableFrqExam[] {
  const q = normalizeSearch(filters.search);
  let result = items.filter((item) => {
    if (q) {
      const haystack = `${item.title} ${item.courseLabel}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (filters.courseId && item.courseId !== filters.courseId) return false;
    if (!matchesQuestionCountBucket(item.questionCount, filters.questionCount)) return false;
    return true;
  });

  result = filters.sort === "title" ? sortByTitle(result) : sortByNewest(result);
  return result;
}

export function filterResources(
  items: AssignableResource[],
  filters: ResourceFilterState
): AssignableResource[] {
  const q = normalizeSearch(filters.search);
  let result = items.filter((item) => {
    if (q && !item.title.toLowerCase().includes(q)) return false;
    if (filters.resourceType !== "all" && item.resourceType !== filters.resourceType) return false;
    if (filters.visibility !== "all" && item.visibility !== filters.visibility) return false;
    return true;
  });

  result = filters.sort === "title" ? sortByTitle(result) : sortByNewest(result);
  return result;
}
