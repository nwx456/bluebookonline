import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Sign In",
  description: `Sign in to ${SITE_NAME}. Practice AP exams with the real Bluebook experience.`,
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
