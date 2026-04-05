"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { getBrowserWixClient } from "@/lib/wix-browser-client";
import { resetUserIdentity, parseWixTokenUid } from "@/lib/analytics";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export default function MetaPixel() {
  const pathname = usePathname();
  const [userDataReady, setUserDataReady] = useState(false);

  // Fetch member data for Advanced Matching on mount
  useEffect(() => {
    if (!PIXEL_ID || typeof window === "undefined") return;

    async function loadUserData() {
      try {
        const wix = getBrowserWixClient();
        const tokens = wix.auth.getTokens();
        if (!tokens.accessToken?.value) {
          setUserDataReady(true);
          return;
        }

        const response = await wix.members
          .getCurrentMember({ fieldsets: ["FULL"] })
          .catch(() => null);
        const res = response as {
          member?: {
            loginEmail?: string;
            contact?: {
              firstName?: string;
              lastName?: string;
              emails?: string[];
              phones?: string[];
            };
          };
        } | null;

        const member = res?.member;
        if (window.fbq) {
          const advancedData: Record<string, string> = {};

          // Attach external_id for cross-device matching
          const uid = tokens.accessToken?.value
            ? parseWixTokenUid(tokens.accessToken.value)
            : null;
          if (uid) advancedData.external_id = uid;

          if (member) {
            const email =
              member.loginEmail ?? member.contact?.emails?.[0];
            if (email) advancedData.em = email;
            const phone = member.contact?.phones?.[0];
            if (phone) advancedData.ph = phone.replace(/\D/g, "");
            if (member.contact?.firstName)
              advancedData.fn = member.contact.firstName;
            if (member.contact?.lastName)
              advancedData.ln = member.contact.lastName;
          }

          if (Object.keys(advancedData).length > 0) {
            window.fbq("init", PIXEL_ID, advancedData);
          }
        }
      } catch {
        // Not logged in or API unavailable — pixel works without advanced matching
      }
      setUserDataReady(true);
    }

    loadUserData();

    // Re-check on auth changes (also reset analytics identity cache)
    const handler = () => {
      resetUserIdentity();
      loadUserData();
    };
    window.addEventListener("auth-changed", handler);
    return () => window.removeEventListener("auth-changed", handler);
  }, []);

  // Fire PageView on route changes
  useEffect(() => {
    if (!PIXEL_ID || !userDataReady || typeof window === "undefined" || !window.fbq) return;
    window.fbq("track", "PageView");
  }, [pathname, userDataReady]);

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
            fbq('init', '${PIXEL_ID}');
            fbq('track', 'PageView');
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
