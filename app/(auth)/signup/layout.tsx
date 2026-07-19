import type { Metadata } from "next";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Sign Up",
  description: `Create a free ${SITE_NAME} account. Practice AP exams, upload PDFs, get AI scoring.`,
  alternates: { canonical: `${baseUrl}/signup` },
  robots: { index: false, follow: true },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
