"use client";

import { createContext, useContext, type ReactNode } from "react";
import { getPresentationContent, type PresentationContent, type PresentationLocale } from "./content";

const PresentationContentContext = createContext<PresentationContent | null>(null);

type PresentationContentProviderProps = {
  locale: PresentationLocale;
  children: ReactNode;
};

export function PresentationContentProvider({ locale, children }: PresentationContentProviderProps) {
  const content = getPresentationContent(locale);
  return (
    <PresentationContentContext.Provider value={content}>{children}</PresentationContentContext.Provider>
  );
}

export function usePresentationContent(): PresentationContent {
  const content = useContext(PresentationContentContext);
  if (!content) {
    throw new Error("usePresentationContent must be used within PresentationContentProvider");
  }
  return content;
}
