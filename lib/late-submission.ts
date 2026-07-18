/**
 * Returns true when completion is after the assignment due date.
 * Missing due date never counts as late.
 */
export function computeIsLate(
  completedAt: Date,
  dueAt: string | null | undefined
): boolean {
  if (!dueAt) return false;
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return false;
  return completedAt.getTime() > due.getTime();
}
