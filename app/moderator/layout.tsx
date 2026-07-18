import { SiteHeader } from "@/components/SiteHeader";

export const dynamic = "force-dynamic";

export default function ModeratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <SiteHeader />
      <div className="flex-1 mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">{children}</div>
    </div>
  );
}
