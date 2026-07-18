import { Suspense } from "react";
import ModeratorExamsClient from "@/app/moderator/ModeratorExamsClient";

export const dynamic = "force-dynamic";

export default function AdminModerationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
          Loading…
        </main>
      }
    >
      <ModeratorExamsClient variant="admin" />
    </Suspense>
  );
}
