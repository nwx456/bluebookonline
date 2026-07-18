"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import FrqExamPageInner from "./FrqExamPageInner";

export default function FrqExamPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f2f5f9]">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <FrqExamPageInner />
    </Suspense>
  );
}
