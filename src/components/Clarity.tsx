"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { getUserIdentity, resetUserIdentity } from "@/lib/analytics";
import { useMember } from "@/contexts/MemberContext";
import { clarityConsent } from "@/lib/clarity";

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;
const CONSENT_KEY = "cookie_consent";

interface MemberLike {
  _id?: string;
  loginEmail?: string;
  contact?: { firstName?: string; lastName?: string };
}

function identifyWithClarity(member: MemberLike | null, pathname: string) {
  if (!window.clarity) return;

  const { user_id, user_type } = getUserIdentity();
  if (!user_id) return;

  let clarityId = user_id;
  let friendlyName: string | undefined;

  if (user_type === "member" && member) {
    if (member._id) clarityId = member._id;

    if (member.contact?.firstName) {
      friendlyName = [member.contact.firstName, member.contact.lastName].filter(Boolean).join(" ");
    } else {
      friendlyName = member.loginEmail ?? undefined;
    }
  }

  const resolvedName = friendlyName ?? (user_type === "member" ? "Member" : "Visitor");

  // Pass pathname as custom-page-id for per-page filtering in dashboard
  window.clarity("identify", clarityId, undefined, pathname, resolvedName);
  window.clarity("set", "user_type", user_type ?? "visitor");
  if (user_type === "member") {
    window.clarity("set", "member_id", clarityId);
  }
}

/**
 * Clarity component — loads unconditionally in cookieless mode.
 * Uses Consent API V2: full tracking only after cookie consent is accepted.
 * Rendered outside CookieConsent wrapper in layout.tsx.
 */
export default function Clarity() {
  const pathname = usePathname();
  const { member, loading } = useMember();

  // Signal consent state on mount and when it changes
  useEffect(() => {
    if (!CLARITY_ID) return;
    const consent = typeof window !== "undefined"
      ? localStorage.getItem(CONSENT_KEY)
      : null;
    if (consent === "accepted") {
      clarityConsent(true);
    } else if (consent === "rejected") {
      clarityConsent(false);
    }
    // No call if null (undecided) — Clarity stays in cookieless mode
  }, []);

  // Listen for consent changes from CookieConsent component
  useEffect(() => {
    if (!CLARITY_ID) return;
    const handler = () => {
      const consent = localStorage.getItem(CONSENT_KEY);
      if (consent === "accepted") clarityConsent(true);
      else if (consent === "rejected") clarityConsent(false);
    };
    window.addEventListener("consent-changed", handler);
    return () => window.removeEventListener("consent-changed", handler);
  }, []);

  // Identify on every route change + when member data arrives
  useEffect(() => {
    if (!CLARITY_ID || loading) return;
    // No timeout needed — the Clarity inline snippet defines window.clarity
    // as a queue function immediately, so calls are buffered until the full
    // script loads.
    identifyWithClarity(member, pathname);
  }, [pathname, member, loading]);

  // Re-identify immediately on login/logout (don't wait for route change)
  useEffect(() => {
    if (!CLARITY_ID) return;
    const handler = () => {
      resetUserIdentity();
      // Re-identify with fresh identity
      identifyWithClarity(null, pathname);
    };
    window.addEventListener("auth-changed", handler);
    return () => window.removeEventListener("auth-changed", handler);
  }, [pathname]);

  if (!CLARITY_ID) return null;

  return (
    <Script
      id="microsoft-clarity"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `
          (function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window,document,"clarity","script","${CLARITY_ID}");
          // Signal consent immediately so Clarity's first request knows the state
          // (avoids race where React useEffect fires after session starts cookieless)
          try {
            var cs = localStorage.getItem("cookie_consent");
            if (cs === "accepted") window.clarity("consentv2", { analytical: true });
            else if (cs === "rejected") window.clarity("consentv2", { analytical: false });
          } catch(e) {}
        `,
      }}
    />
  );
}
