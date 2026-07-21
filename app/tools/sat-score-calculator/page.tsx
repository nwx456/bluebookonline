import type { Metadata } from "next";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SatScoreCalculatorWidget } from "@/components/tools/SatScoreCalculatorWidget";
import {
  buildHowToJsonLd,
  SAT_CALCULATOR_HOW_TO_STEPS,
} from "@/lib/geo-schema";
import {
  buildSatCalculatorFaqJsonLd,
  SAT_SCORE_CALCULATOR_FAQ,
} from "@/lib/sat-score-calculator-data";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();
const pageUrl = `${baseUrl}/tools/sat-score-calculator`;

export const metadata: Metadata = {
  title: "Digital SAT Score Calculator 2026 — Free Score Predictor",
  description:
    "Free Digital SAT score calculator. Enter correct answers for all four modules to estimate your Reading & Writing, Math, and total 400–1600 score.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: `Digital SAT Score Calculator 2026 | ${SITE_NAME}`,
    description:
      "Estimate your Digital SAT score from module-by-module practice results. Includes adaptive Module 2 routing (easy vs hard path).",
    url: pageUrl,
    type: "website",
    images: [`${baseUrl}/og-image.png`],
  },
};

export default function SatScoreCalculatorPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Digital SAT", item: `${baseUrl}/sat` },
      {
        "@type": "ListItem",
        position: 3,
        name: "SAT Score Calculator",
        item: pageUrl,
      },
    ],
  };

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Digital SAT Score Calculator",
    description:
      "Free Digital SAT score calculator that estimates section and total scores from module-level practice results.",
    url: pageUrl,
    applicationCategory: "EducationalApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    provider: { "@type": "Organization", name: SITE_NAME, url: baseUrl },
  };

  const howToJsonLd = buildHowToJsonLd({
    name: "How to use the Digital SAT score calculator",
    description:
      "Estimate your Digital SAT section and total scores from module-level practice results.",
    url: pageUrl,
    steps: SAT_CALCULATOR_HOW_TO_STEPS,
  });

  const faqJsonLd = buildSatCalculatorFaqJsonLd(pageUrl);

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12">
        <section className="mb-8 rounded-2xl bg-gradient-to-b from-white to-blue-50/30 px-6 py-10 shadow-sm border border-gray-100 text-center">
          <Calculator className="mx-auto h-10 w-10 text-blue-600 mb-3" />
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
            Digital SAT Score Calculator 2026
          </h1>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Enter how many questions you answered correctly in each module. Toggle easy or hard
            Module 2 paths to reflect adaptive routing. Scores are estimates — College Board uses
            IRT equating on every administration.
          </p>
          <Link
            href="/blog/how-digital-sat-adaptive-testing-works"
            className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:underline"
          >
            How Digital SAT adaptive scoring works &rarr;
          </Link>
        </section>

        <SatScoreCalculatorWidget />

        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">How this calculator works</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-600 list-disc pl-5">
            <li>
              Reading &amp; Writing: 2 modules × 27 questions (200–800 scaled). Math: 2 modules ×
              22 questions (200–800 scaled).
            </li>
            <li>
              Module 1 performance routes you to an easier or harder Module 2. Hard Module 2 unlocks
              a higher score ceiling.
            </li>
            <li>
              No penalty for wrong answers — enter total correct per module from a Bluebook practice
              test.
            </li>
          </ul>
          <p className="mt-4 text-sm">
            <Link
              href="/blog/digital-sat-score-calculator-how-to-use"
              className="text-blue-600 hover:underline"
            >
              Step-by-step calculator guide
            </Link>
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">FAQ</h2>
          <div className="space-y-3">
            {SAT_SCORE_CALCULATOR_FAQ.map((item) => (
              <div key={item.question} className="rounded-lg bg-white border border-gray-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-gray-900">{item.question}</h3>
                <p className="mt-1 text-sm text-gray-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
