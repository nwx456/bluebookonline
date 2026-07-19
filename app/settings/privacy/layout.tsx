import type { Metadata } from "next";
import { getSiteUrl, SITE_NAME } from "@/lib/site-config";

const baseUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Privacy Settings",
  description: `Manage consent, data export, and account deletion for your ${SITE_NAME} account.`,
  alternates: { canonical: `${baseUrl}/settings/privacy` },
  robots: { index: false, follow: true },
};

export default function PrivacySettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
