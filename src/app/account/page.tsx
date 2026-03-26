"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { startLogin, startLogout, isLoggedIn } from "@/lib/wix-auth";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";
import LoadingIndicator from "@/components/LoadingIndicator";
import type { orders as ordersType } from "@wix/ecom";

type Order = ordersType.Order;
type Tab = "orders" | "wishlist" | "settings";

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="pt-12 pb-10">
      <h2 className="font-serif italic text-2xl tracking-tight text-on-surface">
        {title}
      </h2>
      <div className="mt-3 w-12 h-[2px] bg-secondary" />
    </div>
  );
}

function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (tab: Tab) => void;
}) {
  const tabs: { key: Tab; label: string }[] = [
    { key: "orders", label: "Orders" },
    { key: "wishlist", label: "Wishlist" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="flex gap-8 border-b border-outline-variant/20">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`pb-3 text-[10px] tracking-[0.25em] uppercase font-medium transition-colors ${
            active === tab.key
              ? "text-on-surface border-b-2 border-on-surface"
              : "text-on-surface-variant hover:text-on-surface"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false);

  const date = order._createdDate
    ? new Date(order._createdDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  const status = order.status ?? "UNKNOWN";
  const total = order.priceSummary?.total?.formattedAmount ?? "";
  const orderNumber = order.number ?? order._id ?? "";

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between bg-surface-container-low px-5 py-5 text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-4">
            <span className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
              Order #{orderNumber}
            </span>
            <span className="text-[10px] tracking-[0.2em] uppercase font-medium text-secondary">
              {status.replace(/_/g, " ")}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-4">
            <span className="text-[10px] tracking-widest text-on-surface-variant">
              {date}
            </span>
            {total && (
              <span className="text-[10px] tracking-widest text-on-surface-variant">
                {total}
              </span>
            )}
          </div>
        </div>
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-300"
          style={{ transform: expanded ? "rotate(180deg)" : undefined }}
        >
          expand_more
        </span>
      </button>

      {expanded && order.lineItems && order.lineItems.length > 0 && (
        <div className="bg-surface-container-low/50 px-5 pb-5">
          <div className="border-t border-outline-variant/20 pt-4 space-y-3">
            {order.lineItems.map((item, i) => (
              <div key={i} className="flex justify-between">
                <div>
                  <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
                    {item.productName?.translated ?? item.productName?.original ?? "Item"}
                  </p>
                  <p className="text-[10px] tracking-widest text-on-surface-variant">
                    Qty: {item.quantity}
                  </p>
                </div>
                <p className="text-[10px] tracking-widest text-on-surface-variant">
                  {item.price?.formattedAmount ?? ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function OrdersTab() {
  const [orderList, setOrderList] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        const wix = getBrowserWixClient();
        await ensureVisitorTokens(wix);
        const result = await wix.orders.searchOrders({
          sort: [{ fieldName: "createdDate", order: "DESC" }],
        });
        setOrderList(result.orders ?? []);
      } catch (err) {
        console.error("Failed to load orders:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  if (loading) return <LoadingIndicator />;

  if (orderList.length === 0) {
    return (
      <div className="mt-16 text-center">
        <p className="text-sm leading-relaxed text-on-surface-variant">
          No orders yet.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-xs tracking-[0.15em] uppercase font-medium text-on-surface underline underline-offset-4"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {orderList.map((order) => (
        <OrderRow key={order._id} order={order} />
      ))}
    </div>
  );
}

function WishlistTab() {
  return (
    <div className="mt-16 text-center">
      <p className="text-sm leading-relaxed text-on-surface-variant mb-6">
        View and manage your saved items in your bag.
      </p>
      <Link
        href="/cart?tab=wishlist"
        className="text-xs tracking-[0.15em] uppercase font-medium text-on-surface underline underline-offset-4"
      >
        View Wishlist
      </Link>
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="mt-8 max-w-md">
      <p className="text-sm leading-relaxed text-on-surface-variant">
        You are currently signed in.
      </p>
      <button
        onClick={() => startLogout()}
        className="mt-8 w-full bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98]"
      >
        Sign Out
      </button>
    </div>
  );
}

export default function AccountPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("orders");

  const checkAuth = useCallback(() => {
    setLoggedIn(isLoggedIn());
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
    window.addEventListener("auth-changed", checkAuth);
    return () => window.removeEventListener("auth-changed", checkAuth);
  }, [checkAuth]);

  if (loading) return null;

  if (!loggedIn) {
    return (
      <section className="px-5">
        <SectionHeading title="Account" />
        <div className="max-w-md">
          <p className="text-sm leading-relaxed text-on-surface-variant">
            Sign in to view your orders and manage your account.
          </p>
          <button
            onClick={() => startLogin()}
            className="mt-8 w-full bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98]"
          >
            Sign In
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="px-5">
      <SectionHeading title="Account" />
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === "orders" && <OrdersTab />}
      {activeTab === "wishlist" && <WishlistTab />}
      {activeTab === "settings" && <SettingsTab />}
    </section>
  );
}
