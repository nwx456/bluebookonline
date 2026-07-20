import { PRESENTATION_CONTENT_EN } from "./en";
import { PRESENTATION_CONTENT_TR } from "./tr";
import type { PresentationContent } from "./types";

export type PresentationLocale = "tr" | "en";

export const SLIDE_COUNT = 5;

const CONTENT_BY_LOCALE: Record<PresentationLocale, PresentationContent> = {
  tr: PRESENTATION_CONTENT_TR,
  en: PRESENTATION_CONTENT_EN,
};

export function getPresentationContent(locale: PresentationLocale): PresentationContent {
  return CONTENT_BY_LOCALE[locale];
}

export type { PresentationContent } from "./types";
