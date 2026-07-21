import type { Metadata } from "next";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Forgot Password",
  description: `Reset your ${SITE_NAME} password.`,
  alternates: { canonical: `${baseUrl}/forgot-password` },
  robots: { index: false, follow: true },
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
