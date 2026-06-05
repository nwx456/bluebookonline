"use client";

import { useEffect, useRef, useState } from "react";
import { Calculator as CalcIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

const DESMOS_API_KEY = "dcb31709b452b1cf9dc26972add0fda6"; // public demo key from Desmos docs
const DESMOS_SCRIPT_SRC = `https://www.desmos.com/api/v1.11/calculator.js?apiKey=${DESMOS_API_KEY}`;

type DesmosCalcInstance = {
  destroy: () => void;
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

interface DesmosCalculatorProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Floating SAT-style Desmos graphing calculator panel. The Desmos script is
 * lazy-loaded the first time the calculator is opened, then cached for the
 * remainder of the session.
 */
export function DesmosCalculator({ open, onClose }: DesmosCalculatorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<DesmosCalcInstance | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (instanceRef.current) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setLoadError(null);
    loadDesmosScript()
      .then(() => {
        if (cancelled) return;
        if (!containerRef.current || !window.Desmos) return;
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
    };
  }, [open]);

  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        try {
          instanceRef.current.destroy();
        } catch {
          // ignore
        }
        instanceRef.current = null;
      }
    };
  }, []);

  if (!open) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(620px,95vw)] h-[min(520px,80vh)] bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <CalcIcon className="h-4 w-4 text-blue-600" />
          Desmos Graphing Calculator
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100"
          aria-label="Close calculator"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 relative">
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
    </div>
  );
}
