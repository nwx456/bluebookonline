import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ApScoreCalculatorWidget } from "@/components/tools/ApScoreCalculatorWidget";
import {
  buildFaqJsonLdForCalculator,
  getScoreCalculatorExam,
  SCORE_CALCULATOR_EXAMS,
  SCORE_CALCULATOR_DISCLAIMER,
} from "@/lib/score-calculator-data";
import { AP_CALCULATOR_HOW_TO_STEPS, buildHowToJsonLd } from "@/lib/geo-schema";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();

export function generateStaticParams() {
  return SCORE_CALCULATOR_EXAMS.map((exam) => ({ slug: exam.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const exam = getScoreCalculatorExam(slug);
  if (!exam) return { title: "Calculator not found" };
  const url = `${baseUrl}/tools/ap-score-calculator/${exam.slug}`;
  return {
    title: exam.seoTitle,
    description: exam.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: `${exam.seoTitle} | ${SITE_NAME}`,
      description: exam.metaDescription,
      url,
      type: "website",
      images: [`${baseUrl}/og-image.png`],
    },
  };
}

export default async function ApScoreCalculatorSubjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const exam = getScoreCalculatorExam(slug);
  if (!exam) notFound();

  const url = `${baseUrl}/tools/ap-score-calculator/${exam.slug}`;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "AP Score Calculator",
        item: `${baseUrl}/tools/ap-score-calculator`,
      },
      { "@type": "ListItem", position: 3, name: exam.name, item: url },
    ],
  };

  const faqJsonLd = buildFaqJsonLdForCalculator(exam, url);

  const howToJsonLd = buildHowToJsonLd({
    name: `How to use the ${exam.name} score calculator`,
    description: exam.metaDescription,
    url,
    steps: AP_CALCULATOR_HOW_TO_STEPS,
  });

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />

      <SiteHeader />

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-10">
        <Link
          href="/tools/ap-score-calculator"
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          All calculators
        </Link>

        <header className="mb-8">
          <h1 className="text-3xl font-semibold text-gray-900 leading-tight">
            {exam.name} Score Calculator
          </h1>
          <p className="mt-3 text-gray-600 leading-relaxed">{exam.metaDescription}</p>
        </header>

        <ApScoreCalculatorWidget exam={exam} />

        <section className="mt-8 rounded-xl border border-amber-100 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {SCORE_CALCULATOR_DISCLAIMER}
        </section>

        {exam.faq.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">FAQ</h2>
            <div className="space-y-3">
              {exam.faq.map((item) => (
                <div key={item.question} className="rounded-lg bg-white border border-gray-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-gray-900">{item.question}</h3>
                  <p className="mt-1 text-sm text-gray-600">{item.answer}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 text-sm text-gray-600">
          <p>
            Learn more:{" "}
            <Link href="/blog/how-ap-exams-are-scored" className="text-blue-600 hover:underline">
              How AP exams are scored
            </Link>
            {" · "}
            <Link href={`/exams/${exam.examSlug}`} className="text-blue-600 hover:underline">
              {exam.name} practice tests
            </Link>
          </p>
          <p className="mt-2">
            Official reference:{" "}
            <a
              href="https://apcentral.collegeboard.org/courses"
              className="text-blue-600 hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              College Board AP Courses
            </a>
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
