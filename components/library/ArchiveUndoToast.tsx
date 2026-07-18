"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useDashboardAuth } from "@/components/library/DashboardAuthProvider";
import {
  patchAttemptLibraryFields,
  patchFrqAttemptLibraryFields,
  patchFrqUploadLibraryFields,
  patchUploadLibraryFields,
} from "@/components/library/useLibraryTags";

type ArchiveEntityType = "upload" | "attempt" | "frq_upload" | "frq_attempt";

interface ArchiveUndoItem {
  entityType: ArchiveEntityType;
  entityId: string;
  title: string;
}

interface ArchiveUndoContextValue {
  notifyArchived: (item: ArchiveUndoItem, onRestored?: () => void) => void;
}

const ArchiveUndoContext = createContext<ArchiveUndoContextValue | null>(null);

export function ArchiveUndoProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useDashboardAuth();
  const [toast, setToast] = useState<ArchiveUndoItem | null>(null);
  const onRestoredRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const notifyArchived = useCallback((item: ArchiveUndoItem, onRestored?: () => void) => {
    clearTimer();
    onRestoredRef.current = onRestored ?? null;
    setToast(item);
    timerRef.current = window.setTimeout(() => {
      setToast(null);
      onRestoredRef.current = null;
      timerRef.current = null;
    }, 8000);
  }, []);

  const handleUndo = useCallback(async () => {
    if (!toast || !accessToken) return;
    try {
      if (toast.entityType === "upload") {
        await patchUploadLibraryFields(accessToken, toast.entityId, { archived: false });
      } else if (toast.entityType === "frq_upload") {
        await patchFrqUploadLibraryFields(accessToken, toast.entityId, { archived: false });
      } else if (toast.entityType === "frq_attempt") {
        await patchFrqAttemptLibraryFields(accessToken, toast.entityId, { archived: false });
      } else {
        await patchAttemptLibraryFields(accessToken, toast.entityId, { archived: false });
      }
      onRestoredRef.current?.();
    } finally {
      clearTimer();
      setToast(null);
      onRestoredRef.current = null;
    }
  }, [accessToken, toast]);

  const value = useMemo(() => ({ notifyArchived }), [notifyArchived]);

  return (
    <ArchiveUndoContext.Provider value={value}>
      {children}
      {toast && (
        <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 left-4 z-50 max-w-sm rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-lg sm:left-auto">
          <p className="text-sm text-gray-900">
            <span className="font-medium">{toast.title}</span> archived.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleUndo()}
              className="text-sm font-semibold text-blue-600 hover:text-blue-700"
            >
              Undo
            </button>
            <Link
              href="/dashboard/archived"
              className="text-xs text-gray-500 hover:text-gray-700"
              onClick={() => {
                clearTimer();
                setToast(null);
              }}
            >
              View archive
            </Link>
          </div>
        </div>
      )}
    </ArchiveUndoContext.Provider>
  );
}

export function useArchiveUndo() {
  const ctx = useContext(ArchiveUndoContext);
  if (!ctx) {
    throw new Error("useArchiveUndo must be used within ArchiveUndoProvider");
  }
  return ctx;
}
