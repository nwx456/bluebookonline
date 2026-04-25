import { SUBJECT_KEYS, type SubjectKey } from "@/lib/gemini-prompts";

export type SubjectCategory = "math" | "science" | "history" | "english" | "social" | "cs" | "economics";

export type ExamMode = "fully-digital" | "hybrid-digital";

export interface ExamSection {
  label: string;
  questionCount: number;
  durationMin: number;
  weightPct: number;
  notes?: string;
}

export interface CourseUnit {
  name: string;
  weight?: string;
}

export interface SubjectMeta {
  key: SubjectKey;
  slug: string;
  shortName: string;
  fullName: string;
  category: SubjectCategory;
  examFormat: {
    mcqCount: number;
    durationMin: number;
    sections: string;
    totalDurationMin?: number;
    examMode?: ExamMode;
    calculatorPolicy?: string;
    referenceMaterials?: string;
    sectionsDetail?: ExamSection[];
  };
  units?: CourseUnit[];
  topics: string[];
  description: string;
  intro: string;
  faqs: { q: string; a: string }[];
  relatedBlogSlug?: string;
  examDate2026?: string;
}

export const SUBJECT_META: Record<SubjectKey, SubjectMeta> = {
  AP_CSA: {
    key: "AP_CSA",
    slug: "ap-csa",
    shortName: "Computer Science A",
    fullName: "AP Computer Science A",
    category: "cs",
    examFormat: {
      mcqCount: 42,
      durationMin: 90,
      sections: "Section 1 (MCQ, 42Q, 55%) + Section 2 (FRQ, 4Q, 45%)",
      totalDurationMin: 180,
      examMode: "fully-digital",
      calculatorPolicy: "No calculator.",
      referenceMaterials: "Java Quick Reference (Bluebook reference panel) provided.",
      sectionsDetail: [
        { label: "Section 1: Multiple Choice", questionCount: 42, durationMin: 90, weightPct: 55 },
        {
          label: "Section 2: Free Response (Java code)",
          questionCount: 4,
          durationMin: 90,
          weightPct: 45,
          notes: "Q1 Methods/Control Structures, Q2 Class Design, Q3 Data Analysis with ArrayList, Q4 2D Array.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Primitive Types", weight: "2.5-5%" },
      { name: "Unit 2: Using Objects", weight: "5-7.5%" },
      { name: "Unit 3: Boolean Expressions and if Statements", weight: "15-17.5%" },
      { name: "Unit 4: Iteration", weight: "17.5-22.5%" },
      { name: "Unit 5: Writing Classes", weight: "5-7.5%" },
      { name: "Unit 6: Array", weight: "10-15%" },
      { name: "Unit 7: ArrayList", weight: "2.5-7.5%" },
      { name: "Unit 8: 2D Array", weight: "7.5-10%" },
      { name: "Unit 9: Inheritance", weight: "5-10%" },
      { name: "Unit 10: Recursion", weight: "5-7.5%" },
    ],
    topics: [
      "Primitive Types",
      "Using Objects",
      "Boolean Expressions and if Statements",
      "Iteration",
      "Writing Classes",
      "Array and ArrayList",
      "2D Array",
      "Inheritance",
      "Recursion",
    ],
    description:
      "Practice AP Computer Science A (Java) digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring.",
    intro:
      "AP Computer Science A teaches Java programming with a focus on object-oriented design. The May 2026 exam is fully digital in the Bluebook app: 42 multiple-choice questions (55% of score) and 4 free-response Java coding questions (Methods/Control Structures, Class Design, ArrayList, 2D Array — 45% of score) in 3 hours total.",
    faqs: [
      {
        q: "How long is the AP CSA exam in 2026?",
        a: "The exam is 3 hours total — Section 1 (42 MCQs, 55%) and Section 2 (4 FRQs, 45%). Both sections are completed in the Bluebook app; no paper booklet for FRQs.",
      },
      {
        q: "Is AP CSA a hard exam?",
        a: "AP CSA has a moderate difficulty curve. The pass rate sits around 65 to 70 percent. The hardest FRQs are usually Q3 (ArrayList) and Q4 (2D Array). Practicing with timed code-tracing and code-writing problems is the most effective preparation.",
      },
      {
        q: "Do I need prior Java experience?",
        a: "No prior Java experience is required, but a year of programming in any language helps. The exam covers Java syntax in depth using a defined Java subset, so daily practice with the Java Quick Reference is essential.",
      },
      {
        q: "Are the FRQs typed in Bluebook in 2026?",
        a: "Yes. AP CSA is fully digital, so you type all four free-response Java code answers directly in the Bluebook app. There is no paper booklet for FRQs.",
      },
    ],
    examDate2026: "Fri, May 15, 2026 (12 PM Local)",
  },
  AP_CSP: {
    key: "AP_CSP",
    slug: "ap-csp",
    shortName: "Computer Science Principles",
    fullName: "AP Computer Science Principles",
    category: "cs",
    examFormat: {
      mcqCount: 70,
      durationMin: 120,
      sections: "Section I (MCQ, 70%) + Section II (Written Response + Create PT, 30%)",
      totalDurationMin: 180,
      examMode: "fully-digital",
      calculatorPolicy: "No calculator.",
      referenceMaterials:
        "Personalized Project Reference (student-authored, submitted via AP Digital Portfolio) is available during the written-response questions on exam day.",
      sectionsDetail: [
        {
          label: "Section I: End-of-Course Multiple Choice",
          questionCount: 70,
          durationMin: 120,
          weightPct: 70,
          notes:
            "57 single-select + 5 reading-passage (computing innovation) + 8 multiple-select (choose 2 answers).",
        },
        {
          label: "Section II: Written Response + Create Performance Task",
          questionCount: 2,
          durationMin: 60,
          weightPct: 30,
          notes:
            "2 written-response prompts (4 sub-prompts) referencing your Personalized Project Reference, plus the through-course Create PT (program code, video, PPR — 9 hours in class, due Apr 30, 2026).",
        },
      ],
    },
    units: [
      { name: "Big Idea 1: Creative Development", weight: "10-13%" },
      { name: "Big Idea 2: Data", weight: "17-22%" },
      { name: "Big Idea 3: Algorithms and Programming", weight: "30-35%" },
      { name: "Big Idea 4: Computer Systems and Networks", weight: "11-15%" },
      { name: "Big Idea 5: Impact of Computing", weight: "21-26%" },
    ],
    topics: [
      "Creative Development",
      "Data",
      "Algorithms and Programming",
      "Computer Systems and Networks",
      "Impact of Computing",
    ],
    description:
      "Practice AP Computer Science Principles digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring.",
    intro:
      "AP Computer Science Principles introduces the foundational ideas of computing: how data is represented, how the internet works, and how programs solve problems. The 2026 exam is fully digital — 70 MCQs in 120 minutes (70%) and two written-response prompts in 60 minutes (30%) tied to your Personalized Project Reference.",
    faqs: [
      {
        q: "Is AP CSP easier than AP CSA?",
        a: "Yes. AP CSP is broader and conceptual, while AP CSA is deep in Java syntax. CSP has one of the highest pass rates among AP exams.",
      },
      {
        q: "Does AP CSP require coding?",
        a: "Some coding is required, but the exam uses pseudocode rather than a specific language. The Create Performance Task is completed in class with any language you choose.",
      },
      {
        q: "How long is the AP CSP exam?",
        a: "The end-of-course exam is 3 hours total — 70 multiple-choice questions in 120 minutes plus a 60-minute written-response section that uses your Personalized Project Reference. The Create PT is completed in class before the exam (due Apr 30, 2026).",
      },
    ],
    examDate2026: "Thu, May 14, 2026 (12 PM Local). Create PT due Thu, Apr 30, 2026.",
  },
  AP_MICROECONOMICS: {
    key: "AP_MICROECONOMICS",
    slug: "ap-microeconomics",
    shortName: "Microeconomics",
    fullName: "AP Microeconomics",
    category: "economics",
    examFormat: {
      mcqCount: 60,
      durationMin: 70,
      sections: "Section I (MCQ, 60Q, 66%) + Section II (FRQ, 3Q, 33%)",
      totalDurationMin: 130,
      examMode: "hybrid-digital",
      calculatorPolicy: "A four-function calculator is permitted on both sections.",
      referenceMaterials: "No formula sheet — students must memorize key formulas (elasticity, MR, etc.).",
      sectionsDetail: [
        { label: "Section I: Multiple Choice", questionCount: 60, durationMin: 70, weightPct: 66 },
        {
          label: "Section II: Free Response (handwritten)",
          questionCount: 3,
          durationMin: 60,
          weightPct: 33,
          notes:
            "Includes a 10-minute reading period. 1 long FRQ (50% of section) + 2 short FRQs (25% each). Answers handwritten in paper booklet.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Basic Economic Concepts", weight: "12-15%" },
      { name: "Unit 2: Supply and Demand", weight: "20-25%" },
      { name: "Unit 3: Production, Cost, and the Perfect Competition Model", weight: "22-25%" },
      { name: "Unit 4: Imperfect Competition", weight: "15-22%" },
      { name: "Unit 5: Factor Markets", weight: "10-13%" },
      { name: "Unit 6: Market Failure and the Role of Government", weight: "8-13%" },
    ],
    topics: [
      "Basic Economic Concepts",
      "Supply and Demand",
      "Production, Cost, and Perfect Competition",
      "Imperfect Competition",
      "Factor Markets",
      "Market Failure and the Role of Government",
    ],
    description:
      "Practice AP Microeconomics digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on supply, demand, and market structure topics.",
    intro:
      "AP Microeconomics studies how individuals, households, and firms make decisions and how those decisions interact in markets. The 2026 exam is hybrid digital — 60 MCQs in Bluebook (66%) and 3 handwritten FRQs in 60 minutes including a 10-minute reading period (33%). A four-function calculator is permitted.",
    faqs: [
      {
        q: "Is graph reading important for AP Microeconomics?",
        a: "Yes, very. Most multiple-choice questions and every free-response question involve interpreting or drawing supply-demand, cost, or market-structure graphs.",
      },
      {
        q: "Should I take Micro or Macro first?",
        a: "Either order works. Many schools teach Microeconomics first because it builds the foundational concepts (supply, demand, elasticity) that Macroeconomics extends.",
      },
      {
        q: "What is the most missed topic on the exam?",
        a: "Factor markets and perfectly competitive labor markets are the most missed. Drawing the side-by-side product market and labor market graph correctly is high-yield practice.",
      },
      {
        q: "Are calculators allowed in 2026?",
        a: "Yes. A four-function calculator is permitted on both the multiple-choice and free-response sections (this changed in 2022 and remains in effect for the 2026 hybrid digital exam).",
      },
    ],
    examDate2026: "Mon, May 4, 2026 (12 PM Local)",
  },
  AP_MACROECONOMICS: {
    key: "AP_MACROECONOMICS",
    slug: "ap-macroeconomics",
    shortName: "Macroeconomics",
    fullName: "AP Macroeconomics",
    category: "economics",
    examFormat: {
      mcqCount: 60,
      durationMin: 70,
      sections: "Section I (MCQ, 60Q, 66%) + Section II (FRQ, 3Q, 33%)",
      totalDurationMin: 130,
      examMode: "hybrid-digital",
      calculatorPolicy: "A four-function calculator is permitted on both sections.",
      referenceMaterials: "No formula sheet — students must memorize key formulas (MPC/MPS multipliers, etc.).",
      sectionsDetail: [
        { label: "Section I: Multiple Choice", questionCount: 60, durationMin: 70, weightPct: 66 },
        {
          label: "Section II: Free Response (handwritten)",
          questionCount: 3,
          durationMin: 60,
          weightPct: 33,
          notes:
            "Includes a 10-minute reading period. 1 long FRQ (50% of section) + 2 short FRQs (25% each). Answers handwritten in paper booklet.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Basic Economic Concepts", weight: "5-10%" },
      { name: "Unit 2: Economic Indicators and the Business Cycle", weight: "12-17%" },
      { name: "Unit 3: National Income and Price Determination", weight: "17-27%" },
      { name: "Unit 4: Financial Sector", weight: "15-23%" },
      { name: "Unit 5: Long-Run Consequences of Stabilization Policies", weight: "20-30%" },
      { name: "Unit 6: Open Economy — International Trade and Finance", weight: "10-13%" },
    ],
    topics: [
      "Basic Economic Concepts",
      "Economic Indicators and the Business Cycle",
      "National Income and Price Determination",
      "Financial Sector",
      "Long-Run Consequences of Stabilization Policies",
      "Open Economy: International Trade and Finance",
    ],
    description:
      "Practice AP Macroeconomics digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on GDP, inflation, and monetary policy.",
    intro:
      "AP Macroeconomics looks at the economy as a whole: GDP, inflation, unemployment, fiscal policy, and the role of central banks. The 2026 exam is hybrid digital — 60 MCQs in Bluebook (66%) and 3 handwritten FRQs in 60 minutes including a 10-minute reading period (33%). A four-function calculator is permitted.",
    faqs: [
      {
        q: "What is the hardest unit in AP Macroeconomics?",
        a: "Open economy international trade and finance is consistently the lowest-scoring unit. Practice with foreign exchange graphs and the relationship between interest rates, capital flows, and exchange rates.",
      },
      {
        q: "How important is the loanable funds market?",
        a: "Very. It almost always appears on the free-response section. Master the difference between the money market (monetary policy) and the loanable funds market (real interest rates and saving).",
      },
      {
        q: "Can I take Macroeconomics without taking Microeconomics?",
        a: "Yes. Macro stands alone, though basic supply-demand from Micro helps. Many students take only Macro for college credit.",
      },
      {
        q: "Are calculators allowed in 2026?",
        a: "Yes. A four-function calculator is permitted on both sections (this policy was added in 2022 and remains in effect for the 2026 hybrid digital exam).",
      },
    ],
    examDate2026: "Fri, May 8, 2026 (12 PM Local)",
  },
  AP_PSYCHOLOGY: {
    key: "AP_PSYCHOLOGY",
    slug: "ap-psychology",
    shortName: "Psychology",
    fullName: "AP Psychology",
    category: "social",
    examFormat: {
      mcqCount: 75,
      durationMin: 90,
      sections: "Section I (MCQ, 75Q, 1hr 30min, 67%) + Section II (FRQ: AAQ + EBQ, 2Q, 1hr 10min, 33%)",
      totalDurationMin: 160,
      examMode: "fully-digital",
      calculatorPolicy: "No calculator required.",
      referenceMaterials: "No reference sheet.",
      sectionsDetail: [
        { label: "Section I (MCQ)", questionCount: 75, durationMin: 90, weightPct: 67 },
        {
          label: "Section II Q1: Article Analysis Question (AAQ)",
          questionCount: 1,
          durationMin: 25,
          weightPct: 16.5,
          notes: "Analyze a research article and apply psychological concepts.",
        },
        {
          label: "Section II Q2: Evidence-Based Question (EBQ)",
          questionCount: 1,
          durationMin: 45,
          weightPct: 16.5,
          notes: "Develop and justify an evidence-based psychological argument.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Biological Bases of Behavior", weight: "15-25%" },
      { name: "Unit 2: Cognition", weight: "15-25%" },
      { name: "Unit 3: Development and Learning", weight: "15-25%" },
      { name: "Unit 4: Social Psychology and Personality", weight: "15-25%" },
      { name: "Unit 5: Mental and Physical Health", weight: "15-25%" },
    ],
    topics: [
      "Biological Bases of Behavior",
      "Cognition",
      "Development and Learning",
      "Social Psychology and Personality",
      "Mental and Physical Health",
    ],
    description:
      "Practice AP Psychology digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring across all five units of the redesigned 2024+ course.",
    intro:
      "AP Psychology surveys the science of mind and behavior. The redesigned 2024+ course is organized into five equally-weighted units (15-25% each) and the May 2026 exam is fully digital in the Bluebook app. Section II uses two new question types — the Article Analysis Question (AAQ) and the Evidence-Based Question (EBQ) — instead of the traditional FRQs from pre-2024 exams.",
    faqs: [
      {
        q: "How long is the AP Psychology exam in 2026?",
        a: "The exam is 2 hours 40 minutes total: 90 minutes for 75 multiple-choice questions (67% of score) and 70 minutes for 2 free-response questions (33% of score). The exam is fully digital in the Bluebook app.",
      },
      {
        q: "Did AP Psychology change recently?",
        a: "Yes. Starting in the 2024-2025 school year, AP Psychology was redesigned with five equally weighted units and a new free-response format: the Article Analysis Question (AAQ) and Evidence-Based Question (EBQ). The pre-2024 format with two FRQs is no longer used.",
      },
      {
        q: "What is the difference between the AAQ and EBQ?",
        a: "The AAQ presents a brief research article and asks you to identify methodology, apply concepts, and evaluate research design (~25 minutes). The EBQ asks you to construct an argument supported by 3 provided sources plus your own knowledge of psychology (~45 minutes).",
      },
      {
        q: "How many terms do I need to memorize for AP Psychology?",
        a: "Roughly 300 to 400 key terms span the five units. Flashcards and active recall outperform passive rereading. The 2024+ exam emphasizes application over recognition, so practice using terms in context.",
      },
    ],
    relatedBlogSlug: "ap-psychology-complete-guide",
    examDate2026: "Tue, May 12, 2026 (12 PM Local)",
  },
  AP_STATISTICS: {
    key: "AP_STATISTICS",
    slug: "ap-statistics",
    shortName: "Statistics",
    fullName: "AP Statistics",
    category: "math",
    examFormat: {
      mcqCount: 40,
      durationMin: 90,
      sections: "Section 1 (MCQ, 40Q, 1hr 30min, 50%) + Section 2 (FRQ, 6Q, 1hr 30min, 50%)",
      totalDurationMin: 180,
      examMode: "hybrid-digital",
      calculatorPolicy: "Graphing calculator required for both sections.",
      referenceMaterials: "Statistics formula sheet and tables (z, t, chi-square) provided.",
      sectionsDetail: [
        { label: "Section 1 (MCQ)", questionCount: 40, durationMin: 90, weightPct: 50 },
        {
          label: "Section 2 Part A (FRQ 1-5)",
          questionCount: 5,
          durationMin: 65,
          weightPct: 37.5,
          notes: "Recommended ~13 min/question. Topics: collecting data, exploring data, probability/sampling distributions, inference, multi-skill.",
        },
        {
          label: "Section 2 Part B: Investigative Task (FRQ 6)",
          questionCount: 1,
          durationMin: 25,
          weightPct: 12.5,
          notes: "Applies multiple skills to a novel context.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Exploring One-Variable Data", weight: "15-23%" },
      { name: "Unit 2: Exploring Two-Variable Data", weight: "5-7%" },
      { name: "Unit 3: Collecting Data", weight: "12-15%" },
      { name: "Unit 4: Probability, Random Variables, and Probability Distributions", weight: "10-20%" },
      { name: "Unit 5: Sampling Distributions", weight: "7-12%" },
      { name: "Unit 6: Inference for Categorical Data: Proportions", weight: "12-15%" },
      { name: "Unit 7: Inference for Quantitative Data: Means", weight: "10-18%" },
      { name: "Unit 8: Inference for Categorical Data: Chi-Square", weight: "2-5%" },
      { name: "Unit 9: Inference for Quantitative Data: Slopes", weight: "2-5%" },
    ],
    topics: [
      "Exploring One-Variable Data",
      "Exploring Two-Variable Data",
      "Collecting Data",
      "Probability, Random Variables, and Probability Distributions",
      "Sampling Distributions",
      "Inference for Categorical Data: Proportions",
      "Inference for Quantitative Data: Means",
      "Inference for Categorical Data: Chi-Square",
      "Inference for Quantitative Data: Slopes",
    ],
    description:
      "Practice AP Statistics digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on probability, inference, and regression.",
    intro:
      "AP Statistics teaches the four big ideas of statistical reasoning: variation, distribution, inference, and modeling. The May 2026 exam is a hybrid digital exam: 40 multiple-choice questions in the Bluebook app (90 min) and 6 handwritten free-response answers in a paper booklet (90 min). Both sections allow a graphing calculator and provide a formulas + tables reference. The exam expects you to interpret calculator output and write conclusions in context.",
    faqs: [
      {
        q: "How long is the AP Statistics exam and how is it structured?",
        a: "The exam is 3 hours total: 90 minutes for 40 multiple-choice questions (50%) and 90 minutes for 6 free-response questions (50%). Section 2 splits into Part A (5 FRQs, ~13 min each, 37.5%) and Part B (1 investigative task, ~25 min, 12.5%).",
      },
      {
        q: "Do I need a calculator for the AP Statistics exam?",
        a: "Yes. A graphing calculator with statistics functions (TI-84, NumWorks, Casio fx-CG50, etc.) is required for both sections. Know how to use invNorm, tcdf, chi-square test, 1-sample/2-sample tests, and 1-Var Stats efficiently.",
      },
      {
        q: "What are the most common AP Statistics free-response topics?",
        a: "FRQ 1-2 are usually data collection (sampling, experimental design) and exploring data. FRQ 3-5 hit probability, sampling distributions, and inference (1- or 2-sample t-tests, z-tests for proportions). The investigative task at the end always combines multiple units in a novel context.",
      },
      {
        q: "Is AP Statistics harder than AP Calculus?",
        a: "They test different skills. Statistics has less algebra but heavy interpretation, conditions checking, and writing. Calculus is more procedural. Many students find Statistics easier mathematically but harder to communicate clearly — losing points for missing context, parameters, or assumption checks.",
      },
    ],
    relatedBlogSlug: "ap-statistics-complete-guide",
    examDate2026: "Thu, May 7, 2026 (12 PM Local)",
  },
  AP_BIOLOGY: {
    key: "AP_BIOLOGY",
    slug: "ap-biology",
    shortName: "Biology",
    fullName: "AP Biology",
    category: "science",
    examFormat: {
      mcqCount: 60,
      durationMin: 90,
      sections: "Section I (MCQ, 60Q, 1hr 30min, 50%) + Section II (FRQ, 6Q, 1hr 30min, 50%)",
      totalDurationMin: 180,
      examMode: "hybrid-digital",
      calculatorPolicy:
        "Four-function (with square root), scientific, or graphing calculator permitted on both sections.",
      referenceMaterials: "Equations and formulas reference sheet provided.",
      sectionsDetail: [
        { label: "Section I (MCQ)", questionCount: 60, durationMin: 90, weightPct: 50 },
        {
          label: "Section II (FRQ): 2 long + 4 short",
          questionCount: 6,
          durationMin: 90,
          weightPct: 50,
          notes: "Long Q1 = Interpreting and Evaluating Experimental Results; Long Q2 = Interpreting and Evaluating Experimental Results with Graphing.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Chemistry of Life", weight: "8-11%" },
      { name: "Unit 2: Cell Structure and Function", weight: "10-13%" },
      { name: "Unit 3: Cellular Energetics", weight: "12-16%" },
      { name: "Unit 4: Cell Communication and Cell Cycle", weight: "10-15%" },
      { name: "Unit 5: Heredity", weight: "8-11%" },
      { name: "Unit 6: Gene Expression and Regulation", weight: "12-16%" },
      { name: "Unit 7: Natural Selection", weight: "13-20%" },
      { name: "Unit 8: Ecology", weight: "10-15%" },
    ],
    topics: [
      "Chemistry of Life",
      "Cell Structure and Function",
      "Cellular Energetics",
      "Cell Communication and Cell Cycle",
      "Heredity",
      "Gene Expression and Regulation",
      "Natural Selection",
      "Ecology",
    ],
    description:
      "Practice AP Biology digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on genetics, ecology, and cellular processes.",
    intro:
      "AP Biology emphasizes scientific reasoning over memorization. The exam tests four big ideas: evolution, energetics, information storage, and systems interactions, often through experimental data interpretation. The May 2026 exam is a hybrid digital exam: 60 multiple-choice questions in the Bluebook app and 6 handwritten free-response answers (2 long + 4 short) in a paper booklet, with the equations and formulas reference sheet available throughout.",
    faqs: [
      {
        q: "How long is the AP Biology exam and how is it scored?",
        a: "The exam is 3 hours total: 90 minutes for 60 multiple-choice questions (50% of score) and 90 minutes for 6 free-response questions (2 long + 4 short, 50% of score). Long FRQs are typically worth 8-10 points each; short FRQs are worth 4 points each.",
      },
      {
        q: "How much memorization does AP Biology require?",
        a: "Less than students expect. The 2025-26 redesigned exam rewards understanding processes (photosynthesis, signal transduction, evolution) and interpreting data over rote facts. Roughly 50% of MCQs and most FRQs include diagrams, graphs, or experimental data.",
      },
      {
        q: "What is the hardest unit on the AP Biology exam?",
        a: "Cellular energetics (Unit 3, 12-16%) and gene expression regulation (Unit 6, 12-16%) are most commonly cited as difficult. Natural selection (Unit 7) is the highest-weighted unit at 13-20%, so master the Hardy-Weinberg equation, phylogenetics, and evolution mechanisms.",
      },
      {
        q: "Is AP Biology good preparation for the MCAT?",
        a: "Yes, especially for the biology and biochemistry sections. The data-interpretation focus aligns well with MCAT passage style, and the Hardy-Weinberg, kinetics, and metabolism content overlaps directly.",
      },
    ],
    relatedBlogSlug: "ap-biology-complete-guide",
    examDate2026: "Mon, May 4, 2026 (8 AM Local)",
  },
  AP_CHEMISTRY: {
    key: "AP_CHEMISTRY",
    slug: "ap-chemistry",
    shortName: "Chemistry",
    fullName: "AP Chemistry",
    category: "science",
    examFormat: {
      mcqCount: 60,
      durationMin: 90,
      sections: "Section I (MCQ, 60Q, 1hr 30min, 50%) + Section II (FRQ, 7Q, 1hr 45min, 50%)",
      totalDurationMin: 195,
      examMode: "hybrid-digital",
      calculatorPolicy:
        "Scientific or graphing calculator recommended for both sections (no calculators with QWERTY keyboards or symbolic algebra).",
      referenceMaterials: "Periodic table and formulas/constants sheet provided for both sections.",
      sectionsDetail: [
        { label: "Section I (MCQ)", questionCount: 60, durationMin: 90, weightPct: 50 },
        {
          label: "Section II (FRQ)",
          questionCount: 7,
          durationMin: 105,
          weightPct: 50,
          notes: "3 long multipart questions (10 pts each) + 4 short multipart questions (4 pts each).",
        },
      ],
    },
    units: [
      { name: "Unit 1: Atomic Structure and Properties", weight: "7-9%" },
      { name: "Unit 2: Molecular and Ionic Compound Structure and Properties", weight: "7-9%" },
      { name: "Unit 3: Intermolecular Forces and Properties", weight: "18-22%" },
      { name: "Unit 4: Chemical Reactions", weight: "7-9%" },
      { name: "Unit 5: Kinetics", weight: "7-9%" },
      { name: "Unit 6: Thermodynamics", weight: "7-9%" },
      { name: "Unit 7: Equilibrium", weight: "7-9%" },
      { name: "Unit 8: Acids and Bases", weight: "11-15%" },
      { name: "Unit 9: Applications of Thermodynamics", weight: "7-9%" },
    ],
    topics: [
      "Atomic Structure and Properties",
      "Molecular and Ionic Compound Structure and Properties",
      "Intermolecular Forces and Properties",
      "Chemical Reactions",
      "Kinetics",
      "Thermodynamics",
      "Equilibrium",
      "Acids and Bases",
      "Applications of Thermodynamics",
    ],
    description:
      "Practice AP Chemistry digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on equilibrium, kinetics, and thermodynamics.",
    intro:
      "AP Chemistry is one of the most quantitative AP science courses. The May 2026 exam is a hybrid digital exam: 60 multiple-choice questions (90 min) in the Bluebook app and 7 handwritten free-response answers — 3 long (10 points each) plus 4 short (4 points each) — in a paper booklet over 105 minutes. The periodic table and formula/constants sheet are available throughout.",
    faqs: [
      {
        q: "How long is the AP Chemistry exam and how is it scored?",
        a: "The exam is 3 hours 15 minutes total: 90 minutes for 60 multiple-choice questions (50%) and 105 minutes for 7 free-response questions (50%). Long FRQs are worth 10 points each (30 total) and short FRQs 4 points each (16 total) — 46 total FRQ points.",
      },
      {
        q: "Is AP Chemistry one of the hardest AP exams?",
        a: "Yes. AP Chemistry consistently sits among the lower pass rates (around 75% pass, but the share of 5s is one of the lowest among AP sciences). Strong algebra skills, mole-ratio fluency, and conceptual depth are all required.",
      },
      {
        q: "What is the AP Chemistry calculator policy?",
        a: "A scientific or graphing calculator is recommended on both sections. The formulas and constants sheet plus the periodic table are provided. Calculators with QWERTY keyboards or computer-algebra systems are NOT allowed.",
      },
      {
        q: "Which AP Chemistry unit gives students the most trouble?",
        a: "Equilibrium (Unit 7) and Acids and Bases (Unit 8, 11-15%) typically have the lowest scores on free-response questions. Intermolecular Forces (Unit 3, 18-22%) is the most heavily weighted unit. Practice ICE tables, Ka/Kb calculations, and buffer (Henderson-Hasselbalch) problems heavily.",
      },
    ],
    relatedBlogSlug: "ap-chemistry-complete-guide",
    examDate2026: "Tue, May 5, 2026 (8 AM Local)",
  },
  AP_PHYSICS_1: {
    key: "AP_PHYSICS_1",
    slug: "ap-physics-1",
    shortName: "Physics 1",
    fullName: "AP Physics 1: Algebra-Based",
    category: "science",
    examFormat: {
      mcqCount: 40,
      durationMin: 80,
      sections: "Section I (MCQ, 40Q, 50%) + Section II (FRQ, 4Q, 50%)",
      totalDurationMin: 180,
      examMode: "hybrid-digital",
      calculatorPolicy: "Approved scientific or graphing calculator permitted on both sections.",
      referenceMaterials: "Equations sheet and reference tables provided in Bluebook.",
      sectionsDetail: [
        {
          label: "Section I: Multiple Choice",
          questionCount: 40,
          durationMin: 80,
          weightPct: 50,
          notes: "Discrete questions and question sets with shared stimulus/data.",
        },
        {
          label: "Section II: Free Response (handwritten)",
          questionCount: 4,
          durationMin: 100,
          weightPct: 50,
          notes:
            "FRQ types: Mathematical Routines, Translation between Representations, Experimental Design and Analysis, Qualitative/Quantitative Translation. Handwritten in paper booklet.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Kinematics", weight: "10-15%" },
      { name: "Unit 2: Force and Translational Dynamics", weight: "18-23%" },
      { name: "Unit 3: Work, Energy, and Power", weight: "18-23%" },
      { name: "Unit 4: Linear Momentum", weight: "10-15%" },
      { name: "Unit 5: Torque and Rotational Dynamics", weight: "10-15%" },
      { name: "Unit 6: Energy and Momentum of Rotating Systems", weight: "5-8%" },
      { name: "Unit 7: Oscillations", weight: "5-8%" },
      { name: "Unit 8: Fluids", weight: "10-15%" },
    ],
    topics: [
      "Kinematics",
      "Force and Translational Dynamics",
      "Work, Energy, and Power",
      "Linear Momentum",
      "Torque and Rotational Dynamics",
      "Energy and Momentum of Rotating Systems",
      "Oscillations",
      "Fluids",
    ],
    description:
      "Practice AP Physics 1 digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on mechanics, rotation, and fluids.",
    intro:
      "AP Physics 1 is an algebra-based introduction to mechanics. The 2024 redesign added fluids and removed waves and electricity. The 2026 hybrid digital exam is 3 hours total: 40 MCQs in Bluebook (1hr 20min, 50%) and 4 handwritten FRQs (1hr 40min, 50%).",
    faqs: [
      {
        q: "Did AP Physics 1 change recently?",
        a: "Yes. The 2024-2025 redesign removed the waves and electric circuits units and added fluids. The exam now has 8 units centered on mechanics, with rotational motion expanded.",
      },
      {
        q: "Is AP Physics 1 the hardest AP exam?",
        a: "It has historically had one of the lowest pass rates. Concepts feel intuitive but applying them to multi-step problems is where students struggle. Practice problems are essential.",
      },
      {
        q: "Do I need calculus?",
        a: "No. AP Physics 1 is algebra-based. AP Physics C: Mechanics is the calculus-based equivalent.",
      },
      {
        q: "Are calculators and an equation sheet provided?",
        a: "Yes. Approved scientific or graphing calculators are permitted on both sections, and an equations sheet plus reference tables are available throughout the exam.",
      },
    ],
    examDate2026: "Wed, May 6, 2026 (12 PM Local)",
  },
  AP_PHYSICS_2: {
    key: "AP_PHYSICS_2",
    slug: "ap-physics-2",
    shortName: "Physics 2",
    fullName: "AP Physics 2: Algebra-Based",
    category: "science",
    examFormat: {
      mcqCount: 40,
      durationMin: 80,
      sections: "Section I (MCQ, 40Q, 50%) + Section II (FRQ, 4Q, 50%)",
      totalDurationMin: 180,
      examMode: "hybrid-digital",
      calculatorPolicy: "Approved scientific or graphing calculator permitted on both sections.",
      referenceMaterials: "Equations sheet and reference tables provided in Bluebook.",
      sectionsDetail: [
        { label: "Section I: Multiple Choice", questionCount: 40, durationMin: 80, weightPct: 50 },
        {
          label: "Section II: Free Response (handwritten)",
          questionCount: 4,
          durationMin: 100,
          weightPct: 50,
          notes:
            "One of each type: Mathematical Routines, Translation between Representations, Experimental Design, Qualitative/Quantitative Translation.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Thermodynamics", weight: "12-18%" },
      { name: "Unit 2: Electric Force, Field, and Potential", weight: "15-19%" },
      { name: "Unit 3: Electric Circuits", weight: "15-19%" },
      { name: "Unit 4: Magnetism and Electromagnetic Induction", weight: "12-18%" },
      { name: "Unit 5: Geometric Optics", weight: "12-15%" },
      { name: "Unit 6: Waves, Sound, and Physical Optics", weight: "12-15%" },
      { name: "Unit 7: Modern Physics", weight: "12-15%" },
    ],
    topics: [
      "Thermodynamics",
      "Electric Force, Field, and Potential",
      "Electric Circuits",
      "Magnetism and Electromagnetic Induction",
      "Geometric Optics",
      "Waves, Sound, and Physical Optics",
      "Modern Physics",
    ],
    description:
      "Practice AP Physics 2 digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on electricity, optics, and modern physics.",
    intro:
      "AP Physics 2 continues from Physics 1 with electricity, magnetism, optics, thermodynamics, and modern physics. The 2026 hybrid digital exam is 3 hours total — 40 MCQs in Bluebook (1hr 20min, 50%) and 4 handwritten FRQs (1hr 40min, 50%).",
    faqs: [
      {
        q: "Should I take Physics 1 before Physics 2?",
        a: "Yes. Physics 2 assumes you know Newtonian mechanics, energy, and momentum from Physics 1.",
      },
      {
        q: "Which units are most heavily tested?",
        a: "Electric circuits and electromagnetism dominate the exam. Optics and modern physics typically appear with one or two FRQs combined.",
      },
      {
        q: "Is Physics 2 easier than Physics 1?",
        a: "Many students report a higher pass rate for Physics 2 because the cohort is more self-selected, but the topics are conceptually broader.",
      },
      {
        q: "Are calculators and an equations sheet provided?",
        a: "Yes. Approved scientific or graphing calculators are permitted on both sections, and an equations sheet plus reference tables are available throughout the exam.",
      },
    ],
    examDate2026: "Thu, May 7, 2026 (8 AM Local)",
  },
  AP_PHYSICS_C_MECH: {
    key: "AP_PHYSICS_C_MECH",
    slug: "ap-physics-c-mechanics",
    shortName: "Physics C: Mechanics",
    fullName: "AP Physics C: Mechanics",
    category: "science",
    examFormat: {
      mcqCount: 40,
      durationMin: 80,
      sections: "Section I (MCQ, 40Q, 50%) + Section II (FRQ, 4Q, 50%)",
      totalDurationMin: 180,
      examMode: "hybrid-digital",
      calculatorPolicy: "Approved scientific or graphing calculator permitted on both sections.",
      referenceMaterials: "Equations sheet and reference tables provided in Bluebook.",
      sectionsDetail: [
        { label: "Section I: Multiple Choice", questionCount: 40, durationMin: 80, weightPct: 50 },
        {
          label: "Section II: Free Response (handwritten)",
          questionCount: 4,
          durationMin: 100,
          weightPct: 50,
          notes:
            "One of each type: Mathematical Routines, Translation between Representations, Experimental Design and Analysis, Qualitative/Quantitative Translation.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Kinematics", weight: "10-15%" },
      { name: "Unit 2: Force and Translational Dynamics", weight: "20-30%" },
      { name: "Unit 3: Work, Energy, and Power", weight: "13-20%" },
      { name: "Unit 4: Linear Momentum", weight: "10-18%" },
      { name: "Unit 5: Torque and Rotational Dynamics", weight: "10-18%" },
      { name: "Unit 6: Energy and Momentum of Rotating Systems", weight: "10-15%" },
      { name: "Unit 7: Oscillations", weight: "5-10%" },
    ],
    topics: [
      "Kinematics",
      "Force and Translational Dynamics",
      "Work, Energy, and Power",
      "Linear Momentum",
      "Torque and Rotational Dynamics",
      "Energy and Momentum of Rotating Systems",
      "Oscillations",
    ],
    description:
      "Practice AP Physics C: Mechanics digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on calculus-based mechanics.",
    intro:
      "AP Physics C: Mechanics is the calculus-based version of mechanics, taken primarily by future engineering and physics majors. After the 2025 redesign the exam is 3 hours hybrid digital — 40 MCQs in Bluebook (1hr 20min, 50%) and 4 handwritten FRQs (1hr 40min, 50%). Calculus (derivatives, integrals) is required throughout.",
    faqs: [
      {
        q: "Did Physics C: Mechanics change recently?",
        a: "Yes — the 2025 redesign expanded the course (now 3 hours, formerly 1.5 hours) and aligned the format with Physics 1/2: 40 MCQs (50%) + 4 FRQs (50%).",
      },
      {
        q: "Do I need to know calculus before taking this course?",
        a: "Yes. You should be taking or have completed AP Calculus AB or BC. Derivatives, integrals, and basic differential equations appear throughout the exam.",
      },
      {
        q: "Should I take Physics 1 first?",
        a: "Not required. Many students go directly to Physics C if they have strong math preparation. Some schools teach Physics 1 alongside calculus.",
      },
      {
        q: "How does Physics C: Mechanics differ from Physics 1?",
        a: "Physics 1 covers similar topics with algebra; Physics C: Mechanics uses calculus, goes deeper, and emphasizes derivations and analytical setups in addition to numerical answers.",
      },
    ],
    examDate2026: "Wed, May 13, 2026 (12 PM Local)",
  },
  AP_PHYSICS_C_EM: {
    key: "AP_PHYSICS_C_EM",
    slug: "ap-physics-c-em",
    shortName: "Physics C: E&M",
    fullName: "AP Physics C: Electricity and Magnetism",
    category: "science",
    examFormat: {
      mcqCount: 40,
      durationMin: 80,
      sections: "Section I (MCQ, 40Q, 50%) + Section II (FRQ, 4Q, 50%)",
      totalDurationMin: 180,
      examMode: "hybrid-digital",
      calculatorPolicy: "Approved scientific or graphing calculator permitted on both sections.",
      referenceMaterials: "Equations sheet and reference tables provided in Bluebook.",
      sectionsDetail: [
        { label: "Section I: Multiple Choice", questionCount: 40, durationMin: 80, weightPct: 50 },
        {
          label: "Section II: Free Response (handwritten)",
          questionCount: 4,
          durationMin: 100,
          weightPct: 50,
          notes:
            "One of each type: Mathematical Routines, Translation between Representations, Experimental Design and Analysis, Qualitative/Quantitative Translation.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Electric Charges, Fields, and Gauss's Law", weight: "20-25%" },
      { name: "Unit 2: Electric Potential", weight: "15-20%" },
      { name: "Unit 3: Conductors and Capacitors", weight: "12-17%" },
      { name: "Unit 4: Electric Circuits", weight: "17-22%" },
      { name: "Unit 5: Magnetic Fields and Electromagnetism", weight: "15-20%" },
      { name: "Unit 6: Electromagnetic Induction", weight: "13-18%" },
    ],
    topics: [
      "Electrostatics",
      "Conductors, Capacitors, Dielectrics",
      "Electric Circuits",
      "Magnetic Fields",
      "Electromagnetism",
    ],
    description:
      "Practice AP Physics C: E&M digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on calculus-based electricity and magnetism.",
    intro:
      "AP Physics C: Electricity and Magnetism is the calculus-based companion to Mechanics. After the 2025 redesign the exam is 3 hours hybrid digital — 40 MCQs in Bluebook (1hr 20min, 50%) and 4 handwritten FRQs (1hr 40min, 50%). Gauss's law, Ampère's law, and Faraday's law sit at the center of the course.",
    faqs: [
      {
        q: "Did Physics C: E&M change recently?",
        a: "Yes — the 2025 redesign expanded the course (now 3 hours, formerly 1.5 hours) and aligned the format with Physics 1/2: 40 MCQs (50%) + 4 FRQs (50%).",
      },
      {
        q: "Is Physics C: E&M harder than Mechanics?",
        a: "Most students agree it is harder. The mathematics is more abstract (vector calculus, flux integrals) and the concepts (fields, induced EMF) are less intuitive than mechanics.",
      },
      {
        q: "Can I take E&M without taking Mechanics?",
        a: "Technically yes, but it is unusual. Most schools teach Mechanics first and E&M in the second semester or second year.",
      },
      {
        q: "Which AP Physics path is best for engineering?",
        a: "Both Physics C exams are the strongest preparation for college engineering programs and may earn calculus-based physics credit.",
      },
    ],
    examDate2026: "Thu, May 14, 2026 (12 PM Local)",
  },
  AP_ENVIRONMENTAL_SCIENCE: {
    key: "AP_ENVIRONMENTAL_SCIENCE",
    slug: "ap-environmental-science",
    shortName: "Environmental Science",
    fullName: "AP Environmental Science",
    category: "science",
    examFormat: {
      mcqCount: 80,
      durationMin: 90,
      sections: "Section I (MCQ, 80Q, 60%) + Section II (FRQ, 3Q, 40%)",
      totalDurationMin: 160,
      examMode: "fully-digital",
      calculatorPolicy: "Approved scientific or graphing calculator permitted on both sections.",
      referenceMaterials: "Equations sheet and reference tables provided in Bluebook.",
      sectionsDetail: [
        {
          label: "Section I: Multiple Choice",
          questionCount: 80,
          durationMin: 90,
          weightPct: 60,
          notes: "Discrete and stimulus-based questions (data tables, charts, graphs, models, text sources).",
        },
        {
          label: "Section II: Free Response (typed in Bluebook)",
          questionCount: 3,
          durationMin: 70,
          weightPct: 40,
          notes:
            "Q1 Design an investigation, Q2 Analyze an environmental problem and propose a solution, Q3 Analyze an environmental problem and propose a solution doing calculations.",
        },
      ],
    },
    units: [
      { name: "Unit 1: The Living World — Ecosystems", weight: "6-8%" },
      { name: "Unit 2: The Living World — Biodiversity", weight: "6-8%" },
      { name: "Unit 3: Populations", weight: "10-15%" },
      { name: "Unit 4: Earth Systems and Resources", weight: "10-15%" },
      { name: "Unit 5: Land and Water Use", weight: "10-15%" },
      { name: "Unit 6: Energy Resources and Consumption", weight: "10-15%" },
      { name: "Unit 7: Atmospheric Pollution", weight: "7-10%" },
      { name: "Unit 8: Aquatic and Terrestrial Pollution", weight: "7-10%" },
      { name: "Unit 9: Global Change", weight: "15-20%" },
    ],
    topics: [
      "The Living World: Ecosystems",
      "The Living World: Biodiversity",
      "Populations",
      "Earth Systems and Resources",
      "Land and Water Use",
      "Energy Resources and Consumption",
      "Atmospheric Pollution",
      "Aquatic and Terrestrial Pollution",
      "Global Change",
    ],
    description:
      "Practice AP Environmental Science digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on ecosystems, pollution, and global change.",
    intro:
      "AP Environmental Science (APES) is interdisciplinary, blending biology, earth science, chemistry, and policy. The 2026 fully-digital exam runs 2hr 40min in Bluebook — 80 MCQs (1hr 30min, 60%) and 3 typed FRQs (1hr 10min, 40%). A calculator and reference tables are provided.",
    faqs: [
      {
        q: "Is AP Environmental Science a good first AP science?",
        a: "Yes. It is broader and less mathematically demanding than Biology or Chemistry, making it accessible to sophomores and juniors.",
      },
      {
        q: "How much math is on the exam?",
        a: "Q3 of the FRQ section is dedicated to calculations (percentages, dimensional analysis, growth rates). A calculator is now permitted, and a reference sheet is provided.",
      },
      {
        q: "What is the most-tested topic?",
        a: "Global Change is the most heavily weighted unit (15-20%). Land/water use, energy, and pollution units combined account for the largest share of multiple-choice questions.",
      },
      {
        q: "Are FRQs typed or handwritten?",
        a: "Typed. APES is fully digital — all three FRQ responses are typed directly in the Bluebook app.",
      },
    ],
    examDate2026: "Fri, May 15, 2026 (8 AM Local)",
  },
  AP_HUMAN_GEOGRAPHY: {
    key: "AP_HUMAN_GEOGRAPHY",
    slug: "ap-human-geography",
    shortName: "Human Geography",
    fullName: "AP Human Geography",
    category: "social",
    examFormat: {
      mcqCount: 60,
      durationMin: 60,
      sections: "Section I (MCQ, 60Q, 50%) + Section II (FRQ, 3Q, 50%)",
      totalDurationMin: 135,
      examMode: "fully-digital",
      calculatorPolicy: "No calculator.",
      referenceMaterials: "No reference sheet.",
      sectionsDetail: [
        {
          label: "Section I: Multiple Choice",
          questionCount: 60,
          durationMin: 60,
          weightPct: 50,
          notes: "Discrete and stimulus-based items: maps, tables, charts, satellite imagery, infographics.",
        },
        {
          label: "Section II: Free Response (typed in Bluebook)",
          questionCount: 3,
          durationMin: 75,
          weightPct: 50,
          notes:
            "Q1 text-only prompt; Q2 includes data/image/map stimulus; Q3 includes two stimuli. At least one question requires analysis across geographic scales.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Thinking Geographically", weight: "8-10%" },
      { name: "Unit 2: Population and Migration", weight: "12-17%" },
      { name: "Unit 3: Cultural Patterns and Processes", weight: "12-17%" },
      { name: "Unit 4: Political Patterns and Processes", weight: "12-17%" },
      { name: "Unit 5: Agriculture and Rural Land-Use", weight: "12-17%" },
      { name: "Unit 6: Cities and Urban Land-Use", weight: "12-17%" },
      { name: "Unit 7: Industrial and Economic Development", weight: "12-17%" },
    ],
    topics: [
      "Thinking Geographically",
      "Population and Migration Patterns and Processes",
      "Cultural Patterns and Processes",
      "Political Patterns and Processes",
      "Agriculture and Rural Land-Use Patterns and Processes",
      "Cities and Urban Land-Use Patterns and Processes",
      "Industrial and Economic Development Patterns and Processes",
    ],
    description:
      "Practice AP Human Geography digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on population, urban geography, and development.",
    intro:
      "AP Human Geography studies how humans organize space: cities, agriculture, migration, and economic development. The 2026 fully-digital exam runs 2hr 15min in Bluebook — 60 MCQs (1hr, 50%) and 3 typed FRQs (1hr 15min, 50%).",
    faqs: [
      {
        q: "Is AP Human Geography a good freshman AP?",
        a: "Yes. It is one of the most popular freshman AP courses. The content is accessible but the exam still requires strong vocabulary command and case-study application.",
      },
      {
        q: "How important are models in AP Human Geography?",
        a: "Critical. Demographic Transition Model, Rostow, Wallerstein, Weber, and von Thünen models appear repeatedly on both sections.",
      },
      {
        q: "How do I memorize all the vocabulary?",
        a: "Active recall with flashcards over weeks works far better than cramming. Pair each term with a real-world example.",
      },
      {
        q: "Are FRQs typed in 2026?",
        a: "Yes. AP Human Geography is fully digital — you type all three free-response answers directly in the Bluebook app.",
      },
    ],
    examDate2026: "Tue, May 5, 2026 (8 AM Local)",
  },
  AP_ENGLISH_LANG: {
    key: "AP_ENGLISH_LANG",
    slug: "ap-english-language",
    shortName: "English Language",
    fullName: "AP English Language and Composition",
    category: "english",
    examFormat: {
      mcqCount: 45,
      durationMin: 60,
      sections: "Section 1 (MCQ, 45Q, 1hr, 45%) + Section 2 (FRQ, 3 Essays, 2hr 15min, 55%)",
      totalDurationMin: 195,
      examMode: "fully-digital",
      calculatorPolicy: "No calculator.",
      referenceMaterials: "No reference sheet; nonfiction passages provided in stems.",
      sectionsDetail: [
        {
          label: "Section 1: Multiple Choice",
          questionCount: 45,
          durationMin: 60,
          weightPct: 45,
          notes: "23-25 Reading questions + 20-22 Writing (revision) questions across 5 nonfiction passages.",
        },
        {
          label: "Section 2 Q1: Synthesis Essay",
          questionCount: 1,
          durationMin: 40,
          weightPct: 18.33,
          notes: "Argue a position using at least 3 of 6 provided sources (15-min reading period shared with all 3 essays).",
        },
        { label: "Section 2 Q2: Rhetorical Analysis Essay", questionCount: 1, durationMin: 40, weightPct: 18.33 },
        { label: "Section 2 Q3: Argument Essay", questionCount: 1, durationMin: 40, weightPct: 18.33 },
      ],
    },
    units: [
      { name: "Unit 1-2: Rhetorical Situation (Reading & Writing)" },
      { name: "Unit 3-4: Claims and Evidence (Reading & Writing)" },
      { name: "Unit 5-6: Reasoning and Organization (Reading & Writing)" },
      { name: "Unit 7-8: Style (Reading & Writing)" },
      { name: "Unit 9: Synthesis & advanced argumentation" },
    ],
    topics: [
      "Rhetorical Situation",
      "Claims and Evidence",
      "Reasoning and Organization",
      "Style",
      "Synthesis Argument",
      "Rhetorical Analysis",
      "Argument Essay",
    ],
    description:
      "Practice AP English Language digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on rhetorical analysis and argumentation.",
    intro:
      "AP English Language and Composition focuses on nonfiction prose: how writers make arguments and how readers analyze them. The May 2026 exam is fully digital in the Bluebook app: Section 1 has 45 multiple-choice questions over five passages (about half reading analysis, half revision/writing), and Section 2 has three timed essays — Synthesis (using 6 provided sources), Rhetorical Analysis, and Argument — graded on a 6-point rubric (1 thesis + 4 evidence/commentary + 1 sophistication).",
    faqs: [
      {
        q: "How long is the AP English Language exam?",
        a: "The exam is 3 hours 15 minutes: 60 minutes for 45 multiple-choice questions (45% of score), then a 15-minute reading period and 2 hours for 3 essays (55% of score). Each essay is recommended at 40 minutes.",
      },
      {
        q: "How is AP Lang different from AP Lit?",
        a: "AP Lang focuses on nonfiction and rhetoric: speeches, essays, articles, op-eds, and revision skills. AP Lit focuses on fiction and poetry: novels, short stories, plays, and poems with literary analysis essays.",
      },
      {
        q: "Which AP Lang essay is hardest and how is it scored?",
        a: "The Synthesis essay challenges most students because it requires reading 6 sources under time pressure and integrating at least 3 of them into a coherent argument. All three essays use the same 6-point rubric: 1 point for a defensible thesis, up to 4 points for evidence and commentary, and 1 point for sophistication.",
      },
      {
        q: "How do I improve my AP Lang essay score quickly?",
        a: "Focus on a clear, defensible thesis in the first paragraph and embedding evidence with line-of-reasoning commentary. The rubric explicitly rewards sophisticated reasoning over vocabulary or length. Practice with released FRQs and compare your work to the College Board's anchor papers.",
      },
    ],
    relatedBlogSlug: "ap-english-language-complete-guide",
    examDate2026: "Wed, May 13, 2026 (8 AM Local)",
  },
  AP_ENGLISH_LIT: {
    key: "AP_ENGLISH_LIT",
    slug: "ap-english-literature",
    shortName: "English Literature",
    fullName: "AP English Literature and Composition",
    category: "english",
    examFormat: {
      mcqCount: 55,
      durationMin: 60,
      sections: "Section 1 (MCQ, 55Q, 1hr, 45%) + Section 2 (FRQ, 3 Essays, 2hr, 55%)",
      totalDurationMin: 180,
      examMode: "fully-digital",
      calculatorPolicy: "No calculator.",
      referenceMaterials: "No reference sheet — closed-stimulus essays.",
      sectionsDetail: [
        {
          label: "Section 1: Multiple Choice",
          questionCount: 55,
          durationMin: 60,
          weightPct: 45,
          notes:
            "5 sets of 8-13 questions: at least 2 prose-fiction (or drama) passages and at least 2 poetry passages.",
        },
        {
          label: "Section 2: Free Response (typed in Bluebook)",
          questionCount: 3,
          durationMin: 120,
          weightPct: 55,
          notes:
            "Q1 Poetry Analysis, Q2 Prose Fiction Analysis, Q3 Literary Argument (choose from a list of ~40 works or another work of literary merit). 40 minutes recommended per essay.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Short Fiction I" },
      { name: "Unit 2: Poetry I" },
      { name: "Unit 3: Longer Fiction or Drama I" },
      { name: "Unit 4: Short Fiction II" },
      { name: "Unit 5: Poetry II" },
      { name: "Unit 6: Longer Fiction or Drama II" },
      { name: "Unit 7: Short Fiction III" },
      { name: "Unit 8: Poetry III" },
      { name: "Unit 9: Longer Fiction or Drama III" },
    ],
    topics: [
      "Short Fiction",
      "Poetry",
      "Longer Fiction or Drama",
      "Character",
      "Setting",
      "Structure",
      "Narration",
      "Figurative Language",
      "Literary Argumentation",
    ],
    description:
      "Practice AP English Literature digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on poetry, prose, and drama.",
    intro:
      "AP English Literature analyzes fiction, poetry, and drama. The 2026 fully-digital exam runs 3 hours in Bluebook — 55 MCQs across 5 passage sets (1hr, 45%) and 3 typed essays (Poetry, Prose, Literary Argument; 2hr, 55%).",
    faqs: [
      {
        q: "Do I need to read all the classics?",
        a: "No specific reading list is required. The third FRQ (literary argument essay) lets you choose any work of literary merit you have studied — College Board provides a list of ~40 suggested works on the prompt. Familiarity with 3-4 well-chosen novels/plays is enough.",
      },
      {
        q: "How important is poetry?",
        a: "Substantial. At least 2 of the 5 MCQ passage sets are poetry, and Q1 of the FRQ section is always poetry analysis. Practice with sonnets, free verse, and modern poems is essential.",
      },
      {
        q: "What is a literary argument essay?",
        a: "An essay that uses a literary work to support an interpretive thesis about how a literary concept contributes to meaning. It must go beyond plot summary into analysis of how craft creates meaning.",
      },
      {
        q: "Are essays typed in 2026?",
        a: "Yes. AP English Literature is fully digital — all three essays are typed directly in the Bluebook app.",
      },
    ],
    examDate2026: "Wed, May 6, 2026 (8 AM Local)",
  },
  AP_US_HISTORY: {
    key: "AP_US_HISTORY",
    slug: "ap-us-history",
    shortName: "US History",
    fullName: "AP United States History",
    category: "history",
    examFormat: {
      mcqCount: 55,
      durationMin: 55,
      sections:
        "Section IA (MCQ, 55Q, 55min, 40%) + Section IB (SAQ, 3Q, 40min, 20%) + Section II (DBQ + LEQ, 2Q, 1hr 40min, 40%)",
      totalDurationMin: 195,
      examMode: "fully-digital",
      calculatorPolicy: "No calculator.",
      referenceMaterials: "No reference sheet; sources are provided in stems.",
      sectionsDetail: [
        { label: "Section IA: Multiple Choice", questionCount: 55, durationMin: 55, weightPct: 40 },
        {
          label: "Section IB: Short Answer (SAQ)",
          questionCount: 3,
          durationMin: 40,
          weightPct: 20,
          notes: "Q1 (1754-1980 secondary sources, required), Q2 (1754-1980 primary source, required), Q3 OR Q4 (choice).",
        },
        {
          label: "Section II Q1: Document-Based Question (DBQ)",
          questionCount: 1,
          durationMin: 60,
          weightPct: 25,
          notes: "Includes 15-minute reading period; topics from 1754-1980; 7 documents.",
        },
        { label: "Section II Q2: Long Essay (LEQ)", questionCount: 1, durationMin: 40, weightPct: 15, notes: "Choose 1 of 3 prompts." },
      ],
    },
    units: [
      { name: "Period 1: 1491-1607", weight: "4-6%" },
      { name: "Period 2: 1607-1754", weight: "6-8%" },
      { name: "Period 3: 1754-1800", weight: "10-17%" },
      { name: "Period 4: 1800-1848", weight: "10-17%" },
      { name: "Period 5: 1844-1877", weight: "10-17%" },
      { name: "Period 6: 1865-1898", weight: "10-17%" },
      { name: "Period 7: 1890-1945", weight: "10-17%" },
      { name: "Period 8: 1945-1980", weight: "10-17%" },
      { name: "Period 9: 1980-Present", weight: "4-6%" },
    ],
    topics: [
      "Period 1: 1491-1607",
      "Period 2: 1607-1754",
      "Period 3: 1754-1800",
      "Period 4: 1800-1848",
      "Period 5: 1844-1877",
      "Period 6: 1865-1898",
      "Period 7: 1890-1945",
      "Period 8: 1945-1980",
      "Period 9: 1980-Present",
    ],
    description:
      "Practice AP US History (APUSH) digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring across all nine historical periods.",
    intro:
      "APUSH covers more than 500 years of American history through nine periods (1491 to present). The May 2026 exam is fully digital in the Bluebook app and tests four historical thinking skills: contextualization, comparison, causation, and continuity-and-change-over-time. The exam runs 3 hours 15 minutes total across four parts: 55 stimulus-based MCQs, 3 short-answer questions, one document-based question (DBQ) with 7 documents, and one long-essay question (LEQ).",
    faqs: [
      {
        q: "How long is the AP US History exam?",
        a: "The total exam is 3 hours 15 minutes: Section IA (MCQ, 55 min), Section IB (SAQ, 40 min), Section II Part A (DBQ, 60 min including a 15-minute reading period), and Section II Part B (LEQ, 40 min).",
      },
      {
        q: "Is APUSH the hardest AP history?",
        a: "APUSH is widely considered one of the toughest AP exams because of the volume of content (1491 to present) and four distinct question formats. The pass rate hovers around 67-72% but earning a 5 is among the harder fives in the AP catalog.",
      },
      {
        q: "How do I prepare for the APUSH DBQ?",
        a: "Practice the seven-point rubric: thesis (1), contextualization (1), evidence from documents (3), evidence beyond documents (1), sourcing (1), complexity (1). Use the 15-minute reading period to outline a thesis and group documents by perspective. Time-blocked 60-minute practice is critical.",
      },
      {
        q: "Which APUSH period is most heavily tested?",
        a: "Periods 3 through 8 (1754 to 1980) carry the bulk of MCQ and FRQ weight, each at 10-17%. Period 1 (1491-1607) and Period 9 (1980-present) are lighter at 4-6% each. The DBQ always covers 1754-1980, and the LEQ rotates among three time periods.",
      },
    ],
    relatedBlogSlug: "ap-us-history-complete-guide",
    examDate2026: "Fri, May 8, 2026 (8 AM Local)",
  },
  AP_WORLD_HISTORY: {
    key: "AP_WORLD_HISTORY",
    slug: "ap-world-history",
    shortName: "World History",
    fullName: "AP World History: Modern",
    category: "history",
    examFormat: {
      mcqCount: 55,
      durationMin: 55,
      sections:
        "Section IA (MCQ, 55Q, 55min, 40%) + Section IB (SAQ, 3Q, 40min, 20%) + Section II (DBQ + LEQ, 2Q, 1hr 40min, 40%)",
      totalDurationMin: 195,
      examMode: "fully-digital",
      calculatorPolicy: "No calculator.",
      referenceMaterials: "No reference sheet; sources are provided in stems.",
      sectionsDetail: [
        { label: "Section IA: Multiple Choice", questionCount: 55, durationMin: 55, weightPct: 40 },
        {
          label: "Section IB: Short Answer (SAQ)",
          questionCount: 3,
          durationMin: 40,
          weightPct: 20,
          notes: "Q1 (1200-2001 secondary sources), Q2 (1200-2001 primary source), Q3 OR Q4 (choice).",
        },
        {
          label: "Section II Q1: Document-Based Question (DBQ)",
          questionCount: 1,
          durationMin: 60,
          weightPct: 25,
          notes: "Includes 15-minute reading period; topics from 1450-2001; 7 documents.",
        },
        { label: "Section II Q2: Long Essay (LEQ)", questionCount: 1, durationMin: 40, weightPct: 15, notes: "Choose 1 of 3 prompts spanning 1200-1750, 1450-1900, or 1750-2001." },
      ],
    },
    units: [
      { name: "Unit 1: The Global Tapestry (c. 1200-1450)", weight: "8-10%" },
      { name: "Unit 2: Networks of Exchange (c. 1200-1450)", weight: "8-10%" },
      { name: "Unit 3: Land-Based Empires (c. 1450-1750)", weight: "12-15%" },
      { name: "Unit 4: Transoceanic Interconnections (c. 1450-1750)", weight: "12-15%" },
      { name: "Unit 5: Revolutions (c. 1750-1900)", weight: "12-15%" },
      { name: "Unit 6: Consequences of Industrialization (c. 1750-1900)", weight: "12-15%" },
      { name: "Unit 7: Global Conflict (c. 1900-Present)", weight: "8-10%" },
      { name: "Unit 8: Cold War and Decolonization (c. 1900-Present)", weight: "8-10%" },
      { name: "Unit 9: Globalization (c. 1900-Present)", weight: "8-10%" },
    ],
    topics: [
      "The Global Tapestry (c. 1200-1450)",
      "Networks of Exchange (c. 1200-1450)",
      "Land-Based Empires (c. 1450-1750)",
      "Transoceanic Interconnections (c. 1450-1750)",
      "Revolutions (c. 1750-1900)",
      "Consequences of Industrialization (c. 1750-1900)",
      "Global Conflict (c. 1900-Present)",
      "Cold War and Decolonization (c. 1900-Present)",
      "Globalization (c. 1900-Present)",
    ],
    description:
      "Practice AP World History: Modern digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring from 1200 CE to the present.",
    intro:
      "AP World History: Modern covers global developments from c. 1200 CE to the present. The May 2026 exam is fully digital in the Bluebook app and runs 3 hours 15 minutes total: 55 stimulus-based MCQs (55 min, 40%), 3 short-answer questions (40 min, 20%), one document-based question with 7 documents (60 min including a 15-min reading period, 25%), and one long-essay question chosen from three prompts (40 min, 15%).",
    faqs: [
      {
        q: "What time period does AP World History cover?",
        a: "Only c. 1200 CE to the present (2001). The earlier 'Foundations' content was removed in the 2019-2020 redesign. Units 3-6 (1450-1900) carry the heaviest weight at 12-15% each.",
      },
      {
        q: "How long is the AP World History exam?",
        a: "The exam is 3 hours 15 minutes total: Section IA (55 MCQs, 55 min), Section IB (3 SAQs, 40 min), Section II Part A (DBQ, 60 min including 15-min reading), and Section II Part B (LEQ, 40 min).",
      },
      {
        q: "How is AP World History different from AP US History?",
        a: "AP World History is global and comparative; APUSH is single-nation. The DBQ and LEQ rubrics are nearly identical (7-point DBQ, 6-point LEQ). World History DBQ topics span 1450-2001 instead of APUSH's 1754-1980.",
      },
      {
        q: "Should I take AP World History before or after APUSH?",
        a: "Either order works. Taking AP World History first builds historical thinking skills (CCOT, comparison, causation) that transfer directly to APUSH and AP European History. Many schools schedule World History in 10th grade and APUSH in 11th grade.",
      },
    ],
    relatedBlogSlug: "ap-world-history-complete-guide",
    examDate2026: "Thu, May 7, 2026 (8 AM Local)",
  },
  AP_EUROPEAN_HISTORY: {
    key: "AP_EUROPEAN_HISTORY",
    slug: "ap-european-history",
    shortName: "European History",
    fullName: "AP European History",
    category: "history",
    examFormat: {
      mcqCount: 55,
      durationMin: 55,
      sections: "Section 1A (MCQ, 40%) + 1B (SAQ, 20%) + Section 2 (DBQ 25% + LEQ 15%)",
      totalDurationMin: 195,
      examMode: "fully-digital",
      calculatorPolicy: "No calculator.",
      referenceMaterials: "No reference sheet — closed-stimulus history exam.",
      sectionsDetail: [
        {
          label: "Section 1A: Multiple Choice",
          questionCount: 55,
          durationMin: 55,
          weightPct: 40,
          notes:
            "Stimulus-based sets of 3-4 questions: primary/secondary texts, images, charts, maps.",
        },
        {
          label: "Section 1B: Short Answer (typed in Bluebook)",
          questionCount: 3,
          durationMin: 40,
          weightPct: 20,
          notes:
            "Q1 (required, 1600-2001, secondary sources), Q2 (required, 1600-2001, primary source), choice of Q3 (1450-1815) or Q4 (1815-present).",
        },
        {
          label: "Section 2: DBQ (typed in Bluebook)",
          questionCount: 1,
          durationMin: 60,
          weightPct: 25,
          notes:
            "Includes 15-min reading period. 7 documents on a development between 1600 and 2001.",
        },
        {
          label: "Section 2: Long Essay (typed in Bluebook)",
          questionCount: 1,
          durationMin: 40,
          weightPct: 15,
          notes:
            "Choose 1 of 3 prompts from different time periods (1450-1700, 1648-1914, or 1815-2001).",
        },
      ],
    },
    units: [
      { name: "Unit 1: Renaissance and Exploration", weight: "10-15%" },
      { name: "Unit 2: Age of Reformation", weight: "10-15%" },
      { name: "Unit 3: Absolutism and Constitutionalism", weight: "10-15%" },
      { name: "Unit 4: Scientific, Philosophical, and Political Developments", weight: "10-15%" },
      { name: "Unit 5: Conflict, Crisis, and Reaction in the Late 18th Century", weight: "10-15%" },
      { name: "Unit 6: Industrialization and Its Effects", weight: "10-15%" },
      { name: "Unit 7: 19th-Century Perspectives and Political Developments", weight: "10-15%" },
      { name: "Unit 8: 20th-Century Global Conflicts", weight: "10-15%" },
      { name: "Unit 9: Cold War and Contemporary Europe", weight: "10-15%" },
    ],
    topics: [
      "Renaissance and Exploration",
      "Age of Reformation",
      "Absolutism and Constitutionalism",
      "Scientific, Philosophical, and Political Developments",
      "Conflict, Crisis, and Reaction in the Late 18th Century",
      "Industrialization and Its Effects",
      "19th-Century Perspectives and Political Developments",
      "20th-Century Global Conflicts",
      "Cold War and Contemporary Europe",
    ],
    description:
      "Practice AP European History digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring from the Renaissance to the present.",
    intro:
      "AP European History covers Europe from 1450 to the present. The 2026 fully-digital exam runs 3hr 15min in Bluebook — 55 MCQs (40%), 3 SAQs (20%), 1 DBQ with 15-min reading period (25%), and 1 Long Essay choosing from 3 time-period prompts (15%).",
    faqs: [
      {
        q: "Is AP Euro harder than AP World?",
        a: "Many students find AP Euro harder because it goes deeper into a single region with more named individuals and political detail.",
      },
      {
        q: "What is the most common DBQ topic?",
        a: "The DBQ always covers the period 1600-2001. The Reformation, Industrialization, and 20th-century totalitarianism appear frequently across released exams.",
      },
      {
        q: "Do I need to memorize dates?",
        a: "Specific years are rarely tested directly. Decades and centuries matter for placing events in context — especially for choosing the SAQ Q3 vs Q4 and the Long Essay prompt. Focus on cause-and-effect chains rather than rote dates.",
      },
      {
        q: "Are SAQs/DBQ/LEQ typed in 2026?",
        a: "Yes. AP European History is fully digital — all written responses (SAQs, DBQ, Long Essay) are typed directly in the Bluebook app.",
      },
    ],
    examDate2026: "Mon, May 4, 2026 (12 PM Local)",
  },
  AP_US_GOVERNMENT: {
    key: "AP_US_GOVERNMENT",
    slug: "ap-us-government",
    shortName: "US Government",
    fullName: "AP United States Government and Politics",
    category: "social",
    examFormat: {
      mcqCount: 55,
      durationMin: 80,
      sections: "Section I (MCQ, 55Q, 50%) + Section II (FRQ, 4Q, 50%)",
      totalDurationMin: 180,
      examMode: "fully-digital",
      calculatorPolicy: "No calculator.",
      referenceMaterials: "No reference sheet — students must internalize 9 foundational documents and 15 required SCOTUS cases.",
      sectionsDetail: [
        {
          label: "Section I: Multiple Choice",
          questionCount: 55,
          durationMin: 80,
          weightPct: 50,
          notes: "Discrete and stimulus-based items: foundational documents, SCOTUS cases, charts/graphs/maps.",
        },
        {
          label: "Section II: Free Response (typed in Bluebook)",
          questionCount: 4,
          durationMin: 100,
          weightPct: 50,
          notes:
            "1 Concept Application, 1 Quantitative Analysis, 1 SCOTUS Comparison (compare a non-required case to a required one), 1 Argument Essay.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Foundations of American Democracy", weight: "15-22%" },
      { name: "Unit 2: Interactions Among Branches of Government", weight: "25-36%" },
      { name: "Unit 3: Civil Liberties and Civil Rights", weight: "13-18%" },
      { name: "Unit 4: American Political Ideologies and Beliefs", weight: "10-15%" },
      { name: "Unit 5: Political Participation", weight: "20-27%" },
    ],
    topics: [
      "Foundations of American Democracy",
      "Interactions Among Branches of Government",
      "Civil Liberties and Civil Rights",
      "American Political Ideologies and Beliefs",
      "Political Participation",
    ],
    description:
      "Practice AP US Government digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on the Constitution, branches, and political behavior.",
    intro:
      "AP US Government and Politics centers on 9 foundational documents and 15 required Supreme Court cases. The 2026 fully-digital exam runs 3 hours in Bluebook — 55 MCQs (1hr 20min, 50%) and 4 typed FRQs (1hr 40min, 50%) including a SCOTUS Comparison and an Argument Essay.",
    faqs: [
      {
        q: "Do I really need to know all 15 Supreme Court cases?",
        a: "Yes. Cases like Marbury v. Madison, Brown v. Board, and Citizens United appear directly in MCQ and FRQ stems — particularly in the SCOTUS Comparison FRQ. Knowing the holding and constitutional principle of each is essential.",
      },
      {
        q: "What are the foundational documents?",
        a: "The Declaration of Independence, Articles of Confederation, Constitution, Federalist 10, 51, 70, 78, Brutus 1, and Letter from Birmingham Jail. These nine documents drive a major portion of the exam.",
      },
      {
        q: "Is AP Gov a one-semester course at most schools?",
        a: "Yes. It is commonly offered as a one-semester course paired with AP Macroeconomics or another social-science elective.",
      },
      {
        q: "Are FRQs typed in 2026?",
        a: "Yes. AP US Government is fully digital, so all four FRQs (Concept Application, Quantitative Analysis, SCOTUS Comparison, Argument Essay) are typed directly in the Bluebook app.",
      },
    ],
    examDate2026: "Tue, May 5, 2026 (12 PM Local)",
  },
  AP_COMPARATIVE_GOVERNMENT: {
    key: "AP_COMPARATIVE_GOVERNMENT",
    slug: "ap-comparative-government",
    shortName: "Comparative Government",
    fullName: "AP Comparative Government and Politics",
    category: "social",
    examFormat: {
      mcqCount: 55,
      durationMin: 60,
      sections: "Section I (MCQ, 55Q, 50%) + Section II (FRQ, 4Q, 50%)",
      totalDurationMin: 150,
      examMode: "fully-digital",
      calculatorPolicy: "No calculator.",
      referenceMaterials: "No reference sheet.",
      sectionsDetail: [
        {
          label: "Section I: Multiple Choice",
          questionCount: 55,
          durationMin: 60,
          weightPct: 50,
          notes:
            "Items focus on the six core countries: China, Iran, Mexico, Nigeria, Russia, and the United Kingdom.",
        },
        {
          label: "Section II: Free Response (typed in Bluebook)",
          questionCount: 4,
          durationMin: 90,
          weightPct: 50,
          notes:
            "1 Conceptual Analysis, 1 Quantitative Analysis, 1 Comparative Analysis (two of the six countries), 1 Argument Essay.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Political Systems, Regimes, and Governments", weight: "18-22%" },
      { name: "Unit 2: Political Institutions", weight: "17-23%" },
      { name: "Unit 3: Political Culture and Participation", weight: "17-23%" },
      { name: "Unit 4: Party and Electoral Systems and Citizen Organizations", weight: "12-18%" },
      { name: "Unit 5: Political and Economic Changes and Development", weight: "17-23%" },
    ],
    topics: [
      "Political Systems, Regimes, and Governments",
      "Political Institutions",
      "Political Culture and Participation",
      "Party and Electoral Systems and Citizen Organizations",
      "Political and Economic Changes and Development",
    ],
    description:
      "Practice AP Comparative Government digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on six core countries.",
    intro:
      "AP Comparative Government compares six core countries: China, Iran, Mexico, Nigeria, Russia, and the United Kingdom. The 2026 fully-digital exam runs 2hr 30min in Bluebook — 55 MCQs (1hr, 50%) and 4 typed FRQs (1hr 30min, 50%) including a Comparative Analysis and an Argument Essay.",
    faqs: [
      {
        q: "Which six countries are studied?",
        a: "China, Iran, Mexico, Nigeria, Russia, and the United Kingdom. Almost every exam question references at least one of these.",
      },
      {
        q: "Is AP Comparative Government easier than AP US Government?",
        a: "Slightly higher pass rate but the cohort is smaller and more self-selected. Strong notetaking on country-by-country comparisons is the difference between a 3 and a 5.",
      },
      {
        q: "How should I structure my notes?",
        a: "Build a six-column comparison chart for each unit (executive, legislature, parties, etc.). The Comparative Analysis FRQ rewards exactly this kind of cross-country thinking.",
      },
      {
        q: "Are FRQs typed in 2026?",
        a: "Yes. AP Comparative Government is fully digital — all four FRQs (Conceptual, Quantitative, Comparative, Argument Essay) are typed directly in the Bluebook app.",
      },
    ],
    examDate2026: "Wed, May 6, 2026 (12 PM Local)",
  },
  AP_CALCULUS_AB: {
    key: "AP_CALCULUS_AB",
    slug: "ap-calculus-ab",
    shortName: "Calculus AB",
    fullName: "AP Calculus AB",
    category: "math",
    examFormat: {
      mcqCount: 45,
      durationMin: 105,
      sections: "Section I (MCQ, 45Q, 1hr 45min, 50%) + Section II (FRQ, 6Q, 1hr 30min, 50%)",
      totalDurationMin: 195,
      examMode: "hybrid-digital",
      calculatorPolicy:
        "Graphing calculator required on Section I Part B and Section II Part A; calculator NOT permitted on Section I Part A and Section II Part B.",
      referenceMaterials: "No formula sheet provided.",
      sectionsDetail: [
        { label: "Section I Part A (MCQ, no calculator)", questionCount: 30, durationMin: 60, weightPct: 33.3 },
        { label: "Section I Part B (MCQ, graphing calculator)", questionCount: 15, durationMin: 45, weightPct: 16.7 },
        { label: "Section II Part A (FRQ, graphing calculator)", questionCount: 2, durationMin: 30, weightPct: 16.7 },
        { label: "Section II Part B (FRQ, no calculator)", questionCount: 4, durationMin: 60, weightPct: 33.3 },
      ],
    },
    units: [
      { name: "Unit 1: Limits and Continuity", weight: "10-12%" },
      { name: "Unit 2: Differentiation: Definition and Fundamental Properties", weight: "10-12%" },
      { name: "Unit 3: Differentiation: Composite, Implicit, and Inverse Functions", weight: "9-13%" },
      { name: "Unit 4: Contextual Applications of Differentiation", weight: "10-15%" },
      { name: "Unit 5: Analytical Applications of Differentiation", weight: "15-18%" },
      { name: "Unit 6: Integration and Accumulation of Change", weight: "17-20%" },
      { name: "Unit 7: Differential Equations", weight: "6-12%" },
      { name: "Unit 8: Applications of Integration", weight: "10-15%" },
    ],
    topics: [
      "Limits and Continuity",
      "Differentiation: Definition and Fundamental Properties",
      "Differentiation: Composite, Implicit, and Inverse Functions",
      "Contextual Applications of Differentiation",
      "Analytical Applications of Differentiation",
      "Integration and Accumulation of Change",
      "Differential Equations",
      "Applications of Integration",
    ],
    description:
      "Practice AP Calculus AB digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on limits, derivatives, and integrals.",
    intro:
      "AP Calculus AB is roughly equivalent to a first-semester college calculus course. The exam tests limits, derivatives, integrals, and the Fundamental Theorem of Calculus across 8 units. The May 2026 exam is a hybrid digital exam: you complete Section I (45 multiple-choice questions) in the Bluebook app, view free-response prompts on screen, and handwrite your six FRQ answers in a paper booklet.",
    faqs: [
      {
        q: "Should I take Calculus AB or BC?",
        a: "BC covers everything in AB plus parametric, polar, vector functions, and series. Take BC if your school offers it and you have strong precalculus skills; otherwise AB is excellent preparation. Note: you cannot take both AB and BC exams in the same year.",
      },
      {
        q: "What is the calculator policy on the AP Calculus AB exam?",
        a: "A graphing calculator is required on Section I Part B (15 MCQs, 45 min) and Section II Part A (2 FRQs, 30 min). It is NOT permitted on Section I Part A (30 MCQs, 60 min) or Section II Part B (4 FRQs, 60 min). Roughly half the exam is calculator-allowed.",
      },
      {
        q: "How long is the AP Calculus AB exam?",
        a: "The total exam is 3 hours 15 minutes: 1 hour 45 minutes for the multiple-choice section (50% of score) and 1 hour 30 minutes for the free-response section (50% of score).",
      },
      {
        q: "What is the most missed topic?",
        a: "Implicit differentiation, related rates, and applications of integrals (especially volumes of solids of revolution) are commonly missed on the FRQ section. Unit 5 (Analytical Applications of Differentiation) and Unit 6 (Integration) together account for 32-38% of the exam.",
      },
    ],
    relatedBlogSlug: "ap-calculus-ab-complete-guide",
    examDate2026: "Mon, May 11, 2026 (8 AM Local)",
  },
  AP_CALCULUS_BC: {
    key: "AP_CALCULUS_BC",
    slug: "ap-calculus-bc",
    shortName: "Calculus BC",
    fullName: "AP Calculus BC",
    category: "math",
    examFormat: {
      mcqCount: 45,
      durationMin: 105,
      sections: "Section I (MCQ, 45Q, 50%) + Section II (FRQ, 6Q, 50%)",
      totalDurationMin: 195,
      examMode: "hybrid-digital",
      calculatorPolicy:
        "Approved graphing calculator required for designated parts (MCQ Part B and FRQ Part A); not permitted on calc-free parts.",
      referenceMaterials: "No formula sheet provided.",
      sectionsDetail: [
        {
          label: "Section I, Part A: MCQ — No Calculator",
          questionCount: 30,
          durationMin: 60,
          weightPct: 33.3,
        },
        {
          label: "Section I, Part B: MCQ — Graphing Calculator Required",
          questionCount: 15,
          durationMin: 45,
          weightPct: 16.7,
        },
        {
          label: "Section II, Part A: FRQ — Graphing Calculator Required (handwritten)",
          questionCount: 2,
          durationMin: 30,
          weightPct: 16.7,
        },
        {
          label: "Section II, Part B: FRQ — No Calculator (handwritten)",
          questionCount: 4,
          durationMin: 60,
          weightPct: 33.3,
        },
      ],
    },
    units: [
      { name: "Unit 1: Limits and Continuity", weight: "4-7%" },
      { name: "Unit 2: Differentiation — Definition and Fundamental Properties", weight: "4-7%" },
      { name: "Unit 3: Differentiation — Composite, Implicit, and Inverse Functions", weight: "4-7%" },
      { name: "Unit 4: Contextual Applications of Differentiation", weight: "6-9%" },
      { name: "Unit 5: Analytical Applications of Differentiation", weight: "8-11%" },
      { name: "Unit 6: Integration and Accumulation of Change", weight: "17-20%" },
      { name: "Unit 7: Differential Equations", weight: "6-9%" },
      { name: "Unit 8: Applications of Integration", weight: "6-9%" },
      { name: "Unit 9: Parametric Equations, Polar Coordinates, Vector-Valued Functions", weight: "11-12%" },
      { name: "Unit 10: Infinite Sequences and Series", weight: "17-18%" },
    ],
    topics: [
      "Limits and Continuity",
      "Differentiation",
      "Integration and Accumulation of Change",
      "Differential Equations",
      "Applications of Integration",
      "Parametric, Polar, and Vector-Valued Functions",
      "Infinite Sequences and Series",
    ],
    description:
      "Practice AP Calculus BC digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on series, parametric, and polar topics.",
    intro:
      "AP Calculus BC covers all AB content plus parametric, polar, and vector functions, and the full sequence-and-series unit. The 2026 hybrid digital exam runs 3hr 15min — MCQs in Bluebook (1hr 45min, 50%) and 6 handwritten FRQs (1hr 30min, 50%). A graphing calculator is required for designated parts.",
    faqs: [
      {
        q: "What is on BC that is not on AB?",
        a: "Parametric, polar, and vector-valued functions (Unit 9), plus the entire infinite sequences and series unit (Unit 10) — geometric, p-series, alternating, Taylor and Maclaurin series.",
      },
      {
        q: "What is the AB subscore?",
        a: "BC students receive an AB subscore based on the AB-aligned questions on their exam. This can help if BC-only topics (series, parametric/polar) drag down the overall score.",
      },
      {
        q: "Is BC much harder than AB?",
        a: "More content, but BC students typically score higher because the cohort is more self-selected. Series is the unit that requires the most new study, often consuming a third of the year.",
      },
      {
        q: "Are FRQs handwritten in 2026?",
        a: "Yes. AP Calculus BC is hybrid digital — MCQs are answered in the Bluebook app and the 6 FRQs are handwritten in a paper exam booklet.",
      },
    ],
    examDate2026: "Mon, May 11, 2026 (8 AM Local)",
  },
  AP_PRECALCULUS: {
    key: "AP_PRECALCULUS",
    slug: "ap-precalculus",
    shortName: "Precalculus",
    fullName: "AP Precalculus",
    category: "math",
    examFormat: {
      mcqCount: 40,
      durationMin: 120,
      sections: "Section I (MCQ, 40Q, ~63%) + Section II (FRQ, 4Q, ~37%)",
      totalDurationMin: 180,
      examMode: "hybrid-digital",
      calculatorPolicy:
        "Approved graphing calculator (radian mode) required for MCQ Part B and FRQ Q1, Q2; not permitted on Part A or FRQ Q3, Q4.",
      referenceMaterials: "No formula sheet provided.",
      sectionsDetail: [
        {
          label: "Section I, Part A: MCQ — No Calculator",
          questionCount: 28,
          durationMin: 80,
          weightPct: 44,
        },
        {
          label: "Section I, Part B: MCQ — Graphing Calculator Required",
          questionCount: 12,
          durationMin: 40,
          weightPct: 19,
          notes: "Radian mode.",
        },
        {
          label: "Section II: Free Response (4 questions, handwritten)",
          questionCount: 4,
          durationMin: 60,
          weightPct: 37,
          notes:
            "Q1 Function Concepts (calc), Q2 Modeling Non-Periodic Context (calc), Q3 Modeling Periodic Context (no calc), Q4 Symbolic Manipulations (no calc). Each FRQ worth 6 points.",
        },
      ],
    },
    units: [
      { name: "Unit 1: Polynomial and Rational Functions", weight: "30-40%" },
      { name: "Unit 2: Exponential and Logarithmic Functions", weight: "27-40%" },
      { name: "Unit 3: Trigonometric and Polar Functions", weight: "30-35%" },
      {
        name: "Unit 4: Functions Involving Parameters, Vectors, and Matrices",
        weight: "Not assessed on the exam (taught for enrichment)",
      },
    ],
    topics: [
      "Polynomial and Rational Functions",
      "Exponential and Logarithmic Functions",
      "Trigonometric and Polar Functions",
      "Functions Involving Parameters, Vectors, and Matrices",
    ],
    description:
      "Practice AP Precalculus digital exams online. Free Bluebook-style multiple-choice questions with instant AI scoring on polynomial, exponential, and trigonometric functions.",
    intro:
      "AP Precalculus is one of College Board's newest courses, launched in 2023. The 2026 hybrid digital exam runs 3 hours — 40 MCQs in Bluebook split across no-calc and calc-required parts (~63%) and 4 handwritten FRQs (~37%). Only Units 1-3 are assessed on the exam.",
    faqs: [
      {
        q: "Is AP Precalculus a new course?",
        a: "Yes. The course launched in the 2023-2024 school year and the first exam was administered in May 2024.",
      },
      {
        q: "Do colleges accept AP Precalculus?",
        a: "Acceptance is growing but uneven. Many colleges accept it for general quantitative-reasoning credit; some do not yet count it toward calculus prerequisites. Check your target schools.",
      },
      {
        q: "Should I take Precalculus before Calculus AB?",
        a: "Yes. Strong precalculus is the single best predictor of success in AP Calculus. AP Precalculus formalizes that preparation with a recognized exam.",
      },
      {
        q: "Is Unit 4 on the exam?",
        a: "No. Unit 4 (Functions Involving Parameters, Vectors, and Matrices) is taught as enrichment but is not assessed on the AP Precalculus Exam — only Units 1-3 appear.",
      },
    ],
    examDate2026: "Tue, May 12, 2026 (8 AM Local)",
  },
};

export const SUBJECT_BY_SLUG: Record<string, SubjectMeta> = Object.fromEntries(
  Object.values(SUBJECT_META).map((m) => [m.slug, m])
);

export const ALL_SUBJECTS: SubjectMeta[] = SUBJECT_KEYS.map((k) => SUBJECT_META[k]);

export function getRelatedSubjects(meta: SubjectMeta, limit = 4): SubjectMeta[] {
  return ALL_SUBJECTS.filter((s) => s.key !== meta.key && s.category === meta.category).slice(0, limit);
}

export const CATEGORY_LABELS: Record<SubjectCategory, string> = {
  math: "Math",
  science: "Science",
  history: "History",
  english: "English",
  social: "Social Sciences",
  cs: "Computer Science",
  economics: "Economics",
};
