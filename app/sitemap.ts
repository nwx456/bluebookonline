import type { MetadataRoute } from "next";
import { ALL_SUBJECTS } from "@/lib/subject-meta";
import { getAllPostMeta } from "@/lib/blog";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "https://apbluebookonline.com";
  const now = new Date();

  const core: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/exams`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${base}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/signup`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const subjectUrls: MetadataRoute.Sitemap = ALL_SUBJECTS.map((s) => ({
    url: `${base}/exams/${s.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));

  const blogPosts = getAllPostMeta();
  const blogUrls: MetadataRoute.Sitemap = [];
  if (blogPosts.length > 0) {
    blogUrls.push({
      url: `${base}/blog`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    });
    for (const p of blogPosts) {
      blogUrls.push({
        url: `${base}/blog/${p.slug}`,
        lastModified: new Date(p.date),
        changeFrequency: "monthly" as const,
        priority: 0.75,
      });
    }
  }

  return [...core, ...subjectUrls, ...blogUrls];
}
