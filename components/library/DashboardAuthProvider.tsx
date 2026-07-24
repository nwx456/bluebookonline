"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isIgnorableClientError } from "@/lib/ignorable-client-error";

interface DashboardAuthContextValue {
  checkingAuth: boolean;
  accessToken: string | null;
  userEmail: string;
  userDisplayName: string;
  refreshSession: () => Promise<string | null>;
}

const DashboardAuthContext = createContext<DashboardAuthContextValue | null>(null);

export function DashboardAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");

  const refreshSession = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      setAccessToken(token);
      return token;
    } catch {
      setAccessToken(null);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const verifyDashboard = async (session: { user: { email?: string | null; user_metadata?: Record<string, unknown> }; access_token?: string } | null) => {
      if (cancelled) return;

      try {
        if (!session) {
          setCheckingAuth(false);
          router.replace("/login");
          return;
        }

        const email = session.user.email ?? "";
        const token = session.access_token ?? "";
        const redirectRes = await fetch("/api/auth/redirect-path", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (redirectRes.ok) {
          const redirectData = await redirectRes.json().catch(() => ({}));
          const redirectPath =
            typeof redirectData.path === "string" ? redirectData.path : "/dashboard";
          if (
            redirectPath !== "/dashboard" &&
            (redirectPath.startsWith("/admin") ||
              redirectPath === "/moderator" ||
              redirectPath === "/institution")
          ) {
            router.replace(redirectPath);
            return;
          }
        }

        setUserEmail(email);
        setAccessToken(token);
        const uname = (session.user?.user_metadata?.username as string)?.trim();
        setUserDisplayName(uname || email.split("@")[0] || "Account");
      } catch (err) {
        if (cancelled || isIgnorableClientError(err)) return;
        router.replace("/login");
      } finally {
        if (!cancelled) setCheckingAuth(false);
      }
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        void verifyDashboard(session);
      })
      .catch(() => {
        if (!cancelled) {
          setCheckingAuth(false);
          router.replace("/login");
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && !cancelled) {
        setCheckingAuth(false);
        router.replace("/login");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [router]);

  const value = useMemo(
    () => ({
      checkingAuth,
      accessToken,
      userEmail,
      userDisplayName,
      refreshSession,
    }),
    [checkingAuth, accessToken, userEmail, userDisplayName, refreshSession]
  );

  return (
    <DashboardAuthContext.Provider value={value}>{children}</DashboardAuthContext.Provider>
  );
}

export function useDashboardAuth() {
  const ctx = useContext(DashboardAuthContext);
  if (!ctx) {
    throw new Error("useDashboardAuth must be used within DashboardAuthProvider");
  }
  return ctx;
}

export function libraryAuthHeaders(accessToken: string | null): Record<string, string> {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
