"use client";

import { useEffect } from "react";
import Script from "next/script";
import { getUserIdentity, resetUserIdentity } from "@/lib/analytics";
import { getBrowserWixClient } from "@/lib/wix-browser-client";

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

async function identifyUser() {
  if (!window.clarity) return;
  const { user_id, user_type } = getUserIdentity();
  if (!user_id) return;

  let clarityId = user_id;
  let friendlyName: string | undefined;

  if (user_type === "member") {
    try {
      const wix = getBrowserWixClient();
      const response = await wix.members.getCurrentMember({ fieldsets: ["FULL"] }).catch(() => null);
      const res = response as {
        member?: {
          _id?: string;
          contact?: { firstName?: string; lastName?: string };
          loginEmail?: string;
        };
      } | null;

      // Use the actual Wix member ID for Clarity so it can be reconciled in Wix dashboard
      if (res?.member?._id) {
        clarityId = res.member._id;
      }

      const contact = res?.member?.contact;
      if (contact?.firstName) {
        friendlyName = [contact.firstName, contact.lastName].filter(Boolean).join(" ");
      } else {
        friendlyName = res?.member?.loginEmail ?? undefined;
      }
    } catch { /* fall through without name */ }
  }

  window.clarity("identify", clarityId, undefined, undefined, friendlyName ?? (user_type === "visitor" ? "Visitor" : undefined));
  window.clarity("set", "user_type", user_type ?? "visitor");
  if (user_type === "member") {
    window.clarity("set", "member_id", clarityId);
  }
}

export default function Clarity() {
  useEffect(() => {
    if (!CLARITY_ID) return;

    // Identify once Clarity is ready
    const timer = setTimeout(identifyUser, 1000);

    // Re-identify on login/logout
    const handler = () => {
      resetUserIdentity();
      setTimeout(identifyUser, 500);
    };
    window.addEventListener("auth-changed", handler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("auth-changed", handler);
    };
  }, []);

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
        `,
      }}
    />
  );
}
