import Link from "next/link";
import type { BlogPostMeta } from "@/lib/blog";
import { getPostProgram } from "@/lib/blog";
import { scoreCalculatorHref } from "@/lib/header-nav-items";

interface BlogPostCtaProps {
  post: BlogPostMeta;
}

function apCalculatorHrefFromPost(post: BlogPostMeta): string | null {
  const match = /^ap-(.+)-complete-guide$/.exec(post.slug);
  if (match) return `/tools/ap-score-calculator/ap-${match[1]}`;
  return null;
}

export function BlogPostCta({ post }: BlogPostCtaProps) {
  const isSat = getPostProgram(post) === "SAT";
  const primaryHref = post.ctaPrimaryHref ?? (isSat ? "/exams?program=sat" : "/exams");
  const primaryLabel =
    post.ctaPrimaryLabel ??
    (isSat ? "Take a free Digital SAT practice test" : "Take a free AP practice test");

  const defaultSecondaryHref = isSat
    ? "/tools/sat-score-calculator"
    : apCalculatorHrefFromPost(post) ?? scoreCalculatorHref("AP");

  const secondaryHref = post.ctaSecondaryHref ?? defaultSecondaryHref;
  const secondaryLabel =
    post.ctaSecondaryLabel ??
    (isSat ? "Estimate your SAT score" : "Estimate your AP score");

  return (
    <aside className="mt-10 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white px-6 py-6">
      <h2 className="text-lg font-semibold text-gray-900">Practice what you learned</h2>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">
        {isSat
          ? "Put these strategies to work with free Bluebook-style Digital SAT practice on AP Practice Exam Online."
          : "Put these strategies to work with free Bluebook-style AP practice on AP Practice Exam Online."}
      </p>
      <div className="mt-4 flex flex-col sm:flex-row gap-3">
        <Link
          href={primaryHref}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {primaryLabel}
        </Link>
        <Link
          href={secondaryHref}
          className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          {secondaryLabel}
        </Link>
      </div>
    </aside>
  );
}
