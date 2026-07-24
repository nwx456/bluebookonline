import { SUBJECT_LABELS, type SubjectKey } from "@/lib/subjects";
import { FRQ_COURSE_IDS, getFrqCourseLabel, type FrqCourseId } from "@/lib/frq-courses";

export function getInsightsSubjectLabel(subject: string): string {
  if ((FRQ_COURSE_IDS as readonly string[]).includes(subject)) {
    return getFrqCourseLabel(subject as FrqCourseId);
  }
  return SUBJECT_LABELS[subject as SubjectKey] ?? subject;
}
