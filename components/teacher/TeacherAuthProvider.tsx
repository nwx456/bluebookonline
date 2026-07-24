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

interface TeacherAuthContextValue {
  checkingAuth: boolean;
  accessToken: string | null;
  userEmail: string;
  userDisplayName: string;
  refreshSession: () => Promise<string | null>;
}

const TeacherAuthContext = createContext<TeacherAuthContextValue | null>(null);

export function TeacherAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");

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

  useEffect(() => {
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!session) {
          setCheckingAuth(false);
          router.replace("/login?next=/teacher");
          return;
        }

        const token = session.access_token ?? "";
        const meRes = await fetch("/api/teacher/me", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!meRes.ok) {
          setCheckingAuth(false);
          router.replace("/dashboard");
          return;
        }

        const email = session.user.email ?? "";
        setUserEmail(email);
        setAccessToken(token);
        const uname = (session.user?.user_metadata?.username as string)?.trim();
        setUserDisplayName(uname || email.split("@")[0] || "Teacher");
        setCheckingAuth(false);
      })
      .catch(() => {
        setCheckingAuth(false);
        router.replace("/login?next=/teacher");
      });
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
    <TeacherAuthContext.Provider value={value}>{children}</TeacherAuthContext.Provider>
  );
}

export function useTeacherAuth() {
  const ctx = useContext(TeacherAuthContext);
  if (!ctx) {
    throw new Error("useTeacherAuth must be used within TeacherAuthProvider");
  }
  return ctx;
}

export function teacherAuthHeaders(accessToken: string | null): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}
