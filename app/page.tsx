import type { Metadata } from "next";
import { HomeHero } from "@/components/home/HomeHero";
import { HomePage } from "@/components/home/HomePage";
import { getSiteUrl, SITE_META_DESCRIPTION, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();

const title = `${SITE_NAME} – AP Exam Practice Platform`;
const description = SITE_META_DESCRIPTION;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: baseUrl },
  openGraph: {
    title,
    description,
    url: baseUrl,
    type: "website",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <HomeHero program="AP" />
      <HomePage />
    </div>
  );
}
