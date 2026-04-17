/**
 * Google Analytics 4 helper — e-commerce events and consent management.
 *
 * GA4 loads with consent denied by default (Consent Mode v2).
 * Even without consent, GA4 collects cookieless pings for behavioral modeling.
 * Call ga4Consent() when cookie consent state changes.
 */

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

/** Grant or revoke GA4 analytics consent. */
export function ga4Consent(granted: boolean): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("consent", "update", {
    analytics_storage: granted ? "granted" : "denied",
  });
}

interface GA4Item {
  item_id: string;
  item_name: string;
  price?: number;
  quantity?: number;
  item_brand?: string;
  item_category?: string;
}

/** Track a GA4 e-commerce event. */
export function trackGA4Event(
  eventName: string,
  params: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", eventName, params);
}

/** view_item — product page view */
export function ga4ViewItem(item: GA4Item, currency: string): void {
  trackGA4Event("view_item", {
    currency,
    value: item.price ?? 0,
    items: [{ ...item, quantity: item.quantity ?? 1 }],
  });
}

/** add_to_cart */
export function ga4AddToCart(item: GA4Item, currency: string): void {
  trackGA4Event("add_to_cart", {
    currency,
    value: (item.price ?? 0) * (item.quantity ?? 1),
    items: [{ ...item, quantity: item.quantity ?? 1 }],
  });
}

/** begin_checkout */
export function ga4BeginCheckout(
  items: GA4Item[],
  value: number,
  currency: string,
): void {
  trackGA4Event("begin_checkout", { currency, value, items });
}

/** purchase */
export function ga4Purchase(
  transactionId: string,
  items: GA4Item[],
  value: number,
  currency: string,
): void {
  trackGA4Event("purchase", {
    transaction_id: transactionId,
    currency,
    value,
    items,
  });
}

/** search */
export function ga4Search(searchTerm: string): void {
  trackGA4Event("search", { search_term: searchTerm });
}

/** generate_lead — newsletter signup etc. */
export function ga4GenerateLead(value?: number, currency?: string): void {
  trackGA4Event("generate_lead", {
    ...(value !== undefined ? { value } : {}),
    ...(currency ? { currency } : {}),
  });
}

// --- Server-side Measurement Protocol (for API routes / webhooks) ---

const MP_ENDPOINT = "https://www.google-analytics.com/mp/collect";
const GA4_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA4_ID;
const GA4_API_SECRET = process.env.GA4_API_SECRET;

interface GA4ServerItem {
  item_id: string;
  item_name: string;
  quantity?: number;
  price?: number;
}

/**
 * Send a purchase event to GA4 via Measurement Protocol (server-side).
 * Deduplicated with client-side via transaction_id.
 *
 * @param clientId - Stable user identifier (hashed email or member ID).
 *                   GA4 requires this to associate the event with a user.
 */
export async function ga4ServerPurchase(
  clientId: string,
  transactionId: string,
  items: GA4ServerItem[],
  value: number,
  currency: string,
): Promise<void> {
  if (!GA4_MEASUREMENT_ID || !GA4_API_SECRET) return;

  const payload = {
    client_id: clientId,
    events: [
      {
        name: "purchase",
        params: {
          transaction_id: transactionId,
          currency,
          value,
          items: items.map((i) => ({
            item_id: i.item_id,
            item_name: i.item_name,
            quantity: i.quantity ?? 1,
            ...(i.price !== undefined ? { price: i.price } : {}),
          })),
        },
      },
    ],
  };

  try {
    const res = await fetch(
      `${MP_ENDPOINT}?measurement_id=${GA4_MEASUREMENT_ID}&api_secret=${GA4_API_SECRET}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[GA4 MP] Error:", res.status, text);
    }
  } catch (err) {
    console.error("[GA4 MP] Failed to send purchase:", err instanceof Error ? err.message : err);
  }
}
