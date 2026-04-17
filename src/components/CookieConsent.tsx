"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

const CONSENT_KEY = "cookie_consent";
const AUTO_ACCEPT_DELAY = 10_000; // 10 seconds

type Consent = "accepted" | "rejected" | null;

function getStoredConsent(): Consent {
  if (typeof window === "undefined") return null;
  const val = localStorage.getItem(CONSENT_KEY);
  if (val === "accepted" || val === "rejected") return val;
  return null;
}

/**
 * Cookie consent banner — soft, non-intrusive.
 * Auto-accepts after 10s of browsing (HK PDPO doesn't require opt-in).
 * Clarity and Meta Pixel handle consent internally via the consent-changed event.
 * Vercel Analytics is ungated (privacy-friendly, no cookies).
 */
export default function CookieConsent() {
  const [consent, setConsent] = useState<Consent>(null);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMounted(true);
    setConsent(getStoredConsent());
  }, []);

  // Auto-accept after delay if user hasn't interacted
  useEffect(() => {
    if (!mounted || consent !== null) return;
    timerRef.current = setTimeout(() => {
      localStorage.setItem(CONSENT_KEY, "accepted");
      setConsent("accepted");
      window.dispatchEvent(new Event("consent-changed"));
    }, AUTO_ACCEPT_DELAY);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [mounted, consent]);

  function accept() {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.setItem(CONSENT_KEY, "accepted");
    setConsent("accepted");
    window.dispatchEvent(new Event("consent-changed"));
  }

  function reject() {
    if (timerRef.current) clearTimeout(timerRef.current);
    localStorage.setItem(CONSENT_KEY, "rejected");
    setConsent("rejected");
    window.dispatchEvent(new Event("consent-changed"));
  }

  // Show banner only when mounted and no consent stored
  const showBanner = mounted && consent === null;

  if (!showBanner) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] lg:bottom-6 lg:left-6 lg:right-auto lg:max-w-xs">
      <div className="bg-white/90 backdrop-blur-sm shadow-md px-5 py-4">
        <p className="text-[10px] leading-relaxed tracking-wide text-on-surface-variant">
          We use cookies to personalise your experience.{" "}
          <Link
            href="/privacy"
            className="underline underline-offset-2 text-on-surface hover:text-secondary transition-colors"
          >
            Privacy Policy
          </Link>
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={accept}
            className="flex-1 bg-on-surface text-on-primary py-2 text-[9px] tracking-[0.2em] uppercase font-bold transition-transform active:scale-[0.98]"
          >
            OK
          </button>
          <button
            onClick={reject}
            className="flex-1 text-on-surface-variant py-2 text-[9px] tracking-[0.2em] uppercase font-medium hover:text-on-surface transition-colors"
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}
