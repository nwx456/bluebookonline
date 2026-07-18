import Link from "next/link";
import type { BlogPostMeta } from "@/lib/blog";

interface BlogPostCtaProps {
  post: BlogPostMeta;
}

export function BlogPostCta({ post }: BlogPostCtaProps) {
  const primaryHref = post.ctaPrimaryHref ?? "/exams";
  const primaryLabel = post.ctaPrimaryLabel ?? "Take a free AP practice test";
  const secondaryHref = post.ctaSecondaryHref ?? "/dashboard/generate";
  const secondaryLabel = post.ctaSecondaryLabel ?? "Generate a custom exam from your notes";

  return (
    <aside className="mt-10 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white px-6 py-6">
      <h2 className="text-lg font-semibold text-gray-900">Practice what you learned</h2>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">
        Put these strategies to work with free Bluebook-style AP practice on AP Practice Exam Online.
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
