import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import AdminPdfsClient from "./AdminPdfsClient";

export const dynamic = "force-dynamic";

export default function AdminPdfsPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[40vh] max-w-6xl items-center justify-center px-4 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label="Loading" />
        </main>
      }
    >
      <AdminPdfsClient />
    </Suspense>
  );
}
