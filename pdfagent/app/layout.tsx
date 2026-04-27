import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pdfagent admin",
  description: "PDF ingestion agent admin panel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
