"use client";

import { useEffect, useState } from "react";
import { ErrorNoticeModal } from "@/components/errors/ErrorNoticeModal";
import { reportClientError } from "@/lib/client-error-reporting";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    reportClientError(error, {
      digest: error.digest,
      context: "error-boundary",
    });
  }, [error]);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4">
      <ErrorNoticeModal
        open={open}
        onOpenChange={setOpen}
        showRetry
        onRetry={() => reset()}
      />
    </div>
  );
}
