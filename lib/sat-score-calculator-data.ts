import {
  SAT_MATH_MODULE_MAX,
  SAT_RW_MODULE_MAX,
  type SatModule2Variant,
} from "@/lib/sat-scoring";

export interface SatCalculatorModule {
  id: string;
  label: string;
  max: number;
  section: "rw" | "math";
}

export const SAT_CALCULATOR_MODULES: SatCalculatorModule[] = [
  { id: "rwM1", label: "Reading & Writing — Module 1", max: SAT_RW_MODULE_MAX, section: "rw" },
  { id: "rwM2", label: "Reading & Writing — Module 2", max: SAT_RW_MODULE_MAX, section: "rw" },
  { id: "mathM1", label: "Math — Module 1", max: SAT_MATH_MODULE_MAX, section: "math" },
  { id: "mathM2", label: "Math — Module 2", max: SAT_MATH_MODULE_MAX, section: "math" },
];

export function defaultSatModuleScores(): Record<string, number> {
  return {
    rwM1: Math.floor(SAT_RW_MODULE_MAX * 0.7),
    rwM2: Math.floor(SAT_RW_MODULE_MAX * 0.65),
    mathM1: Math.floor(SAT_MATH_MODULE_MAX * 0.7),
    mathM2: Math.floor(SAT_MATH_MODULE_MAX * 0.65),
  };
}

export function defaultSatM2Variants(): { rw: SatModule2Variant; math: SatModule2Variant } {
  return { rw: "hard", math: "hard" };
}

export const SAT_SCORE_CALCULATOR_FAQ: { question: string; answer: string }[] = [
  {
    question: "How is the Digital SAT scored?",
    answer:
      "Reading & Writing and Math each scale to 200–800 from two adaptive modules. The total is 400–1600. College Board uses IRT equating, so the same raw correct count can map to slightly different scaled scores each test date.",
  },
  {
    question: "What is adaptive Module 2?",
    answer:
      "After Module 1, stronger performance routes you to a harder Module 2 with a higher score ceiling. Weaker Module 1 performance routes you to an easier Module 2 with a lower ceiling.",
  },
  {
    question: "Is this the official College Board calculator?",
    answer:
      "No. This is an independent estimate for practice planning. Only College Board publishes official Digital SAT scores after test day.",
  },
  {
    question: "How many questions are on each Digital SAT module?",
    answer:
      "Reading & Writing: 27 questions per module (54 total). Math: 22 questions per module (44 total). A full test has 98 scored questions across four modules.",
  },
  {
    question: "What SAT score is 1200 or 1400 in percentile?",
    answer:
      "Roughly, 1200 is near the 75th percentile and 1400 near the 94th percentile nationally — see our SAT score percentiles guide for the latest College Board data.",
  },
  {
    question: "Does wrong-answer penalty apply on the Digital SAT?",
    answer:
      "No. The Digital SAT does not deduct points for incorrect answers. Your module score is based on questions answered correctly.",
  },
];

export function buildSatCalculatorFaqJsonLd(pageUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: SAT_SCORE_CALCULATOR_FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
  };
}
