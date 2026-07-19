import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentLayout, legalMetadata } from "@/components/legal/LegalDocumentLayout";
import { getLegalDocument } from "@/lib/legal/documents";

export async function generateMetadata(): Promise<Metadata> {
  const doc = await getLegalDocument("copyright");
  if (!doc) return { title: "Copyright & DMCA Policy" };
  const meta = legalMetadata(doc);
  return { title: meta.title, description: meta.description, alternates: meta.alternates };
}

export default async function CopyrightPage() {
  const doc = await getLegalDocument("copyright");
  if (!doc) notFound();
  return <LegalDocumentLayout doc={doc} />;
}
