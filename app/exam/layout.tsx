import { Source_Serif_4 } from "next/font/google";

const sourceSerif = Source_Serif_4({
  variable: "--font-exam-serif",
  subsets: ["latin"],
});

export default function ExamLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className={sourceSerif.variable}>{children}</div>;
}
