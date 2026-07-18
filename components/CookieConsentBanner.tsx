"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getStoredLegalRegion,
  requiresStrictCookieConsent,
  type LegalRegion,
} from "@/lib/legal/countries";

const STORAGE_KEY = "bbo:cookie-consent";

export type CookieConsentState = {
  essential: true;
  analytics: boolean;
  decidedAt: string;
  region: LegalRegion;
};

function readConsent(): CookieConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsentState;
  } catch {
    return null;
  }
}

function writeConsent(state: CookieConsentState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("bbo:cookie-consent", { detail: state }));
}

export function getStoredCookieConsent(): CookieConsentState | null {
  return readConsent();
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    adsbygoogle?: unknown[];
    dataLayer?: unknown[];
  }
}

function updateGoogleConsent(analytics: boolean) {
  window.dataLayer = window.dataLayer || [];
  const gtag = window.gtag ?? function (...args: unknown[]) {
    window.dataLayer?.push(args);
  };
  window.gtag = gtag;
  gtag("consent", "update", {
    ad_storage: analytics ? "granted" : "denied",
    ad_user_data: analytics ? "granted" : "denied",
    ad_personalization: analytics ? "granted" : "denied",
    analytics_storage: analytics ? "granted" : "denied",
  });
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [region, setRegion] = useState<LegalRegion>("ROW");

  useEffect(() => {
    const existing = readConsent();
    const storedRegion = getStoredLegalRegion();
    setRegion(storedRegion);
    if (!existing) {
      setVisible(true);
      updateGoogleConsent(false);
    } else {
      updateGoogleConsent(existing.analytics);
    }
  }, []);

  const accept = (analytics: boolean) => {
    const state: CookieConsentState = {
      essential: true,
      analytics,
      decidedAt: new Date().toISOString(),
      region,
    };
    writeConsent(state);
    updateGoogleConsent(analytics);
    setVisible(false);
    if (analytics) {
      window.dispatchEvent(new CustomEvent("bbo:load-adsense"));
    }
  };

  if (!visible) return null;

  const strict = requiresStrictCookieConsent(region);

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white p-4 shadow-lg safe-area-bottom md:p-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm text-gray-700">
          <p className="font-medium text-gray-900">Cookies & privacy</p>
          <p className="mt-1">
            We use essential cookies for sign-in. With your permission we also use analytics and
            advertising cookies (Google AdSense).{" "}
            <Link href="/cookies" className="text-blue-600 hover:underline">
              Cookie Policy
            </Link>
            {" · "}
            <Link href="/legal" className="text-blue-600 hover:underline">
              Legal center
            </Link>
            {strict && " — required consent in your region."}
          </p>
          {region === "US" && (
            <p className="mt-1">
              <Link href="/settings/privacy" className="text-blue-600 hover:underline">
                Do Not Sell or Share My Personal Information
              </Link>
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {strict ? (
            <>
              <button
                type="button"
                onClick={() => accept(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Essential only
              </button>
              <button
                type="button"
                onClick={() => accept(true)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Accept all
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => accept(false)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Decline optional
              </button>
              <button
                type="button"
                onClick={() => accept(true)}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Accept
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
