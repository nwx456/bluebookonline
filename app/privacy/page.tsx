import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentLayout, legalMetadata } from "@/components/legal/LegalDocumentLayout";
import { getLegalDocument } from "@/lib/legal/documents";

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLegalDocument("privacy");
  if (!doc) return { title: "Privacy Policy" };
  const meta = legalMetadata(doc);
  return { title: meta.title, description: meta.description };
}

export default async function PrivacyPage() {
  const doc = await getLegalDocument("privacy");
  if (!doc) notFound();
  return <LegalDocumentLayout doc={doc} />;
}
