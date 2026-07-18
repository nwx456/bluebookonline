import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { TrademarkDisclaimer } from "@/components/legal/TrademarkDisclaimer";
import { LEGAL_DOCUMENT_CATALOG } from "@/lib/legal/documents";
import { CONTACT_EMAIL, COPYRIGHT_EMAIL, SITE_NAME } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Legal Center",
  description:
    `Terms, Privacy, Cookies, Copyright, and data rights for ${SITE_NAME} users worldwide.`,
};

export default function LegalCenterPage() {
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <header className="mb-10">
          <h1 className="text-3xl font-semibold text-gray-900">Legal center</h1>
          <p className="mt-3 text-gray-600 leading-relaxed max-w-2xl">
            These policies apply to users worldwide. They explain how {SITE_NAME} works, how we
            handle your data, and your rights regarding uploads, AI processing, cookies, and
            copyright. Regional addenda (EU/GDPR, Turkey/KVKK, US state laws, MENA) are included in
            our Privacy Policy.
          </p>
          <p className="mt-2 text-sm text-gray-500">Last updated: July 2026 · Policy version 2.1</p>
          <TrademarkDisclaimer variant="callout" className="mt-6" />
        </header>

        <div className="grid gap-4 sm:grid-cols-2">
          {LEGAL_DOCUMENT_CATALOG.map((doc) => (
            <Link
              key={doc.slug}
              href={doc.href}
              className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-blue-200 hover:shadow-md transition-all"
            >
              <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">
                {doc.title}
              </h2>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{doc.summary}</p>
              <span className="mt-4 inline-block text-sm font-medium text-blue-600">
                Read full document →
              </span>
            </Link>
          ))}

          <Link
            href="/settings/privacy"
            className="group rounded-xl border border-gray-200 bg-white p-6 shadow-sm hover:border-blue-200 hover:shadow-md transition-all sm:col-span-2"
          >
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-gray-500 mt-0.5 shrink-0" aria-hidden />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 group-hover:text-blue-700">
                  Privacy settings
                </h2>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  Download your data, manage marketing and cookie preferences, or delete your
                  account.
                </p>
                <span className="mt-4 inline-block text-sm font-medium text-blue-600">
                  Open settings →
                </span>
              </div>
            </div>
          </Link>
        </div>

        <section className="mt-10 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          <p>
            Questions about these policies? Email{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-600 hover:underline">
              {CONTACT_EMAIL}
            </a>
            . Copyright complaints:{" "}
            <a href={`mailto:${COPYRIGHT_EMAIL}`} className="text-blue-600 hover:underline">
              {COPYRIGHT_EMAIL}
            </a>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
