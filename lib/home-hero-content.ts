import { SUBJECT_KEYS } from "@/lib/subjects";
import { getExamProgram, type ExamProgram } from "@/lib/exam-program";

const AP_SUBJECT_KEYS = SUBJECT_KEYS.filter((k) => getExamProgram(k) === "AP");

export const HOME_FAQ_JSON_LD_AP = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is AP Practice Exam Online?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A free platform that mimics the real College Board Bluebook digital exam experience. Practice AP and SAT exams with a familiar interface: upload PDFs, solve multiple-choice questions, and get instant scoring. AI can generate answer keys when your PDF has none.",
      },
    },
    {
      "@type": "Question",
      name: "Is it free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. AP Practice Exam Online mimics the real Bluebook experience and is free for educational use. Sign up to upload and publish exams.",
      },
    },
    {
      "@type": "Question",
      name: "How does AI scoring work?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "If your PDF has no answer key, AI generates one when you first complete the exam. The key is saved so future attempts skip AI and use the stored answers.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use my own PDFs?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Sign in, go to Dashboard, and upload your AP exam PDF. The system extracts questions automatically. You can publish exams to share with others.",
      },
    },
  ],
};

export const HOME_FAQ_JSON_LD_SAT = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is AP Practice Exam Online SAT practice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A free Digital SAT practice platform mimicking the real Bluebook experience. Upload SAT PDFs (Reading & Writing, Math, or a full test) and solve adaptive modules with grid-in support and a built-in Desmos calculator.",
      },
    },
    {
      "@type": "Question",
      name: "How long is the Digital SAT?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Approximately 2 hours 14 minutes: Reading & Writing (2 modules x 32 min, 27 questions each) followed by Math (2 modules x 35 min, 22 questions each).",
      },
    },
    {
      "@type": "Question",
      name: "Does this support grid-in questions?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. SAT Math grid-in (Student-Produced Response) questions are fully supported with a numeric input box and AI-graded answer checking.",
      },
    },
    {
      "@type": "Question",
      name: "Is there a built-in calculator?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. SAT Math modules embed the official Desmos graphing calculator, available throughout the section just like the real Digital SAT.",
      },
    },
  ],
};

export function getHomeHeroContent(program: ExamProgram) {
  const examsHref = program === "SAT" ? "/exams?program=sat" : "/exams";

  if (program === "SAT") {
    return {
      faqJsonLd: HOME_FAQ_JSON_LD_SAT,
      heroTitle: "Free Digital SAT Practice with the Bluebook Experience",
      heroSubtitle:
        "Practice Digital SAT (Reading & Writing + Math) with AI-scored modules. Upload your own PDF or solve community-published full tests.",
      heroDescription:
        "AP Practice Exam Online mimics the real Digital SAT Bluebook interface. Adaptive Module 2 routing, built-in Desmos graphing calculator on Math, grid-in support, and scaled scoring (400–1600). Free for students worldwide.",
      heroLinkLabel: "Browse SAT practice tests →",
      examsHref,
    };
  }

  return {
    faqJsonLd: HOME_FAQ_JSON_LD_AP,
    heroTitle: "Free AP Exam Practice with the Bluebook Experience",
    heroSubtitle: `Practice ${AP_SUBJECT_KEYS.length} AP subjects with AI-scored digital exams. Upload your own PDF or solve community-published mock tests.`,
    heroDescription:
      "AP Practice Exam Online mimics the real College Board Bluebook digital exam interface. Get a familiar testing layout, instant AI scoring, and detailed answer explanations for every AP practice test. Free for students worldwide. For educational practice only.",
    heroLinkLabel: "Browse all 24 AP practice tests →",
    examsHref: "/exams",
  };
}

export { AP_SUBJECT_KEYS };
