import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Sign Up",
  description: `Create a free ${SITE_NAME} account. Practice AP exams, upload PDFs, get AI scoring.`,
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
