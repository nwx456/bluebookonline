"use client";

import { X } from "lucide-react";

const JAVA_QUICK_REFERENCE = `Accessible classes from the java.lang package:
  String, Integer, Double, Boolean, Math, System

String methods:
  length(), substring(int), substring(int, int), indexOf(String),
  compareTo(String), equals(Object), toString()

Integer methods:
  intValue(), parseInt(String), toString(int), MIN_VALUE, MAX_VALUE

Double methods:
  doubleValue(), parseDouble(String), toString(double)

Math methods:
  abs(int/double), pow(double, double), sqrt(double), random()

ArrayList methods:
  size(), add(E), add(int, E), get(int), set(int, E), remove(int)

Array methods:
  length (field), clone(), equals(Object)

Comparable interface:
  compareTo(T)

Scanner methods:
  nextInt(), nextDouble(), nextBoolean(), nextLine(), hasNext(), hasNextInt()

Printing:
  System.out.print(Object)
  System.out.println(Object)`;

export function JavaQuickReferencePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">Java Quick Reference</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <pre className="overflow-auto p-4 text-xs leading-relaxed text-gray-800 whitespace-pre-wrap font-mono">
          {JAVA_QUICK_REFERENCE}
        </pre>
      </div>
    </div>
  );
}

export function JavaQuickReferenceButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
    >
      Java Quick Reference
    </button>
  );
}
