"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";

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
  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    async function fetchOrder() {
      try {
        const wix = getBrowserWixClient();
        await ensureVisitorTokens(wix);

        // Search for the order by ID
        const result = await wix.orders.searchOrders({
          search: { filter: { "id": { "$eq": orderId } } },
        });

        const found = result.orders?.[0];
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
        }
      } catch (err) {
        console.error("Failed to fetch order:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [orderId]);

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
