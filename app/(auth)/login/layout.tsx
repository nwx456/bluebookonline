import type { Metadata } from "next";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Sign In",
  description: `Sign in to ${SITE_NAME}. Practice AP exams with the real Bluebook experience.`,
  alternates: { canonical: `${baseUrl}/login` },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
