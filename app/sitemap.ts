import type { MetadataRoute } from "next";
import { ALL_SUBJECTS } from "@/lib/subject-meta";
import { getAllPostMeta, getPostLastModified } from "@/lib/blog";
import { SCORE_CALCULATOR_EXAMS } from "@/lib/score-calculator-data";
import { getSiteUrl } from "@/lib/site-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  const core: MetadataRoute.Sitemap = [
    {
      url: base,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/sat`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.98,
    },
    {
      url: `${base}/exams`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${base}/resources`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.75,
    },
    {
      url: `${base}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${base}/legal`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.45,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${base}/cookies`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${base}/copyright`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.35,
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
    const latestBlogUpdate = blogPosts.reduce((latest, p) => {
      const mod = new Date(getPostLastModified(p));
      return mod > latest ? mod : latest;
    }, new Date(0));
    blogUrls.push({
      url: `${base}/blog`,
      lastModified: latestBlogUpdate.getTime() > 0 ? latestBlogUpdate : now,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    });
    for (const p of blogPosts) {
      blogUrls.push({
        url: `${base}/blog/${p.slug}`,
        lastModified: new Date(getPostLastModified(p)),
        changeFrequency: "monthly" as const,
        priority: 0.75,
      });
    }
  }

  const toolUrls: MetadataRoute.Sitemap = [
    {
      url: `${base}/tools/ap-score-calculator`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    },
    ...SCORE_CALCULATOR_EXAMS.map((exam) => ({
      url: `${base}/tools/ap-score-calculator/${exam.slug}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.88,
    })),
  ];

  return [...core, ...subjectUrls, ...blogUrls, ...toolUrls];
}
