"use client";

import { useCallback, useEffect, useState } from "react";
import type { PresentationStats } from "./types";
import { FALLBACK_STATS } from "./types";

export function usePresentationStats(accessToken: string | null) {
  const [stats, setStats] = useState<PresentationStats>(FALLBACK_STATS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async (token: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "İstatistikler yüklenemedi.");
        return;
      }
      setStats({
        registeredUsers: data.registeredUsers ?? FALLBACK_STATS.registeredUsers,
        pendingRegistrations: data.pendingRegistrations ?? 0,
        pdfUploadsTotal: data.pdfUploadsTotal ?? 0,
        pdfPublished: data.pdfPublished ?? 0,
        pdfUnpublished: data.pdfUnpublished ?? 0,
        questionsTotal: data.questionsTotal ?? 0,
        questionsWithGraph: data.questionsWithGraph ?? 0,
        attemptsTotal: data.attemptsTotal ?? 0,
        attemptsCompleted: data.attemptsCompleted ?? 0,
        attemptsInProgress: data.attemptsInProgress ?? 0,
        attemptAnswersTotal: data.attemptAnswersTotal ?? 0,
      });
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    loadStats(accessToken);
  }, [accessToken, loadStats]);

  return { stats, loading, error, reload: () => accessToken && loadStats(accessToken) };
}
