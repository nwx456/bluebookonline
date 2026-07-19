import type { Metadata } from "next";
import { HomePage } from "@/components/home/HomePage";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();

const title = `${SITE_NAME} – AP Exam Practice Platform`;
const description =
  "Practice AP exams online with the real Bluebook experience. Upload PDFs, solve questions, get instant AI scoring. Free for AP CSA, AP CSP, AP Economics, AP Calculus and more. For students worldwide.";

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
  return <HomePage />;
}
