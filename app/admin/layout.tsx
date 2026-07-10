import { SiteHeader } from "@/components/SiteHeader";
import { AdminNav } from "./AdminNav";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <SiteHeader />
      <AdminNav />
      <div className="flex-1 mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">{children}</div>
    </div>
  );
}
