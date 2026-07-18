import { Suspense } from "react";
import ModeratorReportsClient from "../ModeratorReportsClient";

export const dynamic = "force-dynamic";

export default function ModeratorReportsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
          Loading…
        </main>
      }
    >
      <ModeratorReportsClient variant="moderator" />
    </Suspense>
  );
}
