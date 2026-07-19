import type { Metadata } from "next";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Teacher Resources — Free AP & SAT Study Materials",
  description:
    `Browse community-published AP and Digital SAT study resources on ${SITE_NAME}. Free teacher-shared PDFs, links, and practice materials.`,
  alternates: { canonical: `${baseUrl}/resources` },
  openGraph: {
    title: `Teacher Resources | ${SITE_NAME}`,
    description:
      "Free AP and Digital SAT study materials shared by teachers and the community.",
    url: `${baseUrl}/resources`,
    type: "website",
    images: ["/og-image.png"],
  },
};

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
