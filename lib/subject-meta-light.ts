/**
 * Minimal subject metadata for client bundles (slug + display names).
 * Full SEO/content metadata lives in subject-meta.ts (server / static pages).
 */

import { type SubjectKey } from "@/lib/subjects";

export type SubjectMetaLight = {
  slug: string;
  fullName: string;
};

export const SUBJECT_META_LIGHT: Record<SubjectKey, SubjectMetaLight> = {
  AP_CSA: { slug: "ap-csa", fullName: "AP Computer Science A" },
  AP_CSP: { slug: "ap-csp", fullName: "AP Computer Science Principles" },
  AP_MICROECONOMICS: { slug: "ap-microeconomics", fullName: "AP Microeconomics" },
  AP_MACROECONOMICS: { slug: "ap-macroeconomics", fullName: "AP Macroeconomics" },
  AP_PSYCHOLOGY: { slug: "ap-psychology", fullName: "AP Psychology" },
  AP_STATISTICS: { slug: "ap-statistics", fullName: "AP Statistics" },
  AP_BIOLOGY: { slug: "ap-biology", fullName: "AP Biology" },
  AP_CHEMISTRY: { slug: "ap-chemistry", fullName: "AP Chemistry" },
  AP_PHYSICS_1: { slug: "ap-physics-1", fullName: "AP Physics 1: Algebra-Based" },
  AP_PHYSICS_2: { slug: "ap-physics-2", fullName: "AP Physics 2: Algebra-Based" },
  AP_PHYSICS_C_MECH: { slug: "ap-physics-c-mechanics", fullName: "AP Physics C: Mechanics" },
  AP_PHYSICS_C_EM: { slug: "ap-physics-c-em", fullName: "AP Physics C: Electricity and Magnetism" },
  AP_ENVIRONMENTAL_SCIENCE: { slug: "ap-environmental-science", fullName: "AP Environmental Science" },
  AP_HUMAN_GEOGRAPHY: { slug: "ap-human-geography", fullName: "AP Human Geography" },
  AP_ENGLISH_LANG: { slug: "ap-english-language", fullName: "AP English Language and Composition" },
  AP_ENGLISH_LIT: { slug: "ap-english-literature", fullName: "AP English Literature and Composition" },
  AP_US_HISTORY: { slug: "ap-us-history", fullName: "AP United States History" },
  AP_WORLD_HISTORY: { slug: "ap-world-history", fullName: "AP World History: Modern" },
  AP_EUROPEAN_HISTORY: { slug: "ap-european-history", fullName: "AP European History" },
  AP_US_GOVERNMENT: { slug: "ap-us-government", fullName: "AP United States Government and Politics" },
  AP_COMPARATIVE_GOVERNMENT: {
    slug: "ap-comparative-government",
    fullName: "AP Comparative Government and Politics",
  },
  AP_CALCULUS_AB: { slug: "ap-calculus-ab", fullName: "AP Calculus AB" },
  AP_CALCULUS_BC: { slug: "ap-calculus-bc", fullName: "AP Calculus BC" },
  AP_PRECALCULUS: { slug: "ap-precalculus", fullName: "AP Precalculus" },
  SAT_RW: { slug: "sat-reading-writing", fullName: "SAT Reading & Writing" },
  SAT_MATH: { slug: "sat-math", fullName: "SAT Math" },
  SAT_FULL_TEST: { slug: "sat-full-test", fullName: "SAT Full Test (Digital)" },
};
