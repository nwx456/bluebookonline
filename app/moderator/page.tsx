import { Suspense } from "react";
import ModeratorExamsClient from "./ModeratorExamsClient";

export const dynamic = "force-dynamic";

export default function ModeratorPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
          Yükleniyor…
        </main>
      }
    >
      <ModeratorExamsClient variant="moderator" />
    </Suspense>
  );
}
