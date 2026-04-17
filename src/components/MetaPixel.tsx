"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { resetUserIdentity, parseWixTokenUid } from "@/lib/analytics";
import { setMetaUserData, clearMetaUserData } from "@/lib/meta-track";
import { getBrowserWixClient } from "@/lib/wix-browser-client";
import { useMember } from "@/contexts/MemberContext";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

interface PageViewUser {
  email?: string;
  phone?: string;
  externalId?: string;
  firstName?: string;
  lastName?: string;
}

/** Send a PageView to CAPI with a matching eventId for deduplication. */
function sendPageViewCapi(eventId: string, user: PageViewUser) {
  fetch("/api/meta/capi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName: "PageView",
      eventId,
      eventData: {},
      eventSourceUrl: window.location.href,
      userEmail: user.email,
      userPhone: user.phone,
      externalId: user.externalId,
      firstName: user.firstName,
      lastName: user.lastName,
    }),
    keepalive: true,
  }).catch(() => {});
}

/** Wait for window.fbq to exist, up to 2 seconds. Handles the race where
 *  a React effect runs before the inline <Script> has executed. */
function whenFbqReady(cb: () => void) {
  let attempts = 0;
  const tick = () => {
    if (typeof window !== "undefined" && typeof window.fbq === "function") {
      cb();
      return;
    }
    if (++attempts >= 20) return; // 20 × 100ms = 2s cap
    setTimeout(tick, 100);
  };
  tick();
}

function firePageView(user: PageViewUser) {
  const eventId = crypto.randomUUID();
  window.fbq("track", "PageView", {}, { eventID: eventId });
  sendPageViewCapi(eventId, user);
}

const CONSENT_KEY = "cookie_consent";

export default function MetaPixel() {
  const pathname = usePathname();
  const { member, loading } = useMember();
  const firedFirstRef = useRef(false);
  const lastPathRef = useRef<string | null>(null);
  const userRef = useRef<PageViewUser>({});

  // Signal consent state on mount (pixel loaded with consent revoked by default)
  useEffect(() => {
    if (!PIXEL_ID) return;
    const consent = localStorage.getItem(CONSENT_KEY);
    if (consent === "accepted") {
      whenFbqReady(() => window.fbq("consent", "grant"));
    }
    // If rejected or undecided, leave revoked (set in inline script)
  }, []);

  // Listen for consent changes from CookieConsent component
  useEffect(() => {
    if (!PIXEL_ID) return;
    const handler = () => {
      const consent = localStorage.getItem(CONSENT_KEY);
      whenFbqReady(() => {
        if (consent === "accepted") window.fbq("consent", "grant");
        else window.fbq("consent", "revoke");
      });
    };
    window.addEventListener("consent-changed", handler);
    return () => window.removeEventListener("consent-changed", handler);
  }, []);

  // Effect A: init with advanced matching + first PageView, gated on !loading
  useEffect(() => {
    if (!PIXEL_ID || typeof window === "undefined" || loading) return;

    const advancedData: Record<string, string> = {};
    const user: PageViewUser = {};

    // external_id from Wix JWT
    try {
      const wix = getBrowserWixClient();
      const tokens = wix.auth.getTokens();
      const uid = tokens.accessToken?.value
        ? parseWixTokenUid(tokens.accessToken.value)
        : null;
      if (uid) {
        advancedData.external_id = uid;
        user.externalId = uid;
      }
    } catch {
      /* ignore */
    }

    // Member-level data (logged-in users only)
    if (member) {
      const email = member.loginEmail ?? member.contact?.emails?.[0];
      if (email) {
        advancedData.em = email;
        user.email = email;
      }
      const rawPhone = member.contact?.phones?.[0];
      if (rawPhone) {
        const digits = rawPhone.replace(/\D/g, "");
        advancedData.ph = digits;
        user.phone = digits;
      }
      if (member.contact?.firstName) {
        advancedData.fn = member.contact.firstName;
        user.firstName = member.contact.firstName;
      }
      if (member.contact?.lastName) {
        advancedData.ln = member.contact.lastName;
        user.lastName = member.contact.lastName;
      }
    }

    userRef.current = user;
    setMetaUserData(user);

    whenFbqReady(() => {
      // Always re-init (empty advancedData is valid; FB SDK merges keys idempotently).
      window.fbq("init", PIXEL_ID, advancedData);
      if (!firedFirstRef.current) {
        firePageView(user);
        firedFirstRef.current = true;
        lastPathRef.current = pathname;
      }
    });
  }, [loading, member, pathname]);

  // Effect B: SPA navigation PageViews after the first fire
  useEffect(() => {
    if (!PIXEL_ID || !firedFirstRef.current) return;
    if (lastPathRef.current === pathname) return;
    whenFbqReady(() => {
      firePageView(userRef.current);
      lastPathRef.current = pathname;
    });
  }, [pathname]);

  // Effect C: safety timeout — if member fetch hangs, still fire PageView after 3s
  useEffect(() => {
    if (!PIXEL_ID) return;
    const t = setTimeout(() => {
      if (firedFirstRef.current) return;
      whenFbqReady(() => {
        if (firedFirstRef.current) return;
        window.fbq("init", PIXEL_ID, {});
        firePageView(userRef.current);
        firedFirstRef.current = true;
        lastPathRef.current = pathname;
      });
    }, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auth change: reset state so next member load re-inits + re-fires
  useEffect(() => {
    if (!PIXEL_ID) return;
    const handler = () => {
      resetUserIdentity();
      clearMetaUserData();
      userRef.current = {};
      firedFirstRef.current = false;
      lastPathRef.current = null;
    };
    window.addEventListener("auth-changed", handler);
    return () => window.removeEventListener("auth-changed", handler);
  }, []);

  if (!PIXEL_ID) return null;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('consent', 'revoke');
            fbq('init', '${PIXEL_ID}');
            // Signal consent immediately (same pattern as Clarity)
            try {
              if (localStorage.getItem("cookie_consent") === "accepted") {
                fbq('consent', 'grant');
              }
            } catch(e) {}
          `,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element --
            Facebook no-JS fallback tracking beacon, not a user-visible image.
            next/image cannot be used: it would rewrite the URL through
            /_next/image, breaking the Facebook endpoint, and React components
            inside <noscript> are SSR-only (users with JS disabled can't hydrate). */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>
    </>
  );
}
