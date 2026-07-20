"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isAdminBroadcastEmail } from "@/lib/admin-mail";
import { PresentationShell } from "@/components/presentation/PresentationShell";
import { usePresentationStats } from "@/components/presentation/usePresentationStats";
import { getPresentationContent } from "@/components/presentation/content";

export default function AdminPresentationEnPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const { stats, loading: statsLoading } = usePresentationStats(accessToken);
  const { ui } = getPresentationContent("en");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setChecking(false);
        router.replace("/login");
        return;
      }
      if (!isAdminBroadcastEmail(session.user.email)) {
        router.replace("/dashboard");
        return;
      }
      setAccessToken(session.access_token ?? null);
      setChecking(false);
    });
  }, [router]);

  if (checking) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F9FAFB]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" aria-label={ui.loading} />
      </div>
    );
  }

  return <PresentationShell locale="en" stats={stats} statsLoading={statsLoading} />;
}
