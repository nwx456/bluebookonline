import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

export interface HowToStep {
  name: string;
  text: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function buildWebSiteJsonLd() {
  const baseUrl = getSiteUrl();
  return {
    "@type": "WebSite",
    name: SITE_NAME,
    url: baseUrl,
    description:
      "Free Bluebook-style AP and Digital SAT practice tests with instant AI scoring and score calculators.",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: baseUrl,
    },
    inLanguage: "en",
  };
}

export function buildHowToJsonLd(options: {
  name: string;
  description: string;
  url: string;
  steps: HowToStep[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: options.name,
    description: options.description,
    url: options.url,
    step: options.steps.map((step, index) => ({
      "@type": "HowToStep",
      position: index + 1,
      name: step.name,
      text: step.text,
    })),
  };
}

export function buildFaqPageJsonLd(faq: FaqItem[], pageUrl: string) {
  if (!faq.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
  };
}

export function buildSoftwareApplicationJsonLd(options: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: options.name,
    description: options.description,
    url: options.url,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    provider: { "@type": "Organization", name: SITE_NAME, url: getSiteUrl() },
  };
}

export const AP_CALCULATOR_HOW_TO_STEPS: HowToStep[] = [
  {
    name: "Enter your MCQ score",
    text: "Type how many multiple-choice questions you answered correctly out of the exam total.",
  },
  {
    name: "Enter FRQ points",
    text: "Add points earned on each free-response part based on your rubric or self-score.",
  },
  {
    name: "Read your estimated AP score",
    text: "The calculator weights MCQ and FRQ using official section percentages and maps the composite to a 1–5 estimate.",
  },
];

export const SAT_CALCULATOR_HOW_TO_STEPS: HowToStep[] = [
  {
    name: "Enter module scores",
    text: "Type correct answers for Reading & Writing Module 1, Module 2, Math Module 1, and Math Module 2.",
  },
  {
    name: "Set Module 2 path",
    text: "Toggle easy or hard Module 2 for each section to match your adaptive routing after Module 1.",
  },
  {
    name: "Read section and total scores",
    text: "Review estimated Reading & Writing, Math, and total 400–1600 scores based on practice performance.",
  },
];

export const AP_CALCULATOR_HUB_FAQ: FaqItem[] = [
  {
    question: "Are these AP score calculators official?",
    answer:
      "No. They are independent estimates based on publicly released College Board section weights and historical composite cutoffs. College Board applies annual equating that can shift cutoffs.",
  },
  {
    question: "How accurate are AP score calculator predictions?",
    answer:
      "They are useful planning tools when you enter honest practice scores. Final 1–5 scores depend on equating, which is not published before July score release.",
  },
  {
    question: "Do all 24 AP exams use the same scoring weights?",
    answer:
      "No. Each exam has its own MCQ/FRQ split defined in the Course and Exam Description. Each calculator on this site uses that subject's official weights.",
  },
  {
    question: "Can I use these calculators during the real AP exam?",
    answer:
      "No. Calculators here are for post-practice review only. On exam day you follow College Board rules in the Bluebook app.",
  },
  {
    question: "Where can I practice after estimating my score?",
    answer:
      "Browse free Bluebook-style practice tests for every AP subject at /exams, then return to the calculator with updated MCQ and FRQ results.",
  },
];
