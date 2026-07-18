import Link from "next/link";
import { formatBlogDate, type BlogPostMeta } from "@/lib/blog";

interface BlogRelatedPostsProps {
  posts: BlogPostMeta[];
}

export function BlogRelatedPosts({ posts }: BlogRelatedPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Related posts</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {posts.map((p) => (
          <Link
            key={p.slug}
            href={`/blog/${p.slug}`}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-lg hover:border-blue-300 transition-all"
          >
            {p.category && (
              <p className="text-xs font-medium text-blue-600 mb-1">{p.category}</p>
            )}
            <p className="text-xs text-gray-500">{formatBlogDate(p.date)}</p>
            <h3 className="mt-1 text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
              {p.title}
            </h3>
            <p className="mt-2 text-xs text-gray-600 leading-relaxed line-clamp-2">
              {p.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
