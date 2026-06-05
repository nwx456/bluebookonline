"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface GraphZoomControls {
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  label: string;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

interface GraphZoomContextValue {
  controls: GraphZoomControls | null;
  registerControls: (controls: GraphZoomControls | null) => void;
}

export const GraphZoomContext = createContext<GraphZoomContextValue | null>(null);

export function GraphZoomProvider({ children }: { children: ReactNode }) {
  const [controls, setControls] = useState<GraphZoomControls | null>(null);
  const registerControls = useCallback((next: GraphZoomControls | null) => {
    setControls(next);
  }, []);
  const value = useMemo(
    () => ({ controls, registerControls }),
    [controls, registerControls]
  );
  return <GraphZoomContext.Provider value={value}>{children}</GraphZoomContext.Provider>;
}

export function useGraphZoomRegistration(controls: GraphZoomControls | null) {
  const ctx = useContext(GraphZoomContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.registerControls(controls);
    return () => ctx.registerControls(null);
  }, [ctx, controls]);
}

export function useGraphZoomControls(): GraphZoomControls | null {
  const ctx = useContext(GraphZoomContext);
  return ctx?.controls ?? null;
}

export function GraphZoomHeaderToolbar({ visible }: { visible: boolean }) {
  const controls = useGraphZoomControls();
  if (!visible || !controls) return null;
  return (
    <div
      className="flex items-center gap-0.5 rounded-lg border border-gray-300 bg-white px-1 py-0.5 shadow-sm shrink-0"
      data-no-pan
    >
      <button
        type="button"
        onClick={controls.zoomOut}
        disabled={!controls.canZoomOut}
        className="rounded px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
        aria-label="Zoom out"
      >
        −
      </button>
      <button
        type="button"
        onClick={controls.reset}
        className="px-2 py-1 text-xs text-gray-500 tabular-nums hover:bg-gray-100 min-w-[3rem]"
        aria-label="Reset zoom"
      >
        {controls.label}
      </button>
      <button
        type="button"
        onClick={controls.zoomIn}
        disabled={!controls.canZoomIn}
        className="rounded px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40"
        aria-label="Zoom in"
      >
        +
      </button>
    </div>
  );
}
