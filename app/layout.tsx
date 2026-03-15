import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "https://apbluebookonline.com";

export const metadata: Metadata = {
  title: "Bluebook Online",
  description: "Mimics the real Bluebook digital exam experience. Practice AP exams online. Upload PDFs, solve questions, get instant AI scoring. Free educational platform for AP students.",
  openGraph: {
    title: "Bluebook Online – AP Exam Practice",
    description: "Mimics the real Bluebook digital exam experience. Practice AP exams online. Upload PDFs, solve questions, get instant AI scoring.",
    url: baseUrl,
    siteName: "Bluebook Online",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bluebook Online – AP Exam Practice",
    description: "Mimics the real Bluebook digital exam experience. Practice AP exams online. Upload PDFs, solve questions, get instant AI scoring.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
