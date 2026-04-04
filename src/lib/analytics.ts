/**
 * Vercel Analytics helper with automatic Wix user identity.
 * Attaches user_id (member or visitor) to every custom event.
 * No-ops on server; logs to console in development.
 */

import { track } from "@vercel/analytics";
import { getBrowserWixClient } from "@/lib/wix-browser-client";

type AnalyticsProperties = Record<string, string | number | boolean | null>;

let cachedUserId: string | null = null;
let cachedUserType: "member" | "visitor" | null = null;

/** Extract current user identity from Wix tokens (cached per session). */
export function getUserIdentity(): {
  user_id: string | null;
  user_type: "member" | "visitor" | null;
} {
  if (cachedUserId) return { user_id: cachedUserId, user_type: cachedUserType };
  if (typeof window === "undefined")
    return { user_id: null, user_type: null };

  try {
    const wix = getBrowserWixClient();
    const tokens = wix.auth.getTokens();
    const raw = tokens as {
      memberId?: string;
      accessToken?: { value?: string };
    };

    if (raw.memberId) {
      cachedUserId = raw.memberId;
      cachedUserType = "member";
    } else if (raw.accessToken?.value) {
      try {
        const payload = JSON.parse(
          atob(raw.accessToken.value.split(".")[1])
        );
        if (payload.sub) {
          cachedUserId = payload.sub;
          cachedUserType = "visitor";
        }
      } catch {
        /* malformed token */
      }
    }
  } catch {
    /* no client available */
  }

  return { user_id: cachedUserId, user_type: cachedUserType };
}

/** Reset cached identity — call on login/logout (auth-changed). */
export function resetUserIdentity(): void {
  cachedUserId = null;
  cachedUserType = null;
}

/** Send a custom event to Vercel Analytics with user identity auto-attached. */
export function trackAnalytics(
  event: string,
  properties?: AnalyticsProperties
): void {
  if (typeof window === "undefined") return;

  const { user_id, user_type } = getUserIdentity();
  const enriched: AnalyticsProperties = { ...properties };
  if (user_id) {
    enriched.user_id = user_id;
    enriched.user_type = user_type;
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", event, enriched);
    return;
  }

  track(event, enriched);
}
