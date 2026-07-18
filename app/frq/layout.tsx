import { Source_Serif_4 } from "next/font/google";

const sourceSerif = Source_Serif_4({
  variable: "--font-exam-serif",
  subsets: ["latin"],
  display: "swap",
});

export default function FrqLayout({ children }: { children: React.ReactNode }) {
  return <div className={sourceSerif.variable}>{children}</div>;
}
