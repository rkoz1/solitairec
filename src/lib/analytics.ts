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

/** Parse a Wix access token and extract the user ID (uid/siteMemberId).
 *  Wix tokens have format: OauthNG.JWS.<header>.<payload>.<sig>
 *  The payload contains { data: "{\"instance\":{\"uid\":\"...\"}}" } */
export function parseWixTokenUid(tokenValue: string): string | null {
  try {
    const parts = tokenValue.split(".");
    const payloadB64 = parts.length >= 5 ? parts[3] : parts[1];
    const base64 = payloadB64.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64));

    if (payload.data && typeof payload.data === "string") {
      const data = JSON.parse(payload.data);
      return data.instance?.uid ?? data.instance?.siteMemberId ?? null;
    }
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

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
      accessToken?: { value?: string };
      refreshToken?: { role?: string };
    };

    // Detect member vs visitor from refreshToken.role
    const isMember = raw.refreshToken?.role === "member";

    if (raw.accessToken?.value) {
      const uid = parseWixTokenUid(raw.accessToken.value);
      if (uid) {
        cachedUserId = uid;
        cachedUserType = isMember ? "member" : "visitor";
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

  const enriched: AnalyticsProperties = { ...properties };

  // Vercel Analytics allows max 5 properties per event.
  // Only attach user identity if it won't exceed the limit.
  const propCount = Object.keys(enriched).length;
  if (propCount <= 3) {
    const { user_id, user_type } = getUserIdentity();
    if (user_id) {
      enriched.user_id = user_id;
      enriched.user_type = user_type;
    }
  }

  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", event, enriched);
    return;
  }

  track(event, enriched);
}
