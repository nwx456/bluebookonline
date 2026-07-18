import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentLayout, legalMetadata } from "@/components/legal/LegalDocumentLayout";
import { getLegalDocument } from "@/lib/legal/documents";

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLegalDocument("terms");
  if (!doc) return { title: "Terms of Service" };
  const meta = legalMetadata(doc);
  return { title: meta.title, description: meta.description };
}

export default async function TermsPage() {
  const doc = await getLegalDocument("terms");
  if (!doc) notFound();
  return <LegalDocumentLayout doc={doc} />;
}
