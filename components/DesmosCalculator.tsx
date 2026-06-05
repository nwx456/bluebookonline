"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Calculator as CalcIcon, GripHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clampFloatingPanelPosition,
  useFloatingPanelDrag,
} from "@/app/exam/useFloatingPanelDrag";

const DESMOS_API_KEY = "dcb31709b452b1cf9dc26972add0fda6"; // public demo key from Desmos docs
const DESMOS_SCRIPT_SRC = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${DESMOS_API_KEY}`;

const PANEL_MAX_W = 620;
const PANEL_MAX_H = 520;
const PANEL_MIN_W = 320;
const PANEL_MIN_H = 260;
const PANEL_PADDING = 16;

type PanelSize = { width: number; height: number };

type DesmosCalcInstance = {
  destroy: () => void;
  resize?: () => void;
};

type DesmosGlobal = {
  GraphingCalculator: (el: HTMLElement, opts?: Record<string, unknown>) => DesmosCalcInstance;
};

declare global {
  interface Window {
    Desmos?: DesmosGlobal;
  }
}

let desmosLoadPromise: Promise<void> | null = null;

function loadDesmosScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Desmos) return Promise.resolve();
  if (desmosLoadPromise) return desmosLoadPromise;
  desmosLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-desmos-loader="true"]`);
    if (existing) {
      if (window.Desmos) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Desmos")));
      return;
    }
    const script = document.createElement("script");
    script.src = DESMOS_SCRIPT_SRC;
    script.async = true;
    script.dataset.desmosLoader = "true";
    script.addEventListener("load", () => resolve());
    script.addEventListener("error", () => reject(new Error("Failed to load Desmos")));
    document.head.appendChild(script);
  });
  return desmosLoadPromise;
}

function getDefaultPanelSize(): PanelSize {
  if (typeof window === "undefined") {
    return { width: PANEL_MAX_W, height: PANEL_MAX_H };
  }
  return {
    width: Math.min(PANEL_MAX_W, window.innerWidth * 0.95),
    height: Math.min(PANEL_MAX_H, window.innerHeight * 0.8),
  };
}

function getMaxPanelSize(): PanelSize {
  if (typeof window === "undefined") {
    return { width: PANEL_MAX_W, height: PANEL_MAX_H };
  }
  return {
    width: Math.min(PANEL_MAX_W, window.innerWidth - PANEL_PADDING * 2),
    height: Math.min(PANEL_MAX_H, window.innerHeight - PANEL_PADDING * 2),
  };
}

function clampPanelSize(width: number, height: number): PanelSize {
  const max = getMaxPanelSize();
  return {
    width: Math.max(PANEL_MIN_W, Math.min(max.width, width)),
    height: Math.max(PANEL_MIN_H, Math.min(max.height, height)),
  };
}

interface DesmosCalculatorProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Floating SAT-style Desmos graphing calculator panel. The Desmos script is
 * lazy-loaded the first time the calculator is opened, then cached for the
 * remainder of the session. Drag the header to move; drag the bottom-right
 * handle to resize within the viewport.
 */
export function DesmosCalculator({ open, onClose }: DesmosCalculatorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<DesmosCalcInstance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [size, setSize] = useState<PanelSize>(getDefaultPanelSize);

  const { position, setPosition, onDragStart, onTouchDragStart } = useFloatingPanelDrag({
    panelWidth: size.width,
    panelHeight: size.height,
    padding: PANEL_PADDING,
  });

  useEffect(() => {
    setPosition((pos) =>
      clampFloatingPanelPosition(pos.x, pos.y, size.width, size.height, PANEL_PADDING)
    );
  }, [size.width, size.height, setPosition]);

  const startResize = useCallback(
    (clientX: number, clientY: number) => {
      const startW = size.width;
      const startH = size.height;

      const onMouseMove = (e: MouseEvent) => {
        setSize(
          clampPanelSize(startW + (e.clientX - clientX), startH + (e.clientY - clientY))
        );
      };

      const onTouchMove = (e: TouchEvent) => {
        const t = e.touches[0];
        if (!t) return;
        e.preventDefault();
        setSize(
          clampPanelSize(startW + (t.clientX - clientX), startH + (t.clientY - clientY))
        );
      };

      const endResize = () => {
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", endResize);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("touchend", endResize);
      };

      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", endResize);
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", endResize);
    },
    [size.width, size.height]
  );

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      startResize(e.clientX, e.clientY);
    },
    [startResize]
  );

  const onTouchResizeStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      e.stopPropagation();
      startResize(t.clientX, t.clientY);
    },
    [startResize]
  );

  const destroyInstance = useCallback(() => {
    if (!instanceRef.current) return;
    try {
      instanceRef.current.destroy();
    } catch {
      // ignore
    }
    instanceRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      destroyInstance();
      return;
    }

    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLoadError(null);

    loadDesmosScript()
      .then(() => {
        if (cancelled) return;
        if (!containerRef.current || !window.Desmos) return;
        destroyInstance();
        instanceRef.current = window.Desmos.GraphingCalculator(containerRef.current, {
          expressions: true,
          settingsMenu: true,
          keypad: true,
          graphpaper: true,
          border: false,
        });
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message || "Failed to load Desmos.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      destroyInstance();
    };
  }, [open, destroyInstance]);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const el = containerRef.current;
    const ro = new ResizeObserver(() => {
      try {
        instanceRef.current?.resize?.();
      } catch {
        // ignore
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
      style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onDragStart}
        onTouchStart={onTouchDragStart}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800 pointer-events-none">
          <CalcIcon className="h-4 w-4 text-blue-600" />
          Desmos Graphing Calculator
        </div>
        <button
          type="button"
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="rounded-md p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
          aria-label="Close calculator"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 bg-white/80">
            Loading Desmos…
          </div>
        )}
        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-red-600 bg-white p-4 text-center">
            {loadError}
          </div>
        )}
        <div
          ref={containerRef}
          className={cn("w-full h-full", loadError && "hidden")}
          aria-label="Desmos calculator"
        />
      </div>
      <button
        type="button"
        aria-label="Resize calculator"
        className="absolute bottom-0 right-0 z-10 flex h-6 w-6 cursor-se-resize items-center justify-center rounded-tl-md border border-gray-200 bg-gray-50 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        onMouseDown={onResizeStart}
        onTouchStart={onTouchResizeStart}
      >
        <GripHorizontal className="h-3 w-3 rotate-[-45deg]" />
      </button>
    </div>
  );
}

