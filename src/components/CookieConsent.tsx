"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const CONSENT_KEY = "cookie_consent";

type Consent = "accepted" | "rejected" | null;

function getStoredConsent(): Consent {
  if (typeof window === "undefined") return null;
  const val = localStorage.getItem(CONSENT_KEY);
  if (val === "accepted" || val === "rejected") return val;
  return null;
}

/**
 * Cookie consent banner.
 * Clarity and Meta Pixel handle consent internally via the consent-changed event.
 * Vercel Analytics is ungated (privacy-friendly, no cookies).
 */
export default function CookieConsent() {
  const [consent, setConsent] = useState<Consent>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setConsent(getStoredConsent());
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setConsent("accepted");
    window.dispatchEvent(new Event("consent-changed"));
  }

  function reject() {
    localStorage.setItem(CONSENT_KEY, "rejected");
    setConsent("rejected");
    window.dispatchEvent(new Event("consent-changed"));
  }

  // Show banner only when mounted and no consent stored
  const showBanner = mounted && consent === null;

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] lg:bottom-6 lg:left-6 lg:right-auto lg:max-w-sm">
      <div className="bg-white shadow-lg border-t border-outline-variant/20 lg:border lg:border-outline-variant/20 px-6 py-5">
        <p className="text-[11px] leading-relaxed tracking-wide text-on-surface-variant">
          We use cookies for analytics and to improve your experience.
          See our{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 text-on-surface hover:text-secondary transition-colors"
          >
            Privacy Policy
          </Link>
          .
        </p>
        <div className="mt-4 flex gap-3">
          <button
            onClick={accept}
            className="flex-1 bg-on-surface text-on-primary py-2.5 text-[10px] tracking-[0.2em] uppercase font-bold transition-transform active:scale-[0.98]"
          >
            Accept
          </button>
          <button
            onClick={reject}
            className="flex-1 border border-outline-variant/30 text-on-surface-variant py-2.5 text-[10px] tracking-[0.2em] uppercase font-medium hover:text-on-surface transition-colors"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
