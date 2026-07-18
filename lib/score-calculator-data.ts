/**
 * AP score calculator data based on publicly released College Board scoring
 * worksheets and historical composite-to-score cutoffs. Cutoffs shift annually
 * via equating — treat as estimates only.
 */

export type ApScore = 1 | 2 | 3 | 4 | 5;

export interface ScoreCalculatorFrqPart {
  id: string;
  label: string;
  maxPoints: number;
}

export interface ScoreCalculatorExam {
  slug: string;
  name: string;
  shortName: string;
  examSlug: string;
  mcqCount: number;
  mcqWeight: number;
  frqParts: ScoreCalculatorFrqPart[];
  frqWeight: number;
  /** Composite score thresholds (min composite for each AP score) */
  cutoffs: Record<ApScore, number>;
  maxComposite: number;
  seoTitle: string;
  metaDescription: string;
  focusKeyword: string;
  faq: { question: string; answer: string }[];
}

export const SCORE_CALCULATOR_DISCLAIMER =
  "This calculator provides an estimate only. The College Board uses annual equating; official cutoffs are not published before scores release in July. Not affiliated with the College Board.";

export const SCORE_CALCULATOR_EXAMS: ScoreCalculatorExam[] = [
  {
    slug: "ap-calculus-ab",
    name: "AP Calculus AB",
    shortName: "Calc AB",
    examSlug: "ap-calculus-ab",
    mcqCount: 45,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "FRQ 1", maxPoints: 9 },
      { id: "frq2", label: "FRQ 2", maxPoints: 9 },
      { id: "frq3", label: "FRQ 3", maxPoints: 9 },
      { id: "frq4", label: "FRQ 4", maxPoints: 9 },
      { id: "frq5", label: "FRQ 5", maxPoints: 9 },
      { id: "frq6", label: "FRQ 6", maxPoints: 9 },
    ],
    frqWeight: 0.5,
    maxComposite: 108,
    cutoffs: { 1: 0, 2: 28, 3: 42, 4: 58, 5: 68 },
    focusKeyword: "ap calculus ab score calculator",
    seoTitle: "AP Calculus AB Score Calculator 2026 (Free)",
    metaDescription:
      "Predict your AP Calculus AB score from MCQ and FRQ practice results. Free 2026 calculator using official section weights. Try a full practice test next.",
    faq: [
      {
        question: "What percentage do you need for a 5 on AP Calculus AB?",
        answer:
          "Historically, a composite around 63–70% (roughly 68+ of 108 points) has mapped to a 5, but College Board equating adjusts cutoffs each year.",
      },
      {
        question: "Is there a curve on AP Calculus AB?",
        answer:
          "AP exams use equating, not a classroom curve. Cutoffs are set after the exam to keep score meaning consistent across years.",
      },
    ],
  },
  {
    slug: "ap-calculus-bc",
    name: "AP Calculus BC",
    shortName: "Calc BC",
    examSlug: "ap-calculus-bc",
    mcqCount: 45,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "FRQ 1", maxPoints: 9 },
      { id: "frq2", label: "FRQ 2", maxPoints: 9 },
      { id: "frq3", label: "FRQ 3", maxPoints: 9 },
      { id: "frq4", label: "FRQ 4", maxPoints: 9 },
      { id: "frq5", label: "FRQ 5", maxPoints: 9 },
      { id: "frq6", label: "FRQ 6", maxPoints: 9 },
    ],
    frqWeight: 0.5,
    maxComposite: 108,
    cutoffs: { 1: 0, 2: 30, 3: 44, 4: 60, 5: 70 },
    focusKeyword: "ap calculus bc score calculator",
    seoTitle: "AP Calculus BC Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Calculus BC score calculator for 2026. Enter MCQ correct and FRQ points to estimate your 1–5 score. Then practice with a full Bluebook-style test.",
    faq: [
      {
        question: "Is AP Calculus BC scored differently from AB?",
        answer:
          "BC uses the same 50/50 MCQ/FRQ weighting but includes additional BC-only content. Composite cutoffs are typically similar but vary by year.",
      },
    ],
  },
  {
    slug: "ap-biology",
    name: "AP Biology",
    shortName: "Biology",
    examSlug: "ap-biology",
    mcqCount: 60,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "FRQ 1 (Long)", maxPoints: 10 },
      { id: "frq2", label: "FRQ 2 (Long)", maxPoints: 10 },
      { id: "frq3", label: "FRQ 3", maxPoints: 4 },
      { id: "frq4", label: "FRQ 4", maxPoints: 4 },
      { id: "frq5", label: "FRQ 5", maxPoints: 4 },
      { id: "frq6", label: "FRQ 6", maxPoints: 4 },
    ],
    frqWeight: 0.5,
    maxComposite: 120,
    cutoffs: { 1: 0, 2: 42, 3: 63, 4: 78, 5: 93 },
    focusKeyword: "ap biology score calculator",
    seoTitle: "AP Biology Score Calculator 2026 (Free)",
    metaDescription:
      "Estimate your AP Biology 1–5 score from 60 MCQs and 6 FRQs. Uses official 50/50 weighting. Free 2026 predictor — then take a full practice exam.",
    faq: [
      {
        question: "How hard is it to get a 5 on AP Biology?",
        answer:
          "You typically need roughly 75–80% composite points. Strong FRQ performance matters — FRQs are half your score on hybrid digital exams.",
      },
    ],
  },
  {
    slug: "ap-chemistry",
    name: "AP Chemistry",
    shortName: "Chemistry",
    examSlug: "ap-chemistry",
    mcqCount: 60,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "FRQ 1 (Long)", maxPoints: 10 },
      { id: "frq2", label: "FRQ 2 (Long)", maxPoints: 10 },
      { id: "frq3", label: "FRQ 3", maxPoints: 4 },
      { id: "frq4", label: "FRQ 4", maxPoints: 4 },
      { id: "frq5", label: "FRQ 5", maxPoints: 4 },
      { id: "frq6", label: "FRQ 6", maxPoints: 4 },
      { id: "frq7", label: "FRQ 7", maxPoints: 4 },
    ],
    frqWeight: 0.5,
    maxComposite: 124,
    cutoffs: { 1: 0, 2: 44, 3: 65, 4: 82, 5: 96 },
    focusKeyword: "ap chemistry score calculator",
    seoTitle: "AP Chemistry Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Chemistry score calculator for 2026. Enter MCQ and FRQ points to predict your AP score. Based on official section weights and past cutoffs.",
    faq: [
      {
        question: "Does AP Chemistry have a harsh curve?",
        answer:
          "Chemistry cutoffs vary by year through equating. Students often need strong lab-style FRQ work — not just MCQ memorization — for a 4 or 5.",
      },
    ],
  },
  {
    slug: "ap-physics-1",
    name: "AP Physics 1",
    shortName: "Physics 1",
    examSlug: "ap-physics-1",
    mcqCount: 50,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "FRQ 1", maxPoints: 12 },
      { id: "frq2", label: "FRQ 2", maxPoints: 12 },
      { id: "frq3", label: "FRQ 3", maxPoints: 12 },
      { id: "frq4", label: "FRQ 4", maxPoints: 12 },
      { id: "frq5", label: "FRQ 5", maxPoints: 12 },
    ],
    frqWeight: 0.5,
    maxComposite: 110,
    cutoffs: { 1: 0, 2: 35, 3: 52, 4: 68, 5: 80 },
    focusKeyword: "ap physics 1 score calculator",
    seoTitle: "AP Physics 1 Score Calculator 2026 (Free)",
    metaDescription:
      "Predict your AP Physics 1 score from MCQ and FRQ practice. Free 2026 calculator with official 50/50 weights. Practice next on our Bluebook-style tests.",
    faq: [
      {
        question: "What raw score is a 5 on AP Physics 1?",
        answer:
          "Historically around 73%+ composite, but Physics 1 cutoffs shift with equating. FRQs require shown work — partial credit helps.",
      },
    ],
  },
  {
    slug: "ap-psychology",
    name: "AP Psychology",
    shortName: "Psychology",
    examSlug: "ap-psychology",
    mcqCount: 75,
    mcqWeight: 0.6667,
    frqParts: [
      { id: "frq1", label: "FRQ 1", maxPoints: 7 },
      { id: "frq2", label: "FRQ 2", maxPoints: 7 },
    ],
    frqWeight: 0.3333,
    maxComposite: 150,
    cutoffs: { 1: 0, 2: 53, 3: 78, 4: 98, 5: 113 },
    focusKeyword: "ap psychology score calculator",
    seoTitle: "AP Psychology Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Psychology score calculator — MCQ is 67% of your score. Enter practice results to estimate your 1–5. Then try a full digital practice exam.",
    faq: [
      {
        question: "How much do MCQs matter on AP Psych?",
        answer:
          "Multiple-choice is weighted at roughly two-thirds of the composite score. Strong MCQ performance can compensate for weaker FRQs.",
      },
    ],
  },
  {
    slug: "ap-us-history",
    name: "AP U.S. History",
    shortName: "APUSH",
    examSlug: "ap-us-history",
    mcqCount: 55,
    mcqWeight: 0.4,
    frqParts: [
      { id: "saq", label: "SAQs (combined)", maxPoints: 9 },
      { id: "dbq", label: "DBQ", maxPoints: 7 },
      { id: "leq", label: "LEQ", maxPoints: 6 },
    ],
    frqWeight: 0.6,
    maxComposite: 130,
    cutoffs: { 1: 0, 2: 45, 3: 65, 4: 85, 5: 100 },
    focusKeyword: "apush score calculator",
    seoTitle: "APUSH Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP U.S. History (APUSH) score calculator for 2026. MCQ 40%, essays 60%. Estimate your 1–5 score — then practice DBQ/LEQ skills online.",
    faq: [
      {
        question: "Is APUSH harder to score a 5 on than AP Psych?",
        answer:
          "APUSH weights essays at 60% of the composite. Writing quality on DBQ and LEQ often determines whether you reach a 4 or 5.",
      },
    ],
  },
  {
    slug: "ap-world-history",
    name: "AP World History",
    shortName: "World History",
    examSlug: "ap-world-history",
    mcqCount: 55,
    mcqWeight: 0.4,
    frqParts: [
      { id: "saq", label: "SAQs (combined)", maxPoints: 9 },
      { id: "dbq", label: "DBQ", maxPoints: 7 },
      { id: "leq", label: "LEQ", maxPoints: 6 },
    ],
    frqWeight: 0.6,
    maxComposite: 130,
    cutoffs: { 1: 0, 2: 44, 3: 64, 4: 84, 5: 98 },
    focusKeyword: "ap world history score calculator",
    seoTitle: "AP World History Score Calculator 2026",
    metaDescription:
      "Estimate your AP World History score from MCQ and essay points. Free 2026 calculator with 40/60 MCQ/FRQ weighting. Practice fully digital FRQs next.",
    faq: [
      {
        question: "Are AP World History FRQs typed in 2026?",
        answer:
          "Yes. AP World History is a fully digital exam — MCQs and typed FRQs (SAQ, DBQ, LEQ) are completed in Bluebook.",
      },
    ],
  },
  {
    slug: "ap-english-language",
    name: "AP English Language",
    shortName: "AP Lang",
    examSlug: "ap-english-language",
    mcqCount: 45,
    mcqWeight: 0.45,
    frqParts: [
      { id: "frq1", label: "Synthesis Essay", maxPoints: 6 },
      { id: "frq2", label: "Rhetorical Analysis", maxPoints: 6 },
      { id: "frq3", label: "Argument Essay", maxPoints: 6 },
    ],
    frqWeight: 0.55,
    maxComposite: 100,
    cutoffs: { 1: 0, 2: 32, 3: 48, 4: 62, 5: 75 },
    focusKeyword: "ap lang score calculator",
    seoTitle: "AP Lang Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP English Language score calculator. Essays are 55% of your score. Enter MCQ + essay points to predict your 1–5 for 2026.",
    faq: [
      {
        question: "How important are the three essays on AP Lang?",
        answer:
          "Essays account for 55% of the composite. Two strong essays can lift a mediocre MCQ section into a 4 or 5 range.",
      },
    ],
  },
  {
    slug: "ap-statistics",
    name: "AP Statistics",
    shortName: "Statistics",
    examSlug: "ap-statistics",
    mcqCount: 40,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "FRQ 1", maxPoints: 4 },
      { id: "frq2", label: "FRQ 2", maxPoints: 4 },
      { id: "frq3", label: "FRQ 3", maxPoints: 4 },
      { id: "frq4", label: "FRQ 4", maxPoints: 4 },
      { id: "frq5", label: "FRQ 5", maxPoints: 4 },
      { id: "frq6", label: "FRQ 6 (Investigative Task)", maxPoints: 4 },
    ],
    frqWeight: 0.5,
    maxComposite: 80,
    cutoffs: { 1: 0, 2: 22, 3: 34, 4: 44, 5: 52 },
    focusKeyword: "ap statistics score calculator",
    seoTitle: "AP Statistics Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Statistics score calculator for 2026. 40 MCQs + 6 FRQs, 50/50 weighting. Predict your 1–5 score, then practice with a full exam.",
    faq: [
      {
        question: "Is the Investigative Task hard to score on?",
        answer:
          "FRQ 6 often separates 4s from 5s. Show every step — context, conditions, mechanics, and conclusion — for partial credit.",
      },
    ],
  },
];

export function getScoreCalculatorExam(slug: string): ScoreCalculatorExam | undefined {
  return SCORE_CALCULATOR_EXAMS.find((e) => e.slug === slug);
}

export function computeCompositeScore(
  exam: ScoreCalculatorExam,
  mcqCorrect: number,
  frqPoints: Record<string, number>,
): number {
  const mcqRaw = Math.min(Math.max(0, mcqCorrect), exam.mcqCount);
  const mcqScaled = (mcqRaw / exam.mcqCount) * exam.mcqWeight * exam.maxComposite;

  const frqMax = exam.frqParts.reduce((sum, p) => sum + p.maxPoints, 0);
  let frqRaw = 0;
  for (const part of exam.frqParts) {
    frqRaw += Math.min(Math.max(0, frqPoints[part.id] ?? 0), part.maxPoints);
  }
  const frqScaled = frqMax > 0 ? (frqRaw / frqMax) * exam.frqWeight * exam.maxComposite : 0;

  return Math.round(mcqScaled + frqScaled);
}

export function compositeToApScore(exam: ScoreCalculatorExam, composite: number): ApScore {
  if (composite >= exam.cutoffs[5]) return 5;
  if (composite >= exam.cutoffs[4]) return 4;
  if (composite >= exam.cutoffs[3]) return 3;
  if (composite >= exam.cutoffs[2]) return 2;
  return 1;
}

export function buildMcqPresets(max: number): number[] {
  if (max <= 0) return [0];
  const raw = [0, 0.5, 0.65, 0.75, 0.85, 1].map((p) => Math.round(max * p));
  return [...new Set(raw)].sort((a, b) => a - b);
}

export function buildFaqJsonLdForCalculator(
  exam: ScoreCalculatorExam,
  pageUrl: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: exam.faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
  };
}
