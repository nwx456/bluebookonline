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
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token ?? null;
    setAccessToken(token);
    return token;
  }, []);

  const refreshProfile = useCallback(async () => {
    const token = await refreshSession();
    if (!token) return;
    const meRes = await fetch("/api/institution/me", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (meRes.ok) {
      const data = await meRes.json();
      setInstitutionName(data.institution?.name ?? "");
      setJoinCode(data.institution?.joinCode ?? "");
    }
  }, [refreshSession]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!session) {
          setCheckingAuth(false);
          router.replace("/login?next=/institution");
          return;
        }

        const token = session.access_token ?? "";
        const meRes = await fetch("/api/institution/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

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
      })
      .catch(() => {
        setCheckingAuth(false);
        router.replace("/login?next=/institution");
      });
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
