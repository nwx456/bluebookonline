import type { BlogTocItem } from "@/lib/blog";

interface BlogTableOfContentsProps {
  items: BlogTocItem[];
}

export function BlogTableOfContents({ items }: BlogTableOfContentsProps) {
  if (items.length < 3) return null;

  return (
    <nav
      aria-label="Table of contents"
      className="mb-8 rounded-xl border border-blue-100 bg-blue-50/50 px-5 py-4"
    >
      <p className="text-sm font-semibold text-gray-900 mb-3">In this article</p>
      <ol className="space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              className="text-blue-700 hover:text-blue-900 hover:underline leading-snug"
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
