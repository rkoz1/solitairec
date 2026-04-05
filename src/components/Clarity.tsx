"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
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

  // Always provide a friendlyName — "Member" as fallback for logged-in users
  const resolvedName = friendlyName ?? (user_type === "member" ? "Member" : "Visitor");

  if (process.env.NODE_ENV === "development") {
    console.debug("[Clarity] identify:", { clarityId, friendlyName: resolvedName, user_type });
  }

  window.clarity("identify", clarityId, undefined, undefined, resolvedName);
  window.clarity("set", "user_type", user_type ?? "visitor");
  if (user_type === "member") {
    window.clarity("set", "member_id", clarityId);
  }
}

export default function Clarity() {
  const pathname = usePathname();

  // Re-identify on every route change with 600ms delay to avoid Clarity's SPA restart window
  useEffect(() => {
    if (!CLARITY_ID) return;
    const timer = setTimeout(identifyUser, 600);
    return () => clearTimeout(timer);
  }, [pathname]);

  // Re-identify on login/logout
  useEffect(() => {
    if (!CLARITY_ID) return;
    const handler = () => {
      resetUserIdentity();
      setTimeout(identifyUser, 600);
    };
    window.addEventListener("auth-changed", handler);
    return () => window.removeEventListener("auth-changed", handler);
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
