import type { NextRequest } from "next/server";
import type { LibraryFilters, LibrarySort } from "@/lib/library-types";

const SORT_VALUES: LibrarySort[] = ["newest", "oldest", "title", "score"];

export function parseLibraryFilters(searchParams: URLSearchParams): LibraryFilters {
  const sortParam = searchParams.get("sort");
  const sort = SORT_VALUES.includes(sortParam as LibrarySort)
    ? (sortParam as LibrarySort)
    : "newest";
  const programParam = searchParams.get("program");
  const program =
    programParam === "AP" || programParam === "SAT" ? programParam : undefined;
  const examKindParam = searchParams.get("examKind");
  const examKind =
    examKindParam === "mcq" || examKindParam === "frq" || examKindParam === "all"
      ? examKindParam
      : undefined;
  const tagIds = searchParams.getAll("tagId").filter(Boolean);
  const scoreMinRaw = searchParams.get("scoreMin");
  const scoreMaxRaw = searchParams.get("scoreMax");

  return {
    q: searchParams.get("q") ?? undefined,
    subject: searchParams.get("subject") ?? undefined,
    program,
    examKind,
    archived: searchParams.get("archived") === "true",
    tagIds: tagIds.length ? tagIds : undefined,
    sort,
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    scoreMin: scoreMinRaw != null && scoreMinRaw !== "" ? Number(scoreMinRaw) : undefined,
    scoreMax: scoreMaxRaw != null && scoreMaxRaw !== "" ? Number(scoreMaxRaw) : undefined,
  };
}

export function normalizeEmailFromRequest(request: NextRequest, email: string): string {
  return email.trim().toLowerCase();
}
