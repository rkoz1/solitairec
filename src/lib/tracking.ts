/**
 * Unified tracking layer — single source of truth for all e-commerce events.
 *
 * Components call one function per event with a typed payload.
 * This module dispatches to all 3 providers (Meta, GA4, Clarity)
 * with provider-specific data mapping handled internally.
 *
 * Each provider call is independently try/caught so one failure doesn't block others.
 */

import { trackMetaEvent } from "./meta-track";
import {
  ga4ViewItem,
  ga4AddToCart,
  ga4BeginCheckout,
  ga4Purchase,
  ga4Search,
  ga4GenerateLead,
  trackGA4Event,
} from "./ga4";
import { clarityEvent, clarityTag, clarityUpgrade } from "./clarity";

const DEFAULT_CURRENCY = "HKD";

// --- Types ---

export interface ProductData {
  productId: string;
  productName: string;
  price: number;
  currency?: string;
}

export interface CartItemData {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
}

export interface CheckoutData {
  items: CartItemData[];
  value: number;
  currency?: string;
}

export interface PurchaseData {
  orderId: string;
  orderNumber: string;
  items: {
    productId: string;
    productName: string;
    quantity?: number;
    price?: number;
  }[];
  value: number;
  currency?: string;
  email?: string;
  buyerId?: string;
}

export interface SearchData {
  query: string;
}

export interface LeadData {
  email?: string;
  source?: string;
}

export interface PaymentInfoData {
  productIds: string[];
  currency?: string;
}

// --- Helpers ---

function safe(provider: string, fn: () => void): void {
  try {
    fn();
  } catch (err) {
    console.warn(`[tracking] ${provider} failed:`, err instanceof Error ? err.message : err);
  }
}

/** Deterministic eventId for Meta Purchase dedup — must match webhook hash. */
async function purchaseEventId(orderId: string): Promise<string> {
  const data = new TextEncoder().encode("purchase-" + orderId);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 36);
}

/** Recover _fbc/_fbp saved before Wix checkout redirect. */
function recoverMetaCookies(): {
  fbc?: string;
  fbp?: string;
} {
  try {
    const raw = sessionStorage.getItem("meta_cookies");
    if (raw) {
      const parsed = JSON.parse(raw);
      sessionStorage.removeItem("meta_cookies");
      return { fbc: parsed.fbc, fbp: parsed.fbp };
    }
  } catch (err) {
    console.warn("[tracking] Failed to recover meta cookies:", err instanceof Error ? err.message : err);
  }
  return {};
}

// --- Event functions ---

export function trackViewProduct(data: ProductData): void {
  const currency = data.currency ?? DEFAULT_CURRENCY;

  safe("meta", () =>
    trackMetaEvent("ViewContent", {
      content_ids: [data.productId],
      content_name: data.productName,
      content_type: "product",
      value: data.price,
      currency,
    }),
  );

  safe("ga4", () =>
    ga4ViewItem(
      { item_id: data.productId, item_name: data.productName, price: data.price },
      currency,
    ),
  );

  safe("clarity", () => {
    clarityEvent("view_item");
    clarityTag("last_product_viewed", data.productName);
    clarityTag("last_product_price", data.price);
  });
}

export function trackAddToCart(data: ProductData & { quantity?: number }): void {
  const currency = data.currency ?? DEFAULT_CURRENCY;
  const quantity = data.quantity ?? 1;

  safe("meta", () =>
    trackMetaEvent("AddToCart", {
      content_ids: [data.productId],
      content_name: data.productName,
      content_type: "product",
      value: data.price,
      currency,
      num_items: quantity,
    }),
  );

  safe("ga4", () =>
    ga4AddToCart(
      {
        item_id: data.productId,
        item_name: data.productName,
        price: data.price,
        quantity,
      },
      currency,
    ),
  );

  safe("clarity", () => {
    clarityEvent("add_to_cart");
    clarityTag("last_added_product", data.productName);
    clarityUpgrade("add_to_cart");
  });
}

export function trackInitiateCheckout(data: CheckoutData): void {
  const currency = data.currency ?? DEFAULT_CURRENCY;
  const contentIds = data.items.map((i) => i.productId);

  safe("meta", () =>
    trackMetaEvent("InitiateCheckout", {
      currency,
      value: data.value,
      content_ids: contentIds,
      content_type: "product",
      num_items: data.items.length,
    }),
  );

  safe("ga4", () =>
    ga4BeginCheckout(
      data.items.map((i) => ({
        item_id: i.productId,
        item_name: i.productName,
        price: i.price,
        quantity: i.quantity,
      })),
      data.value,
      currency,
    ),
  );

  safe("clarity", () => {
    clarityEvent("initiate_checkout");
    clarityTag("checkout_value", data.value);
    clarityUpgrade("checkout");
  });
}

export async function trackPurchase(data: PurchaseData): Promise<void> {
  const currency = data.currency ?? DEFAULT_CURRENCY;

  // Idempotency: skip if already tracked (e.g. page refresh)
  const dedupKey = `tracked_purchase_${data.orderId}`;
  try {
    if (sessionStorage.getItem(dedupKey)) return;
  } catch (err) {
    console.warn("[tracking] sessionStorage unavailable for dedup check:", err instanceof Error ? err.message : err);
  }

  if (data.value <= 0) return;

  // Deterministic eventId for Meta dedup with webhook
  const eventId = await purchaseEventId(data.orderId);

  // Recover _fbc/_fbp saved before Wix checkout redirect
  const { fbc, fbp } = recoverMetaCookies();

  const contentIds = data.items.map((i) => i.productId);

  safe("meta", () =>
    trackMetaEvent(
      "Purchase",
      {
        value: data.value,
        currency,
        content_ids: contentIds,
        content_type: "product",
        order_id: data.orderNumber,
        num_items: data.items.length,
      },
      data.email,
      data.buyerId,
      { eventId, fbc, fbp },
    ),
  );

  safe("ga4", () =>
    ga4Purchase(
      data.orderNumber,
      data.items.map((i) => ({
        item_id: i.productId,
        item_name: i.productName,
        quantity: i.quantity ?? 1,
        price: i.price,
      })),
      data.value,
      currency,
    ),
  );

  safe("clarity", () => {
    clarityEvent("purchase");
    clarityUpgrade("purchase");
    clarityTag("purchased", true);
    clarityTag("order_value", data.value);
  });

  // Mark as tracked
  try {
    sessionStorage.setItem(dedupKey, "1");
  } catch (err) {
    console.warn("[tracking] sessionStorage unavailable for dedup write:", err instanceof Error ? err.message : err);
  }
}

export function trackSearch(data: SearchData): void {
  safe("meta", () => trackMetaEvent("Search", { search_string: data.query }));
  safe("ga4", () => ga4Search(data.query));
}

export function trackGenerateLead(data: LeadData): void {
  safe("meta", () => trackMetaEvent("Lead", {}, data.email));
  safe("ga4", () => ga4GenerateLead());
}

export function trackAddPaymentInfo(data: PaymentInfoData): void {
  const currency = data.currency ?? DEFAULT_CURRENCY;

  safe("meta", () =>
    trackMetaEvent("AddPaymentInfo", {
      currency,
      content_ids: data.productIds,
      content_type: "product",
    }),
  );

  safe("ga4", () => trackGA4Event("add_payment_info", { currency }));
}
