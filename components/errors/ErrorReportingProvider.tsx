"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ErrorNoticeModal } from "@/components/errors/ErrorNoticeModal";
import { reportClientError } from "@/lib/client-error-reporting";

type ErrorReportingContextValue = {
  notifyError: (error: unknown, context?: string) => void;
};

const ErrorReportingContext = createContext<ErrorReportingContextValue | null>(null);

export function useErrorReporting(): ErrorReportingContextValue {
  const ctx = useContext(ErrorReportingContext);
  if (!ctx) {
    return {
      notifyError: (error, context) => {
        reportClientError(error, { context });
      },
    };
  }
  return ctx;
}

export function ErrorReportingProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const reportedRef = useRef<Set<string>>(new Set());

  const notifyError = useCallback((error: unknown, context?: string) => {
    const parsed =
      error instanceof Error
        ? { name: error.name, message: error.message }
        : { name: "Error", message: String(error) };
    const key = `${parsed.name}|${parsed.message}|${context ?? ""}`;

    if (!reportedRef.current.has(key)) {
      reportedRef.current.add(key);
      reportClientError(error, { context });
    }

    setOpen(true);
  }, []);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      notifyError(event.error ?? event.message, "window.error");
      event.preventDefault();
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      notifyError(event.reason, "unhandledrejection");
      event.preventDefault();
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [notifyError]);

  const value = useMemo(() => ({ notifyError }), [notifyError]);

  return (
    <ErrorReportingContext.Provider value={value}>
      {children}
      <ErrorNoticeModal open={open} onOpenChange={setOpen} />
    </ErrorReportingContext.Provider>
  );
}
