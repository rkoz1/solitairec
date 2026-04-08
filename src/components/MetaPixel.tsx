"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { resetUserIdentity, parseWixTokenUid } from "@/lib/analytics";
import { setMetaUserData, clearMetaUserData } from "@/lib/meta-track";
import { getBrowserWixClient } from "@/lib/wix-browser-client";
import { useMember } from "@/contexts/MemberContext";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/** Send a PageView to CAPI with a matching eventId for deduplication. */
function sendPageViewCapi(eventId: string, userEmail?: string, externalId?: string) {
  fetch("/api/meta/capi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName: "PageView",
      eventId,
      eventData: {},
      eventSourceUrl: window.location.href,
      userEmail,
      externalId,
    }),
    keepalive: true,
  }).catch(() => {});
}

export default function MetaPixel() {
  const pathname = usePathname();
  const { member, loading } = useMember();
  const initializedRef = useRef(false);
  const userDataRef = useRef<{ email?: string; externalId?: string }>({});

  // Set up advanced matching once member data is available
  useEffect(() => {
    if (!PIXEL_ID || typeof window === "undefined" || loading || !window.fbq) return;

    const advancedData: Record<string, string> = {};

    // Attach external_id for cross-device matching
    try {
      const wix = getBrowserWixClient();
      const tokens = wix.auth.getTokens();
      const uid = tokens.accessToken?.value
        ? parseWixTokenUid(tokens.accessToken.value)
        : null;
      if (uid) {
        advancedData.external_id = uid;
        userDataRef.current.externalId = uid;
      }
    } catch { /* ignore */ }

    if (member) {
      const email = member.loginEmail ?? member.contact?.emails?.[0];
      if (email) {
        advancedData.em = email;
        userDataRef.current.email = email;
      }
      const phone = member.contact?.phones?.[0];
      if (phone) advancedData.ph = phone.replace(/\D/g, "");
      if (member.contact?.firstName) advancedData.fn = member.contact.firstName;
      if (member.contact?.lastName) advancedData.ln = member.contact.lastName;
    }

    if (Object.keys(advancedData).length > 0) {
      window.fbq("init", PIXEL_ID, advancedData);
    }

    // Cache user data so all trackMetaEvent calls include it for CAPI matching
    setMetaUserData({
      email: userDataRef.current.email,
      phone: member?.contact?.phones?.[0]?.replace(/\D/g, ""),
      externalId: userDataRef.current.externalId,
      firstName: member?.contact?.firstName ?? undefined,
      lastName: member?.contact?.lastName ?? undefined,
    });

    initializedRef.current = true;
  }, [member, loading]);

  // Re-init on auth changes
  useEffect(() => {
    if (!PIXEL_ID) return;
    const handler = () => {
      resetUserIdentity();
      clearMetaUserData();
      userDataRef.current = {};
      initializedRef.current = false;
    };
    window.addEventListener("auth-changed", handler);
    return () => window.removeEventListener("auth-changed", handler);
  }, []);

  // Fire PageView on route changes with deduplication eventID
  useEffect(() => {
    if (!PIXEL_ID || typeof window === "undefined" || !window.fbq) return;
    const eventId = crypto.randomUUID();
    window.fbq("track", "PageView", {}, { eventID: eventId });
    sendPageViewCapi(eventId, userDataRef.current.email, userDataRef.current.externalId);
  }, [pathname]);

  if (!PIXEL_ID) return null;

  return (
    <>
      <Script
        id="meta-pixel"
        strategy="lazyOnload"
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
            fbq('init', '${PIXEL_ID}');
          `,
        }}
      />
      <noscript>
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
