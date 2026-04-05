"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { getUserIdentity, resetUserIdentity } from "@/lib/analytics";
import { useMember } from "@/contexts/MemberContext";

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID;

interface MemberLike {
  _id?: string;
  loginEmail?: string;
  contact?: { firstName?: string; lastName?: string };
}

function identifyWithClarity(member: MemberLike | null) {
  if (!window.clarity) {
    if (process.env.NODE_ENV === "development") console.debug("[Clarity] window.clarity not available");
    return;
  }
  const { user_id, user_type } = getUserIdentity();
  if (!user_id) {
    if (process.env.NODE_ENV === "development") console.debug("[Clarity] getUserIdentity returned null:", { user_id, user_type });
    return;
  }

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
  const { member, loading } = useMember();

  // Identify on every route change + when member data arrives
  useEffect(() => {
    if (!CLARITY_ID || loading) return;
    const timer = setTimeout(() => identifyWithClarity(member), 600);
    return () => clearTimeout(timer);
  }, [pathname, member, loading]);

  // Re-identify on login/logout
  useEffect(() => {
    if (!CLARITY_ID) return;
    const handler = () => resetUserIdentity();
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
