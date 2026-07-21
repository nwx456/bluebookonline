import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, ArrowRight } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import {
  AP_CALCULATOR_HOW_TO_STEPS,
  AP_CALCULATOR_HUB_FAQ,
  buildFaqPageJsonLd,
  buildHowToJsonLd,
} from "@/lib/geo-schema";
import { SCORE_CALCULATOR_EXAMS } from "@/lib/score-calculator-data";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();
const pageUrl = `${baseUrl}/tools/ap-score-calculator`;

export const metadata: Metadata = {
  title: "AP Score Calculator 2026 — Free Score Predictors",
  description:
    "Free AP score calculators for all 24 AP exams. Enter MCQ and FRQ practice scores to predict your 1–5 AP score. Based on official section weights.",
  alternates: { canonical: pageUrl },
  openGraph: {
    title: `AP Score Calculator 2026 | ${SITE_NAME}`,
    description:
      "Predict your AP exam score from practice test results. Free calculators for all 24 AP subjects including Calculus, Biology, Chemistry, Physics, History, and more.",
    url: pageUrl,
    type: "website",
    images: [`${baseUrl}/og-image.png`],
  },
};

export default function ApScoreCalculatorHubPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "AP Score Calculator",
        item: pageUrl,
      },
    ],
  };

  const webPageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "AP Score Calculator",
    description:
      "Free AP score calculators that estimate your 1–5 score from multiple-choice and free-response practice results.",
    url: pageUrl,
    applicationCategory: "EducationalApplication",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    provider: { "@type": "Organization", name: SITE_NAME, url: baseUrl },
  };

  const howToJsonLd = buildHowToJsonLd({
    name: "How to use an AP score calculator",
    description:
      "Estimate your AP exam score from multiple-choice and free-response practice results.",
    url: pageUrl,
    steps: AP_CALCULATOR_HOW_TO_STEPS,
  });

  const faqJsonLd = buildFaqPageJsonLd(AP_CALCULATOR_HUB_FAQ, pageUrl);

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
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-12">
        <section className="mb-10 rounded-2xl bg-gradient-to-b from-white to-blue-50/30 px-6 py-10 shadow-sm border border-gray-100 text-center">
          <Calculator className="mx-auto h-10 w-10 text-blue-600 mb-3" />
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">
            AP Score Calculator 2026
          </h1>
          <p className="mt-3 text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Enter your practice test results to estimate your AP score on the 1–5 scale. Each
            calculator uses official College Board section weights and historical composite cutoffs.
            Scores are estimates — College Board applies annual equating after each exam.
          </p>
          <Link
            href="/blog/how-ap-exams-are-scored"
            className="mt-4 inline-flex text-sm font-medium text-blue-600 hover:underline"
          >
            How AP scoring and equating work &rarr;
          </Link>
        </section>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {SCORE_CALCULATOR_EXAMS.map((exam) => (
            <Link
              key={exam.slug}
              href={`/tools/ap-score-calculator/${exam.slug}`}
              className="group rounded-lg border border-gray-200 bg-white p-5 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all flex items-center justify-between"
            >
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{exam.name}</h2>
                <p className="mt-1 text-sm text-gray-600">
                  {exam.mcqCount} MCQs &middot; {exam.frqParts.length} FRQ parts
                </p>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 transition-colors" />
            </Link>
          ))}
        </div>

        <section className="mt-10 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">How these calculators work</h2>
          <ul className="mt-3 space-y-2 text-sm text-gray-600 list-disc pl-5">
            <li>
              Your raw MCQ and FRQ points are weighted using each exam&apos;s official section
              percentages from the Course and Exam Description.
            </li>
            <li>
              The combined composite is mapped to a 1–5 score using cutoffs from publicly released
              past scoring data.
            </li>
            <li>
              College Board adjusts cutoffs each year through equating — treat predictions as
              planning tools, not guarantees.
            </li>
          </ul>
          <p className="mt-4 text-sm">
            <Link href="/blog/ap-score-distributions" className="text-blue-600 hover:underline">
              See 2026 AP score distributions and pass rates
            </Link>
            {" · "}
            <Link href="/blog/ap-score-calculator-how-to-use" className="text-blue-600 hover:underline">
              Step-by-step calculator guide
            </Link>
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">FAQ</h2>
          <div className="space-y-3">
            {AP_CALCULATOR_HUB_FAQ.map((item) => (
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
