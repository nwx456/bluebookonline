import type { Metadata } from "next";
import { HomePage } from "@/components/home/HomePage";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();
const satUrl = `${baseUrl}/sat`;

const title = `${SITE_NAME} – Digital SAT Practice Platform`;
const description =
  "Practice Digital SAT online with the real Bluebook experience. Reading & Writing and Math modules, adaptive Module 2, Desmos calculator, grid-in support, and instant AI scoring. Free for students worldwide.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: satUrl },
  openGraph: {
    title,
    description,
    url: satUrl,
    type: "website",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function SatLandingPage() {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      {
        "@type": "ListItem",
        position: 2,
        name: "Digital SAT Practice",
        item: satUrl,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <HomePage />
    </>
  );
}
