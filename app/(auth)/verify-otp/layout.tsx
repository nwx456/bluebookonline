import type { Metadata } from "next";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Verify Email",
  description: `Verify your email for ${SITE_NAME}.`,
  alternates: { canonical: `${baseUrl}/verify-otp` },
  robots: { index: false, follow: true },
};

export default function VerifyOtpLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
