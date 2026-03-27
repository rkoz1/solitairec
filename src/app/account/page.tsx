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
type Tab = "orders" | "rewards" | "addresses" | "settings";

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
    { key: "rewards", label: "Rewards" },
    { key: "addresses", label: "Addresses" },
    { key: "settings", label: "Settings" },
  ];

  return (
    <div className="grid grid-cols-4 border-b border-outline-variant/20">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`pb-3 text-[10px] tracking-[0.15em] uppercase font-medium transition-colors text-center ${
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

/* ------------------------------------------------------------------ */
/*  Orders Tab                                                        */
/* ------------------------------------------------------------------ */

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
        <span
          className="material-symbols-outlined text-[18px] text-on-surface-variant transition-transform duration-300"
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

/* ------------------------------------------------------------------ */
/*  Rewards Tab (SOL-11)                                              */
/* ------------------------------------------------------------------ */

interface LoyaltyAccountData {
  balance: number;
  earned: number;
  redeemed: number;
  rewardAvailable: boolean;
  tierName?: string;
  tierPoints?: number;
}

function RewardsTab() {
  const [account, setAccount] = useState<LoyaltyAccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLoyalty() {
      try {
        const wix = getBrowserWixClient();
        await ensureVisitorTokens(wix);
        const result = await wix.loyaltyAccounts.getCurrentMemberAccount();

        const acc = result.account ?? result;
        const points = acc.points ?? {};

        setAccount({
          balance: points.balance ?? 0,
          earned: points.earned ?? 0,
          redeemed: points.redeemed ?? 0,
          rewardAvailable: acc.rewardAvailable ?? false,
          tierName: acc.tier?.tierDefinition?.name ?? undefined,
          tierPoints: acc.tier?.points ?? undefined,
        });
      } catch (err) {
        console.error("Failed to load loyalty account:", err);
        setError("Rewards programme not available.");
      } finally {
        setLoading(false);
      }
    }
    fetchLoyalty();
  }, []);

  if (loading) return <LoadingIndicator />;

  if (error) {
    return (
      <div className="mt-16 text-center">
        <p className="text-sm text-on-surface-variant">{error}</p>
        <Link
          href="/loyalty"
          className="mt-6 inline-block text-xs tracking-[0.15em] uppercase font-medium text-on-surface underline underline-offset-4"
        >
          Learn About Our Rewards
        </Link>
      </div>
    );
  }

  if (!account) return null;

  return (
    <div className="mt-8 max-w-md">
      {/* Points balance */}
      <div className="bg-surface-container-low px-6 py-6 mb-4">
        <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-secondary mb-2">
          Points Balance
        </p>
        <p className="font-serif text-4xl tracking-tight text-on-surface">
          {account.balance.toLocaleString()}
        </p>
      </div>

      {/* Tier */}
      {account.tierName && (
        <div className="bg-surface-container-low px-6 py-5 mb-4">
          <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-secondary mb-1">
            Current Tier
          </p>
          <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
            {account.tierName}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-surface-container-low px-5 py-4">
          <p className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
            Total Earned
          </p>
          <p className="mt-1 text-sm font-medium text-on-surface">
            {account.earned.toLocaleString()}
          </p>
        </div>
        <div className="bg-surface-container-low px-5 py-4">
          <p className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
            Redeemed
          </p>
          <p className="mt-1 text-sm font-medium text-on-surface">
            {account.redeemed.toLocaleString()}
          </p>
        </div>
      </div>

      {account.rewardAvailable && (
        <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-secondary mb-4">
          You have a reward available to redeem!
        </p>
      )}

      <Link
        href="/loyalty"
        className="text-xs tracking-[0.15em] uppercase font-medium text-on-surface underline underline-offset-4 hover:text-secondary transition-colors"
      >
        How Rewards Work
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Addresses Tab (SOL-12)                                            */
/* ------------------------------------------------------------------ */

interface AddressData {
  _id?: string;
  addressLine?: string;
  addressLine2?: string;
  city?: string;
  subdivision?: string;
  country?: string;
  postalCode?: string;
}

function AddressesTab() {
  const [addresses, setAddresses] = useState<AddressData[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<AddressData>({});

  useEffect(() => {
    fetchAddresses();
  }, []);

  async function fetchAddresses() {
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);
      const member = await wix.members.getCurrentMember({
        fieldsets: ["FULL"],
      });
      setMemberId(member._id ?? null);
      setAddresses(member.contact?.addresses ?? []);
    } catch (err) {
      console.error("Failed to load addresses:", err);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(index: number) {
    setForm({ ...addresses[index] });
    setEditing(index);
  }

  function startNew() {
    setForm({});
    setEditing("new");
  }

  async function saveAddress() {
    if (!memberId) return;
    try {
      const wix = getBrowserWixClient();
      let updated: AddressData[];

      if (editing === "new") {
        updated = [...addresses, form];
      } else if (typeof editing === "number") {
        updated = addresses.map((a, i) => (i === editing ? form : a));
      } else {
        return;
      }

      await wix.members.updateMember(memberId, {
        contact: { addresses: updated },
      });

      setEditing(null);
      setForm({});
      await fetchAddresses();
    } catch (err) {
      console.error("Failed to save address:", err);
      alert("Failed to save address. Please try again.");
    }
  }

  async function deleteAddress(index: number) {
    if (!memberId) return;
    try {
      const wix = getBrowserWixClient();
      const updated = addresses.filter((_, i) => i !== index);
      await wix.members.updateMember(memberId, {
        contact: { addresses: updated },
      });
      await fetchAddresses();
    } catch (err) {
      console.error("Failed to delete address:", err);
    }
  }

  if (loading) return <LoadingIndicator />;

  // Editing form
  if (editing !== null) {
    return (
      <div className="mt-8 max-w-md">
        <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-secondary mb-6">
          {editing === "new" ? "Add Address" : "Edit Address"}
        </p>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="Address line 1"
            value={form.addressLine ?? ""}
            onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
            className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
          />
          <input
            type="text"
            placeholder="Apartment, suite, etc."
            value={form.addressLine2 ?? ""}
            onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
            className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="City"
              value={form.city ?? ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
            />
            <input
              type="text"
              placeholder="State / Region"
              value={form.subdivision ?? ""}
              onChange={(e) => setForm({ ...form, subdivision: e.target.value })}
              className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Postal code"
              value={form.postalCode ?? ""}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
            />
            <input
              type="text"
              placeholder="Country"
              value={form.country ?? ""}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <button
            onClick={saveAddress}
            className="flex-1 bg-on-surface text-on-primary py-4 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98]"
          >
            Save
          </button>
          <button
            onClick={() => {
              setEditing(null);
              setForm({});
            }}
            className="px-6 py-4 text-xs tracking-[0.15em] uppercase font-medium text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 max-w-md">
      {addresses.length === 0 ? (
        <p className="text-sm text-on-surface-variant mb-6">
          No saved addresses.
        </p>
      ) : (
        <div className="space-y-2 mb-6">
          {addresses.map((addr, i) => (
            <div
              key={addr._id ?? i}
              className="bg-surface-container-low px-5 py-4"
            >
              <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
                {[addr.addressLine, addr.addressLine2]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="mt-1 text-[10px] tracking-widest text-on-surface-variant">
                {[addr.city, addr.subdivision, addr.postalCode, addr.country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <div className="flex gap-4 mt-3">
                <button
                  onClick={() => startEdit(i)}
                  className="text-[10px] tracking-[0.15em] uppercase font-medium text-on-surface hover:text-secondary transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteAddress(i)}
                  className="text-[10px] tracking-[0.15em] uppercase text-on-surface-variant hover:text-on-surface transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={startNew}
        className="text-xs tracking-[0.15em] uppercase font-medium text-on-surface underline underline-offset-4 hover:text-secondary transition-colors"
      >
        Add New Address
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Wishlist + Settings Tabs                                          */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Account Page                                                      */
/* ------------------------------------------------------------------ */

export default function AccountPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("orders");
  const [memberName, setMemberName] = useState("");
  const [memberEmail, setMemberEmail] = useState("");

  const checkAuth = useCallback(() => {
    setLoggedIn(isLoggedIn());
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
    window.addEventListener("auth-changed", checkAuth);
    return () => window.removeEventListener("auth-changed", checkAuth);
  }, [checkAuth]);

  // Fetch member profile for greeting + newsletter
  useEffect(() => {
    if (!loggedIn) return;
    async function fetchMember() {
      try {
        const wix = getBrowserWixClient();
        await ensureVisitorTokens(wix);
        const response = await wix.members.getCurrentMember({
          fieldsets: ["FULL"],
        });
        const member = (response as unknown as { member?: Record<string, unknown> }).member ?? response;
        const m = member as Record<string, unknown>;
        const contact = m.contact as Record<string, unknown> | undefined;
        const profile = m.profile as Record<string, unknown> | undefined;
        setMemberName((contact?.firstName as string) ?? (profile?.nickname as string) ?? "");
        setMemberEmail((m.loginEmail as string) ?? ((contact?.emails as string[])?.[0]) ?? "");
      } catch {
        // ignore
      }
    }
    fetchMember();
  }, [loggedIn]);

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
      <SectionHeading title={memberName ? `Hello, ${memberName}` : "Account"} />
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === "orders" && <OrdersTab />}
      {activeTab === "rewards" && <RewardsTab />}
      {activeTab === "addresses" && <AddressesTab />}
      {activeTab === "settings" && <SettingsTab />}
    </section>
  );
}
