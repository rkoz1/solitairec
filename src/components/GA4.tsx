"use client";

import { useEffect } from "react";
import Script from "next/script";
import { ga4Consent } from "@/lib/ga4";

const GA4_ID = process.env.NEXT_PUBLIC_GA4_ID;
const CONSENT_KEY = "cookie_consent";

/**
 * GA4 component — loads with Consent Mode v2 (analytics_storage denied by default).
 * Even without consent, GA4 sends cookieless pings for behavioral modeling.
 * Grants analytics_storage on cookie consent acceptance.
 */
export default function GA4() {
  // Listen for consent changes
  useEffect(() => {
    if (!GA4_ID) return;
    const handler = () => {
      const consent = localStorage.getItem(CONSENT_KEY);
      if (consent === "accepted") ga4Consent(true);
      else ga4Consent(false);
    };
    window.addEventListener("consent-changed", handler);
    return () => window.removeEventListener("consent-changed", handler);
  }, []);

  if (!GA4_ID) return null;

  return (
    <>
      <Script
        id="ga4-consent-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            window.gtag = gtag;
            gtag('consent', 'default', {
              'ad_storage': 'denied',
              'ad_user_data': 'denied',
              'ad_personalization': 'denied',
              'analytics_storage': 'denied',
              'wait_for_update': 500
            });
            gtag('js', new Date());
            gtag('config', '${GA4_ID}');
            // Signal existing consent immediately
            try {
              if (localStorage.getItem("cookie_consent") === "accepted") {
                gtag('consent', 'update', { 'analytics_storage': 'granted' });
              }
            } catch(e) {}
          `,
        }}
      />
      <Script
        id="ga4-gtag"
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
      />
    </>
  );
}
