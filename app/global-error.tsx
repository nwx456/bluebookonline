"use client";

import { useEffect, useState } from "react";
import { ErrorNoticeModal } from "@/components/errors/ErrorNoticeModal";
import { reportClientError } from "@/lib/client-error-reporting";
import { ERROR_NOTICE_MESSAGE } from "@/lib/error-notice-message";

export default function GlobalError({
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
      context: "global-error-boundary",
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F9FAFB] flex items-center justify-center p-4 font-sans antialiased">
        <div className="sr-only">{ERROR_NOTICE_MESSAGE}</div>
        <ErrorNoticeModal
          open={open}
          onOpenChange={setOpen}
          showRetry
          onRetry={() => reset()}
        />
      </body>
    </html>
  );
}
