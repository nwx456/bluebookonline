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
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isIgnorableClientError } from "@/lib/ignorable-client-error";

interface InstitutionAuthContextValue {
  checkingAuth: boolean;
  accessToken: string | null;
  userEmail: string;
  institutionName: string;
  joinCode: string;
  refreshSession: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
}

const InstitutionAuthContext = createContext<InstitutionAuthContextValue | null>(null);

export function InstitutionAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [institutionName, setInstitutionName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const refreshSession = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token ?? null;
      setAccessToken(token);
      return token;
    } catch {
      setAccessToken(null);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const token = await refreshSession();
      if (!token) return;
      const meRes = await fetch("/api/institution/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (meRes.ok) {
        const data = await meRes.json().catch(() => ({}));
        setInstitutionName(data.institution?.name ?? "");
        setJoinCode(data.institution?.joinCode ?? "");
      }
    } catch {
      // best-effort profile refresh
    }
  }, [refreshSession]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const verifyInstitution = async (session: Session | null) => {
      if (cancelled) return;

      if (!session) {
        setCheckingAuth(false);
        router.replace("/login?next=/institution");
        return;
      }

      try {
        const token = session.access_token ?? "";
        const meRes = await fetch("/api/institution/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (cancelled) return;

        if (!meRes.ok) {
          setCheckingAuth(false);
          router.replace("/dashboard");
          return;
        }

        const data = await meRes.json();
        setUserEmail(session.user.email ?? "");
        setAccessToken(token);
        setInstitutionName(data.institution?.name ?? "Institution");
        setJoinCode(data.institution?.joinCode ?? "");
        setCheckingAuth(false);
      } catch (err) {
        if (cancelled || isIgnorableClientError(err)) return;
        setCheckingAuth(false);
        router.replace("/login?next=/institution");
      }
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        void verifyInstitution(session);
      })
      .catch(() => {
        if (!cancelled) {
          setCheckingAuth(false);
          router.replace("/login?next=/institution");
        }
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" && !cancelled) {
        setCheckingAuth(false);
        router.replace("/login?next=/institution");
        return;
      }
      if (event === "SIGNED_IN" && session && !cancelled) {
        setCheckingAuth(true);
        void verifyInstitution(session);
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
      institutionName,
      joinCode,
      refreshSession,
      refreshProfile,
    }),
    [checkingAuth, accessToken, userEmail, institutionName, joinCode, refreshSession, refreshProfile]
  );

  return (
    <InstitutionAuthContext.Provider value={value}>{children}</InstitutionAuthContext.Provider>
  );
}

export function useInstitutionAuth() {
  const ctx = useContext(InstitutionAuthContext);
  if (!ctx) {
    throw new Error("useInstitutionAuth must be used within InstitutionAuthProvider");
  }
  return ctx;
}

export function institutionAuthHeaders(accessToken: string | null): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
