import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/site-config";

const PRIVATE_DISALLOW = [
  "/api/",
  "/dashboard",
  "/exam/",
  "/frq/",
  "/admin",
  "/moderator",
  "/teacher",
  "/settings",
];

const AI_USER_AGENTS = [
  "GPTBot",
  "ChatGPT-User",
  "PerplexityBot",
  "ClaudeBot",
  "anthropic-ai",
  "Google-Extended",
];

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_DISALLOW,
      },
      ...AI_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow: "/" as const,
        disallow: PRIVATE_DISALLOW,
      })),
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
