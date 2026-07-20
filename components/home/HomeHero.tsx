import Link from "next/link";
import { BrandLogo } from "@/components/BrandLogo";
import { SiteHeader } from "@/components/SiteHeader";
import { HomeHeroAuthActions } from "@/components/home/HomeHeroAuthActions";
import type { ExamProgram } from "@/lib/exam-program";
import { getHomeHeroContent } from "@/lib/home-hero-content";

type HomeHeroProps = {
  program: ExamProgram;
};

export function HomeHero({ program }: HomeHeroProps) {
  const {
    faqJsonLd,
    heroTitle,
    heroSubtitle,
    heroDescription,
    heroLinkLabel,
    examsHref,
  } = getHomeHeroContent(program);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <SiteHeader />
      <div className="mx-auto w-full max-w-4xl px-3 sm:px-4">
        <section className="mb-8 text-center rounded-2xl bg-gradient-to-b from-white to-gray-50/80 px-3 py-6 shadow-sm border border-gray-100 sm:px-6 sm:py-10 mt-6 sm:mt-8">
          <div className="flex flex-col items-center gap-6 w-full">
            <BrandLogo size="hero" priority />
            <h1 className="text-xl font-bold tracking-tight leading-tight text-gray-900 sm:text-3xl lg:text-4xl max-w-3xl">
              {heroTitle}
            </h1>
            <p className="text-base text-gray-600 max-w-2xl">{heroSubtitle}</p>
          </div>
          <div className="mt-5">
            <Link
              href={examsHref}
              className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
            >
              {heroLinkLabel}
            </Link>
          </div>
          <HomeHeroAuthActions />
        </section>

        <p className="mb-8 max-w-2xl mx-auto px-4 text-center text-sm leading-relaxed text-gray-500">
          {heroDescription}
        </p>
      </div>
    </>
  );
}
