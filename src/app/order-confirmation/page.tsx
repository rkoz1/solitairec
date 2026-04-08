"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";
import { trackMetaEvent } from "@/lib/meta-track";
import { trackAnalytics } from "@/lib/analytics";
import { clarityEvent, clarityTag, clarityUpgrade } from "@/lib/clarity";

/** Deterministic eventId from order ID — must match webhook's server-side hash. */
async function purchaseEventId(orderId: string): Promise<string> {
  const data = new TextEncoder().encode("purchase-" + orderId);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 36);
}

interface OrderSummary {
  orderNumber: string;
  total: string;
  itemCount: number;
  status: string;
  date: string;
}

export default function OrderConfirmationPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const source = searchParams.get("source");
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Express checkout orders: read from sessionStorage (created by server API key)
    if (source === "express") {
      try {
        const stored = sessionStorage.getItem("expressOrder");
        if (stored) {
          const data = JSON.parse(stored);
          setOrder({
            orderNumber: String(data.orderNumber ?? ""),
            total: data.total ?? "",
            itemCount: data.itemCount ?? 1,
            status: data.status ?? "APPROVED",
            date: data.date ?? "",
          });
          trackAnalytics("purchase", {
            order_number: String(data.orderNumber ?? ""),
            total: parseFloat((data.total ?? "0").replace(/[^0-9.]/g, "")),
            currency: "HKD",
          });
          clarityEvent("purchase");
          clarityUpgrade("purchase");
          clarityTag("purchased", true);
          clarityTag("order_value", data.total ?? "");
          sessionStorage.removeItem("expressOrder");
        }
      } catch {
        // Fall through to generic message
      }
      setLoading(false);
      return;
    }

    async function fetchOrder() {
      try {
        const wix = getBrowserWixClient();
        await ensureVisitorTokens(wix);

        let found;

        if (orderId) {
          // Fetch by specific order ID
          const result = await wix.orders.searchOrders({
            search: { filter: { "id": { "$eq": orderId } } },
          });
          found = result.orders?.[0];
        } else {
          // Cart checkout redirect — no orderId param. Fetch the most recent order.
          const result = await wix.orders.searchOrders({
            search: {
              filter: {},
              cursorPaging: { limit: 1 },
            },
          });
          found = result.orders?.[0];
          // Only use if created in the last 5 minutes (to avoid showing an old order)
          if (found?._createdDate) {
            const ageMs = Date.now() - new Date(found._createdDate).getTime();
            if (ageMs > 5 * 60 * 1000) found = undefined;
          }
        }
        if (found) {
          setOrder({
            orderNumber: found.number?.toString() ?? orderId ?? "",
            total: found.priceSummary?.total?.formattedAmount ?? "",
            itemCount: found.lineItems?.length ?? 0,
            status: found.status ?? "APPROVED",
            date: found._createdDate
              ? new Date(found._createdDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "",
          });

          // Track Purchase for cart checkout (Wix redirect flow)
          const foundOrderId = found._id ?? orderId ?? "";
          const dedupKey = `tracked_purchase_${foundOrderId}`;

          // Idempotency: skip if already tracked (e.g. page refresh)
          if (!sessionStorage.getItem(dedupKey)) {
            const totalAmount = parseFloat(
              (found.priceSummary?.total?.amount ?? "0").replace(/[^0-9.]/g, "")
            );
            if (totalAmount > 0) {
              const contentIds = (found.lineItems ?? [])
                .map((li: { catalogReference?: { catalogItemId?: string } }) =>
                  li.catalogReference?.catalogItemId
                )
                .filter(Boolean) as string[];

              // Deterministic eventId matching the webhook's hash for Meta dedup
              const eventId = await purchaseEventId(foundOrderId);

              // Recover _fbc/_fbp saved before Wix redirect
              let storedFbc: string | undefined;
              let storedFbp: string | undefined;
              try {
                const raw = sessionStorage.getItem("meta_cookies");
                if (raw) {
                  const parsed = JSON.parse(raw);
                  storedFbc = parsed.fbc;
                  storedFbp = parsed.fbp;
                  sessionStorage.removeItem("meta_cookies");
                }
              } catch { /* ignore */ }

              trackMetaEvent(
                "Purchase",
                {
                  value: totalAmount,
                  currency: "HKD",
                  content_ids: contentIds,
                  content_type: "product",
                  order_id: found.number?.toString(),
                  num_items: found.lineItems?.length ?? 0,
                },
                found.buyerInfo?.email,
                found.buyerInfo?.memberId ?? found.buyerInfo?.visitorId,
                { eventId, fbc: storedFbc, fbp: storedFbp }
              );
              trackAnalytics("purchase", {
                order_number: found.number?.toString() ?? "",
                total: totalAmount,
                currency: "HKD",
              });
              clarityEvent("purchase");
              clarityUpgrade("purchase");
              clarityTag("purchased", true);
              clarityTag("order_value", totalAmount);

              sessionStorage.setItem(dedupKey, "1");
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch order:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, source]);

  // Clear cart badge since order is placed
  useEffect(() => {
    window.dispatchEvent(new Event("cart-updated"));
  }, []);

  return (
    <section className="px-6 pt-16 pb-24 max-w-lg mx-auto text-center">
      {/* Success icon */}
      <span className="material-symbols-outlined text-[48px] text-secondary">
        check_circle
      </span>

      <h1 className="mt-6 font-serif italic text-2xl tracking-tight text-on-surface">
        Thank You
      </h1>
      <div className="mt-3 mx-auto w-12 h-[2px] bg-secondary" />

      {loading ? (
        <p className="mt-8 text-sm text-on-surface-variant">
          Loading order details...
        </p>
      ) : order ? (
        <div className="mt-10">
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Your order has been placed successfully.
          </p>

          <div className="mt-8 bg-surface-container-low px-6 py-6 text-left">
            <div className="flex justify-between mb-3">
              <span className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
                Order
              </span>
              <span className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
                #{order.orderNumber}
              </span>
            </div>
            {order.date && (
              <div className="flex justify-between mb-3">
                <span className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
                  Date
                </span>
                <span className="text-[10px] tracking-widest text-on-surface">
                  {order.date}
                </span>
              </div>
            )}
            <div className="flex justify-between mb-3">
              <span className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
                Items
              </span>
              <span className="text-[10px] tracking-widest text-on-surface">
                {order.itemCount}
              </span>
            </div>
            <div className="flex justify-between pt-3 border-t border-outline-variant/20">
              <span className="text-xs tracking-[0.15em] uppercase font-medium text-on-surface">
                Total
              </span>
              <span className="text-xs tracking-widest font-medium text-on-surface">
                {order.total}
              </span>
            </div>
          </div>

          <p className="mt-6 text-[10px] tracking-[0.2em] uppercase font-medium text-secondary">
            {order.status.replace(/_/g, " ")}
          </p>
        </div>
      ) : (
        <p className="mt-8 text-sm leading-relaxed text-on-surface-variant">
          Your order has been placed. Check your email for confirmation.
        </p>
      )}

      <div className="mt-12 space-y-4">
        <Link
          href="/account"
          className="block w-full bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98]"
        >
          View Orders
        </Link>
        <Link
          href="/"
          className="block text-xs tracking-[0.15em] uppercase font-medium text-on-surface-variant underline underline-offset-4 hover:text-on-surface transition-colors"
        >
          Continue Shopping
        </Link>
      </div>
    </section>
  );
}
