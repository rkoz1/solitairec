/**
 * Unified Meta tracking — fires BOTH browser pixel and server-side CAPI
 * with a shared eventId for proper deduplication.
 *
 * Use this instead of trackEvent() from meta-pixel.ts for all standard
 * e-commerce events (ViewContent, AddToCart, Search, InitiateCheckout, Purchase).
 * Express/PayPal Purchase events also fire CAPI directly from their API routes.
 */

import { getUserIdentity } from "@/lib/analytics";

declare global {
  interface Window {
    fbq: ((...args: unknown[]) => void) & { queue?: unknown[] };
  }
}

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

/** Cached user data for Meta matching — set by MetaPixel component. */
let _cachedEmail: string | undefined;
let _cachedPhone: string | undefined;
let _cachedExternalId: string | undefined;
let _cachedFirstName: string | undefined;
let _cachedLastName: string | undefined;

/** Called by MetaPixel when member data becomes available. */
export function setMetaUserData(data: {
  email?: string;
  phone?: string;
  externalId?: string;
  firstName?: string;
  lastName?: string;
}) {
  if (data.email) _cachedEmail = data.email;
  if (data.phone) _cachedPhone = data.phone;
  if (data.externalId) _cachedExternalId = data.externalId;
  if (data.firstName) _cachedFirstName = data.firstName;
  if (data.lastName) _cachedLastName = data.lastName;
}

/** Called on auth changes to clear cached data. */
export function clearMetaUserData() {
  _cachedEmail = undefined;
  _cachedPhone = undefined;
  _cachedExternalId = undefined;
  _cachedFirstName = undefined;
  _cachedLastName = undefined;
}

interface MetaEventData {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_name?: string;
  content_type?: string;
  num_items?: number;
  order_id?: string;
  search_string?: string;
}

/**
 * Track a Meta event via both browser pixel and server CAPI.
 *
 * @param eventName - Meta standard event name (e.g. "ViewContent", "AddToCart")
 * @param data - Event data (value, currency, content_ids, etc.)
 * @param userEmail - Optional logged-in user email for better matching
 * @param externalId - Optional Wix member/visitor ID for cross-device matching
 * @param options - Optional overrides: eventId for dedup, fbc/fbp for cookie preservation
 */
export function trackMetaEvent(
  eventName: string,
  data: MetaEventData,
  userEmail?: string,
  externalId?: string,
  options?: { eventId?: string; fbc?: string; fbp?: string }
): void {
  if (!PIXEL_ID || typeof window === "undefined") return;

  // Resolve user data: explicit params → cached → Wix token fallback
  const email = userEmail ?? _cachedEmail;
  let extId = externalId ?? _cachedExternalId;
  if (!extId) {
    const identity = getUserIdentity();
    if (identity.user_id) extId = identity.user_id;
  }

  const eventId = options?.eventId ?? crypto.randomUUID();

  // 1. Fire browser pixel with eventID for deduplication
  if (window.fbq) {
    window.fbq("track", eventName, data, { eventID: eventId });
  }

  // 2. Fire server-side CAPI via relay endpoint (non-blocking)
  const capiData = {
    eventName,
    eventId,
    eventData: {
      value: data.value,
      currency: data.currency,
      contentIds: data.content_ids,
      contentName: data.content_name,
      contentType: data.content_type,
      numItems: data.num_items,
      orderId: data.order_id,
      searchString: data.search_string,
    },
    eventSourceUrl: window.location.href,
    userEmail: email,
    userPhone: _cachedPhone,
    externalId: extId,
    firstName: _cachedFirstName,
    lastName: _cachedLastName,
    ...(options?.fbc ? { fbc: options.fbc } : {}),
    ...(options?.fbp ? { fbp: options.fbp } : {}),
  };

  fetch("/api/meta/capi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(capiData),
    keepalive: true, // Ensure request completes even if page navigates
  }).catch(() => {});
}
