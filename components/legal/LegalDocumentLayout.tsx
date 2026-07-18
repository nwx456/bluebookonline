import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { LegalPrintButton } from "@/components/legal/LegalPrintButton";
import { LegalTableOfContents } from "@/components/legal/LegalTableOfContents";
import { TrademarkDisclaimer } from "@/components/legal/TrademarkDisclaimer";
import {
  LEGAL_DOCUMENT_CATALOG,
  type LegalDocument,
  type LegalDocumentSlug,
} from "@/lib/legal/documents";
import { CONTACT_EMAIL } from "@/lib/site-config";

type LegalDocumentLayoutProps = {
  doc: LegalDocument;
};

export function LegalDocumentLayout({ doc }: LegalDocumentLayoutProps) {
  const related = LEGAL_DOCUMENT_CATALOG.filter((d) => d.slug !== doc.slug);

  return (
    <div className="min-h-screen bg-[#F9FAFB] legal-document-page">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6 print:hidden">
          <Link href="/legal" className="text-sm text-blue-600 hover:underline">
            ← Legal center
          </Link>
        </div>

        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
          <LegalTableOfContents headings={doc.headings} basePath={doc.href} />

          <article className="min-w-0 rounded-2xl border border-gray-100 bg-white p-6 sm:p-8 shadow-sm print:border-0 print:shadow-none print:p-0">
            <header className="border-b border-gray-100 pb-6 mb-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900">{doc.title}</h1>
                  <p className="mt-2 text-sm text-gray-500">
                    Last updated: {doc.lastUpdated} · Version {doc.version}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Previous summary version 1.0 (July 2026) — superseded by this full document.
                  </p>
                </div>
                <LegalPrintButton />
              </div>
              <p className="mt-4 text-sm text-gray-600 leading-relaxed">{doc.description}</p>
            </header>

            <div
              className="prose-legal"
              dangerouslySetInnerHTML={{ __html: doc.contentHtml }}
            />

            <footer className="mt-10 border-t border-gray-100 pt-6 text-sm text-gray-600 space-y-3">
              <TrademarkDisclaimer variant="full" />
              <p>
                Questions? Contact{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
                  {CONTACT_EMAIL}
                </a>
                . Manage your data at{" "}
                <Link href="/settings/privacy" className="text-blue-600 hover:underline">
                  Privacy settings
                </Link>
                .
              </p>
            </footer>
          </article>
        </div>

        <section className="mt-10 print:hidden">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Related documents</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <Link
                key={item.slug}
                href={item.href}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-200 hover:shadow-md transition-shadow"
              >
                <h3 className="font-medium text-gray-900">{item.title}</h3>
                <p className="mt-1 text-sm text-gray-600 line-clamp-2">{item.summary}</p>
                <span className="mt-2 inline-block text-sm text-blue-600">Read document →</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </div>
  );
}

export function legalMetadata(doc: LegalDocument) {
  return {
    title: doc.title,
    description: doc.description,
  };
}

export type { LegalDocumentSlug };
