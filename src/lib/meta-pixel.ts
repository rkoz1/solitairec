/**
 * Client-side Meta Pixel helper.
 * No-ops when NEXT_PUBLIC_META_PIXEL_ID is not set.
 */

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

declare global {
  interface Window {
    fbq: ((...args: unknown[]) => void) & { queue?: unknown[] };
    _fbq: Window["fbq"];
  }
}

export function trackEvent(
  event: string,
  data?: Record<string, unknown>,
  eventId?: string
) {
  if (!PIXEL_ID || typeof window === "undefined" || !window.fbq) return;
  if (eventId) {
    window.fbq("track", event, data, { eventID: eventId });
  } else {
    window.fbq("track", event, data);
  }
}

export function trackPageView() {
  if (!PIXEL_ID || typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", "PageView");
}

export function generateEventId(): string {
  return crypto.randomUUID();
}
