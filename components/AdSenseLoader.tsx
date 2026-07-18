"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

const adsenseClient =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT ?? "ca-pub-4827369932089836";

export function AdSenseLoader() {
  const [loadAds, setLoadAds] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bbo:cookie-consent");
      if (raw) {
        const parsed = JSON.parse(raw) as { analytics?: boolean };
        if (parsed.analytics) setLoadAds(true);
      }
    } catch {
      // wait for consent
    }

    const onConsent = (e: Event) => {
      const detail = (e as CustomEvent<{ analytics?: boolean }>).detail;
      if (detail?.analytics) setLoadAds(true);
    };
    const onLoadAds = () => setLoadAds(true);
    window.addEventListener("bbo:cookie-consent", onConsent);
    window.addEventListener("bbo:load-adsense", onLoadAds);
    return () => {
      window.removeEventListener("bbo:cookie-consent", onConsent);
      window.removeEventListener("bbo:load-adsense", onLoadAds);
    };
  }, []);

  if (!loadAds) return null;

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
