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
  /** Share of total exam score (0–1). When set, overrides proportional FRQ weighting for this part. */
  weight?: number;
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
      { id: "frq3", label: "FRQ 3 (Long)", maxPoints: 10 },
      { id: "frq4", label: "FRQ 4 (Short)", maxPoints: 4 },
      { id: "frq5", label: "FRQ 5 (Short)", maxPoints: 4 },
      { id: "frq6", label: "FRQ 6 (Short)", maxPoints: 4 },
      { id: "frq7", label: "FRQ 7 (Short)", maxPoints: 4 },
    ],
    frqWeight: 0.5,
    maxComposite: 106,
    cutoffs: { 1: 0, 2: 38, 3: 56, 4: 70, 5: 82 },
    focusKeyword: "ap chemistry score calculator",
    seoTitle: "AP Chemistry Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Chemistry score calculator for 2026. 60 MCQs + 7 FRQs (3 long, 4 short). Enter practice points to predict your AP score using official weights.",
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
    mcqCount: 40,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "FRQ 1: Mathematical Routines", maxPoints: 10 },
      { id: "frq2", label: "FRQ 2: Translation Between Representations", maxPoints: 12 },
      { id: "frq3", label: "FRQ 3: Experimental Design and Analysis", maxPoints: 10 },
      { id: "frq4", label: "FRQ 4: Qualitative/Quantitative Translation", maxPoints: 8 },
    ],
    frqWeight: 0.5,
    maxComposite: 80,
    cutoffs: { 1: 0, 2: 26, 3: 38, 4: 50, 5: 58 },
    focusKeyword: "ap physics 1 score calculator",
    seoTitle: "AP Physics 1 Score Calculator 2026 (Free)",
    metaDescription:
      "Predict your AP Physics 1 score from 40 MCQs and 4 FRQs. Free 2026 calculator with official 50/50 weights (10/12/10/8 FRQ points). Practice next on our tests.",
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
      { id: "saq", label: "SAQs (combined)", maxPoints: 9, weight: 0.2 },
      { id: "dbq", label: "DBQ", maxPoints: 7, weight: 0.25 },
      { id: "leq", label: "LEQ", maxPoints: 6, weight: 0.15 },
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
      { id: "saq", label: "SAQs (combined)", maxPoints: 9, weight: 0.2 },
      { id: "dbq", label: "DBQ", maxPoints: 7, weight: 0.25 },
      { id: "leq", label: "LEQ", maxPoints: 6, weight: 0.15 },
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
      { id: "frq1", label: "FRQ 1", maxPoints: 4, weight: 0.0375 },
      { id: "frq2", label: "FRQ 2", maxPoints: 4, weight: 0.0375 },
      { id: "frq3", label: "FRQ 3", maxPoints: 4, weight: 0.0375 },
      { id: "frq4", label: "FRQ 4", maxPoints: 4, weight: 0.0375 },
      { id: "frq5", label: "FRQ 5", maxPoints: 4, weight: 0.0375 },
      { id: "frq6", label: "FRQ 6 (Investigative Task)", maxPoints: 4, weight: 0.125 },
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
  {
    slug: "ap-csa",
    name: "AP Computer Science A",
    shortName: "CSA",
    examSlug: "ap-csa",
    mcqCount: 40,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "FRQ 1: Methods and Control Structures", maxPoints: 9 },
      { id: "frq2", label: "FRQ 2: Class Design", maxPoints: 9 },
      { id: "frq3", label: "FRQ 3: Data Analysis with ArrayList", maxPoints: 9 },
      { id: "frq4", label: "FRQ 4: 2D Array", maxPoints: 9 },
    ],
    frqWeight: 0.5,
    maxComposite: 76,
    cutoffs: { 1: 0, 2: 26, 3: 38, 4: 50, 5: 60 },
    focusKeyword: "ap computer science a score calculator",
    seoTitle: "AP Computer Science A Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Computer Science A score calculator. Enter 40 MCQ correct and 4 FRQ points to estimate your 1–5 score. Based on official 50/50 section weights.",
    faq: [
      {
        question: "How is AP CSA scored?",
        answer:
          "The exam is 50% multiple-choice (40 questions) and 50% free-response (4 questions, 9 points each). Both sections contribute equally to your composite score.",
      },
    ],
  },
  {
    slug: "ap-csp",
    name: "AP Computer Science Principles",
    shortName: "CSP",
    examSlug: "ap-csp",
    mcqCount: 70,
    mcqWeight: 0.7,
    frqParts: [
      { id: "create", label: "Create Performance Task", maxPoints: 6 },
    ],
    frqWeight: 0.3,
    maxComposite: 100,
    cutoffs: { 1: 0, 2: 35, 3: 48, 4: 60, 5: 73 },
    focusKeyword: "ap csp score calculator",
    seoTitle: "AP CSP Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Computer Science Principles score calculator. MCQ is 70% and the Create Performance Task is 30%. Predict your 1–5 AP score for 2026.",
    faq: [
      {
        question: "Does the Create Performance Task count toward my AP score?",
        answer:
          "Yes. The Create PT is submitted during the year and scored on a 0–6 rubric. It accounts for 30% of your final AP score; MCQs are 70%.",
      },
    ],
  },
  {
    slug: "ap-microeconomics",
    name: "AP Microeconomics",
    shortName: "Micro",
    examSlug: "ap-microeconomics",
    mcqCount: 60,
    mcqWeight: 0.6667,
    frqParts: [
      { id: "frq1", label: "FRQ 1 (Long)", maxPoints: 10 },
      { id: "frq2", label: "FRQ 2 (Short)", maxPoints: 5 },
      { id: "frq3", label: "FRQ 3 (Short)", maxPoints: 5 },
    ],
    frqWeight: 0.3333,
    maxComposite: 120,
    cutoffs: { 1: 0, 2: 45, 3: 62, 4: 78, 5: 95 },
    focusKeyword: "ap microeconomics score calculator",
    seoTitle: "AP Microeconomics Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Microeconomics score calculator. 60 MCQs (67%) + 3 FRQs (33%). Estimate your 1–5 score using official section weights and past cutoffs.",
    faq: [
      {
        question: "How much do MCQs matter on AP Micro?",
        answer:
          "Multiple-choice is weighted at roughly two-thirds of the composite score. Strong graph and supply-demand MCQ performance is essential for a 4 or 5.",
      },
    ],
  },
  {
    slug: "ap-macroeconomics",
    name: "AP Macroeconomics",
    shortName: "Macro",
    examSlug: "ap-macroeconomics",
    mcqCount: 60,
    mcqWeight: 0.6667,
    frqParts: [
      { id: "frq1", label: "FRQ 1 (Long)", maxPoints: 10 },
      { id: "frq2", label: "FRQ 2 (Short)", maxPoints: 5 },
      { id: "frq3", label: "FRQ 3 (Short)", maxPoints: 5 },
    ],
    frqWeight: 0.3333,
    maxComposite: 120,
    cutoffs: { 1: 0, 2: 44, 3: 61, 4: 77, 5: 94 },
    focusKeyword: "ap macroeconomics score calculator",
    seoTitle: "AP Macroeconomics Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Macroeconomics score calculator for 2026. Enter MCQ and FRQ practice scores to predict your 1–5. Based on official 67/33 section weighting.",
    faq: [
      {
        question: "Is AP Macro scored the same as AP Micro?",
        answer:
          "Yes. Both use 60 MCQs at 67% and three FRQs (10+5+5 points) at 33%. Content differs, but the scoring structure is identical.",
      },
    ],
  },
  {
    slug: "ap-physics-2",
    name: "AP Physics 2",
    shortName: "Physics 2",
    examSlug: "ap-physics-2",
    mcqCount: 40,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "FRQ 1: Mathematical Routines", maxPoints: 10 },
      { id: "frq2", label: "FRQ 2: Translation Between Representations", maxPoints: 12 },
      { id: "frq3", label: "FRQ 3: Experimental Design and Analysis", maxPoints: 10 },
      { id: "frq4", label: "FRQ 4: Qualitative/Quantitative Translation", maxPoints: 8 },
    ],
    frqWeight: 0.5,
    maxComposite: 80,
    cutoffs: { 1: 0, 2: 25, 3: 38, 4: 51, 5: 60 },
    focusKeyword: "ap physics 2 score calculator",
    seoTitle: "AP Physics 2 Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Physics 2 score calculator. 40 MCQs + 4 FRQs (10/12/10/8 points), 50/50 weighting. Predict your 1–5 score from practice results.",
    faq: [
      {
        question: "What changed on the AP Physics 2 exam format?",
        answer:
          "The 2025 exam uses 40 multiple-choice questions and four free-response questions in a hybrid digital format, with MCQ and FRQ each worth 50% of the score.",
      },
    ],
  },
  {
    slug: "ap-physics-c-mechanics",
    name: "AP Physics C: Mechanics",
    shortName: "Physics C Mech",
    examSlug: "ap-physics-c-mechanics",
    mcqCount: 40,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "FRQ 1 (Mathematical Routines)", maxPoints: 10 },
      { id: "frq2", label: "FRQ 2 (Translation Between Representations)", maxPoints: 12 },
      { id: "frq3", label: "FRQ 3 (Experimental Design)", maxPoints: 10 },
      { id: "frq4", label: "FRQ 4 (Qualitative/Quantitative Translation)", maxPoints: 8 },
    ],
    frqWeight: 0.5,
    maxComposite: 80,
    cutoffs: { 1: 0, 2: 26, 3: 36, 4: 48, 5: 58 },
    focusKeyword: "ap physics c mechanics score calculator",
    seoTitle: "AP Physics C: Mechanics Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Physics C Mechanics score calculator. 40 MCQs + 4 FRQs, 50/50 weighting. Estimate your 1–5 score using official College Board section weights.",
    faq: [
      {
        question: "Do I need calculus for AP Physics C: Mechanics FRQs?",
        answer:
          "Yes. Physics C is calculus-based. FRQs require derivatives and integrals for full credit on kinematics, rotation, and energy problems.",
      },
    ],
  },
  {
    slug: "ap-physics-c-em",
    name: "AP Physics C: Electricity & Magnetism",
    shortName: "Physics C E&M",
    examSlug: "ap-physics-c-em",
    mcqCount: 40,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "FRQ 1 (Mathematical Routines)", maxPoints: 10 },
      { id: "frq2", label: "FRQ 2 (Translation Between Representations)", maxPoints: 12 },
      { id: "frq3", label: "FRQ 3 (Experimental Design)", maxPoints: 10 },
      { id: "frq4", label: "FRQ 4 (Qualitative/Quantitative Translation)", maxPoints: 8 },
    ],
    frqWeight: 0.5,
    maxComposite: 80,
    cutoffs: { 1: 0, 2: 25, 3: 35, 4: 47, 5: 57 },
    focusKeyword: "ap physics c em score calculator",
    seoTitle: "AP Physics C: E&M Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Physics C Electricity & Magnetism score calculator. Enter MCQ and FRQ points to predict your 1–5 score for 2026.",
    faq: [
      {
        question: "Is Physics C E&M harder to score than Mechanics?",
        answer:
          "E&M historically has slightly lower pass rates. Both use the same 40 MCQ / 4 FRQ structure with 50/50 weighting, but E&M content is often considered more challenging.",
      },
    ],
  },
  {
    slug: "ap-environmental-science",
    name: "AP Environmental Science",
    shortName: "ES",
    examSlug: "ap-environmental-science",
    mcqCount: 80,
    mcqWeight: 0.6,
    frqParts: [
      { id: "frq1", label: "FRQ 1 (Design an Investigation)", maxPoints: 10 },
      { id: "frq2", label: "FRQ 2 (Analyze an Environmental Problem)", maxPoints: 10 },
      { id: "frq3", label: "FRQ 3 (Analyze an Environmental Problem with Calculation)", maxPoints: 10 },
    ],
    frqWeight: 0.4,
    maxComposite: 150,
    cutoffs: { 1: 0, 2: 52, 3: 72, 4: 92, 5: 110 },
    focusKeyword: "ap environmental science score calculator",
    seoTitle: "AP Environmental Science Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Environmental Science score calculator. 80 MCQs (60%) + 3 FRQs (40%). Predict your 1–5 score, then practice with a full Bluebook-style test.",
    faq: [
      {
        question: "How important are FRQs on AP Environmental Science?",
        answer:
          "FRQs account for 40% of your composite. Each of the three questions is worth 10 points and tests data analysis, experimental design, and problem-solving.",
      },
    ],
  },
  {
    slug: "ap-human-geography",
    name: "AP Human Geography",
    shortName: "Human Geo",
    examSlug: "ap-human-geography",
    mcqCount: 60,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "FRQ 1", maxPoints: 7 },
      { id: "frq2", label: "FRQ 2", maxPoints: 7 },
      { id: "frq3", label: "FRQ 3", maxPoints: 7 },
    ],
    frqWeight: 0.5,
    maxComposite: 120,
    cutoffs: { 1: 0, 2: 42, 3: 58, 4: 75, 5: 90 },
    focusKeyword: "ap human geography score calculator",
    seoTitle: "AP Human Geography Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Human Geography score calculator. 60 MCQs + 3 FRQs, 50/50 weighting. Estimate your 1–5 AP score from practice test results.",
    faq: [
      {
        question: "Is AP Human Geography a good first AP class?",
        answer:
          "Many students take Human Geo in 9th or 10th grade. The exam is fully digital with typed FRQs. MCQ and FRQ each count for half your score.",
      },
    ],
  },
  {
    slug: "ap-english-literature",
    name: "AP English Literature",
    shortName: "AP Lit",
    examSlug: "ap-english-literature",
    mcqCount: 55,
    mcqWeight: 0.45,
    frqParts: [
      { id: "frq1", label: "Poetry Analysis Essay", maxPoints: 6 },
      { id: "frq2", label: "Prose Fiction Analysis Essay", maxPoints: 6 },
      { id: "frq3", label: "Literary Argument Essay", maxPoints: 6 },
    ],
    frqWeight: 0.55,
    maxComposite: 100,
    cutoffs: { 1: 0, 2: 32, 3: 48, 4: 62, 5: 75 },
    focusKeyword: "ap lit score calculator",
    seoTitle: "AP English Literature Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP English Literature score calculator. Essays are 55% of your score. Enter MCQ + essay points to predict your 1–5 for 2026.",
    faq: [
      {
        question: "How are AP Lit essays scored?",
        answer:
          "Each of the three essays is scored 0–6 using a rubric focused on thesis, evidence, and literary analysis. Essays account for 55% of the composite score.",
      },
    ],
  },
  {
    slug: "ap-european-history",
    name: "AP European History",
    shortName: "AP Euro",
    examSlug: "ap-european-history",
    mcqCount: 55,
    mcqWeight: 0.4,
    frqParts: [
      { id: "saq", label: "SAQs (combined)", maxPoints: 9, weight: 0.2 },
      { id: "dbq", label: "DBQ", maxPoints: 7, weight: 0.25 },
      { id: "leq", label: "LEQ", maxPoints: 6, weight: 0.15 },
    ],
    frqWeight: 0.6,
    maxComposite: 130,
    cutoffs: { 1: 0, 2: 44, 3: 64, 4: 84, 5: 98 },
    focusKeyword: "ap european history score calculator",
    seoTitle: "AP European History Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP European History score calculator. MCQ 40%, essays 60%. Estimate your 1–5 score from practice SAQ, DBQ, and LEQ results.",
    faq: [
      {
        question: "Are AP Euro FRQs typed in 2026?",
        answer:
          "Yes. AP European History is a fully digital exam — MCQs and typed FRQs (SAQ, DBQ, LEQ) are completed in Bluebook.",
      },
    ],
  },
  {
    slug: "ap-us-government",
    name: "AP U.S. Government",
    shortName: "AP Gov",
    examSlug: "ap-us-government",
    mcqCount: 55,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "Concept Application", maxPoints: 3, weight: 0.125 },
      { id: "frq2", label: "Quantitative Analysis", maxPoints: 4, weight: 0.125 },
      { id: "frq3", label: "SCOTUS Comparison", maxPoints: 4, weight: 0.125 },
      { id: "frq4", label: "Argument Essay", maxPoints: 6, weight: 0.125 },
    ],
    frqWeight: 0.5,
    maxComposite: 120,
    cutoffs: { 1: 0, 2: 42, 3: 57, 4: 75, 5: 92 },
    focusKeyword: "ap gov score calculator",
    seoTitle: "AP U.S. Government Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP U.S. Government score calculator. 55 MCQs + 4 FRQs, 50/50 weighting. Predict your 1–5 score from practice test results.",
    faq: [
      {
        question: "Which AP Gov FRQ is worth the most points?",
        answer:
          "The Argument Essay (FRQ 4) is worth 6 raw points — the highest single FRQ. All four FRQs together contribute 50% of your composite score.",
      },
    ],
  },
  {
    slug: "ap-comparative-government",
    name: "AP Comparative Government",
    shortName: "Comp Gov",
    examSlug: "ap-comparative-government",
    mcqCount: 55,
    mcqWeight: 0.5,
    frqParts: [
      { id: "frq1", label: "Conceptual Analysis", maxPoints: 4, weight: 0.125 },
      { id: "frq2", label: "Quantitative Analysis", maxPoints: 5, weight: 0.125 },
      { id: "frq3", label: "Comparative Analysis", maxPoints: 4, weight: 0.125 },
      { id: "frq4", label: "Argument Essay", maxPoints: 5, weight: 0.125 },
    ],
    frqWeight: 0.5,
    maxComposite: 120,
    cutoffs: { 1: 0, 2: 40, 3: 56, 4: 74, 5: 90 },
    focusKeyword: "ap comparative government score calculator",
    seoTitle: "AP Comparative Government Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Comparative Government score calculator. 55 MCQs + 4 FRQs (4+5+5+5 points), 50/50 weighting. Estimate your 1–5 AP score for 2026.",
    faq: [
      {
        question: "How is AP Comparative Government scored?",
        answer:
          "The exam uses 55 multiple-choice questions (50%) and four free-response questions totaling 19 raw points (50%): Conceptual Analysis (4), Quantitative Analysis (5), Comparative Analysis (4), and Argument Essay (5).",
      },
    ],
  },
  {
    slug: "ap-precalculus",
    name: "AP Precalculus",
    shortName: "Precalc",
    examSlug: "ap-precalculus",
    mcqCount: 40,
    mcqWeight: 0.625,
    frqParts: [
      { id: "frq1", label: "FRQ 1", maxPoints: 6 },
      { id: "frq2", label: "FRQ 2", maxPoints: 6 },
      { id: "frq3", label: "FRQ 3", maxPoints: 6 },
      { id: "frq4", label: "FRQ 4", maxPoints: 6 },
    ],
    frqWeight: 0.375,
    maxComposite: 100,
    cutoffs: { 1: 0, 2: 30, 3: 42, 4: 54, 5: 67 },
    focusKeyword: "ap precalculus score calculator",
    seoTitle: "AP Precalculus Score Calculator 2026 (Free)",
    metaDescription:
      "Free AP Precalculus score calculator. 40 MCQs (62.5%) + 4 FRQs (37.5%). Predict your 1–5 score from practice results.",
    faq: [
      {
        question: "Which units are tested on the AP Precalculus exam?",
        answer:
          "The AP Exam covers Units 1–3 only (polynomial/rational, exponential/logarithmic, and trigonometric/polar functions). Unit 4 is not on the exam.",
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

  const hasPartWeights = exam.frqParts.some((p) => p.weight != null);

  let frqScaled = 0;
  if (hasPartWeights) {
    for (const part of exam.frqParts) {
      const raw = Math.min(Math.max(0, frqPoints[part.id] ?? 0), part.maxPoints);
      const partWeight = part.weight ?? 0;
      if (part.maxPoints > 0 && partWeight > 0) {
        frqScaled += (raw / part.maxPoints) * partWeight * exam.maxComposite;
      }
    }
  } else {
    const frqMax = exam.frqParts.reduce((sum, p) => sum + p.maxPoints, 0);
    let frqRaw = 0;
    for (const part of exam.frqParts) {
      frqRaw += Math.min(Math.max(0, frqPoints[part.id] ?? 0), part.maxPoints);
    }
    frqScaled = frqMax > 0 ? (frqRaw / frqMax) * exam.frqWeight * exam.maxComposite : 0;
  }

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
