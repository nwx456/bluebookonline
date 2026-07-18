import { Suspense } from "react";
import ModeratorResourcesClient from "../ModeratorResourcesClient";

export default function ModeratorResourcesPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">Loading…</div>}>
      <ModeratorResourcesClient />
    </Suspense>
  );
}
