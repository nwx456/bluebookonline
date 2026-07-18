import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { CookieConsentBanner } from "@/components/CookieConsentBanner";
import { AdSenseLoader } from "@/components/AdSenseLoader";
import { SITE_NAME, SITE_URL } from "@/lib/site-config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const baseUrl = SITE_URL;

const adsenseClient =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT ?? "ca-pub-4827369932089836";

const defaultTitle = `${SITE_NAME} – AP Exam Practice Platform`;
const defaultDescription =
  "Practice AP exams online with the real Bluebook experience. Upload PDFs, solve questions, get instant AI scoring. Free for AP CSA, AP CSP, AP Economics, AP Calculus and more. For students worldwide.";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export const metadata: Metadata = {
  title: { default: defaultTitle, template: `%s | ${SITE_NAME}` },
  description: defaultDescription,
  keywords: [
    "AP exam",
    "AP sınav",
    "AP practice",
    "Bluebook",
    "AP CSA",
    "AP CSP",
    "AP Economics",
    "AP Calculus",
    "college board",
    "exam practice online",
    "práctica de exámenes AP",
    "AP考试练习",
    "تمرين امتحان AP",
    "AP examen oefenen",
    "AP examen pratique",
    "AP Prüfungsvorbereitung",
    "prática de exame AP",
  ],
  authors: [{ name: SITE_NAME, url: baseUrl }],
  creator: SITE_NAME,
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: baseUrl,
    languages: {
      en: baseUrl,
      "x-default": baseUrl,
    },
  },
  openGraph: {
    title: defaultTitle,
    description: defaultDescription,
    url: baseUrl,
    siteName: SITE_NAME,
    type: "website",
    locale: "en_US",
    alternateLocale: ["tr_TR", "es_ES", "zh_CN", "de_DE", "fr_FR", "ar_SA", "pt_BR", "ja_JP", "ko_KR", "hi_IN"],
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  verification: {
    google:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ??
      "2Vq7KT7ix17kMhqkmgZZnhff-iOpm9ptGvn4w9bPkQk",
  },
  other: {
    "google-adsense-account": adsenseClient,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    description: defaultDescription,
    url: baseUrl,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: ["en", "tr", "es", "zh", "ar", "de", "fr", "pt", "ja", "ko", "hi"],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('consent', 'default', {
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
                analytics_storage: 'denied',
                wait_for_update: 500
              });
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
        <CookieConsentBanner />
        <AdSenseLoader />
      </body>
    </html>
  );
}
