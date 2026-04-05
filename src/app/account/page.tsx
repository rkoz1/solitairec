"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { startLogin, startLogout } from "@/lib/wix-auth";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";
import { useMember } from "@/contexts/MemberContext";
import LoadingIndicator from "@/components/LoadingIndicator";
import { showToast } from "@/lib/toast";
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
  const [tracking, setTracking] = useState<{ trackingNumber: string; shippingProvider: string; trackingLink?: string }[]>([]);
  const [trackingLoaded, setTrackingLoaded] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);

  useEffect(() => {
    if (!expanded || trackingLoaded) return;
    import("./actions").then(({ getOrderTracking }) => {
      getOrderTracking(order._id ?? "").then((t) => {
        setTracking(t);
        setTrackingLoaded(true);
      });
    });
  }, [expanded, trackingLoaded, order._id]);

  const date = order._createdDate
    ? new Date(order._createdDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "";

  const fulfillment = (order as unknown as { fulfillmentStatus?: string }).fulfillmentStatus;
  const payment = (order as unknown as { paymentStatus?: string }).paymentStatus;

  // Show the most relevant status to the customer
  let statusLabel: string;
  let statusColor: string;
  if (fulfillment === "FULFILLED") {
    statusLabel = "Delivered";
    statusColor = "text-green-700";
  } else if (fulfillment === "PARTIALLY_FULFILLED") {
    statusLabel = "Partially Shipped";
    statusColor = "text-secondary";
  } else if (payment === "PAID" || order.status === "APPROVED") {
    statusLabel = "Processing";
    statusColor = "text-secondary";
  } else if (payment === "PENDING" || payment === "NOT_PAID") {
    statusLabel = "Awaiting Payment";
    statusColor = "text-on-surface-variant";
  } else if (payment === "FULLY_REFUNDED") {
    statusLabel = "Refunded";
    statusColor = "text-on-surface-variant";
  } else if (payment === "PARTIALLY_REFUNDED") {
    statusLabel = "Partially Refunded";
    statusColor = "text-on-surface-variant";
  } else if (order.status === "CANCELED") {
    statusLabel = "Cancelled";
    statusColor = "text-on-surface-variant";
  } else {
    statusLabel = (order.status ?? "Unknown").replace(/_/g, " ");
    statusColor = "text-on-surface-variant";
  }

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
            <span className={`text-[10px] tracking-[0.2em] uppercase font-medium ${statusColor}`}>
              {statusLabel}
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

      {expanded && (
        <div className="bg-surface-container-low/50 px-5 pb-5">
          {/* Tracking info */}
          {tracking.length > 0 && (
            <div className="border-t border-outline-variant/20 pt-4 pb-3">
              {tracking.map((t, i) => (
                <div
                  key={i}
                  onClick={() => {
                    navigator.clipboard.writeText(t.trackingNumber).then(() => {
                      setCopiedTracking(t.trackingNumber);
                      setTimeout(() => setCopiedTracking(null), 2000);
                    });
                  }}
                  className="flex items-center gap-3 mb-2 cursor-pointer active:scale-[0.99] transition-transform"
                >
                  <span className="material-symbols-outlined text-[16px] text-secondary">
                    local_shipping
                  </span>
                  <div className="flex-1">
                    <p className="text-[10px] tracking-[0.15em] uppercase font-medium text-on-surface">
                      {t.shippingProvider}
                    </p>
                    <p className="text-[10px] tracking-widest text-on-surface-variant">
                      {copiedTracking === t.trackingNumber ? "Copied!" : t.trackingNumber}
                    </p>
                  </div>
                  {t.trackingLink && (
                    <a
                      href={t.trackingLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[10px] tracking-[0.15em] uppercase font-medium text-secondary hover:text-on-surface transition-colors"
                    >
                      Track
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Line items */}
          {order.lineItems && order.lineItems.length > 0 && (
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
          )}
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
  tierId?: string | null;
  rollingWindowPoints?: number;
  expirationDate?: string;
  expiringPoints?: number;
}

interface TierInfoData {
  tiers: { id: string | null; name: string; requiredPoints: number }[];
  baseTierName: string;
}

interface LoyaltyCouponData {
  id: string;
  code: string;
  name: string;
  status: string;
  discountAmount?: number;
  discountType?: string;
}

interface AvailableRewardData {
  id: string;
  name: string;
  discountAmount: string;
  costInPoints: number;
  restrictedToTierId?: string;
}

function RewardsTab() {
  const [account, setAccount] = useState<LoyaltyAccountData | null>(null);
  const [rewards, setRewards] = useState<AvailableRewardData[]>([]);
  const [tierInfo, setTierInfo] = useState<TierInfoData | null>(null);
  const [coupons, setCoupons] = useState<LoyaltyCouponData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [redeemedCoupon, setRedeemedCoupon] = useState<{ code: string; name: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }

  const fetchData = useCallback(async () => {
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      // Fetch account, rewards, coupons, and tier info in parallel
      const [accountResult, rewardsData, couponsResult, tierData] = await Promise.all([
        wix.loyaltyAccounts.getCurrentMemberAccount(),
        import("./actions").then(({ getAvailableRewards }) => getAvailableRewards()),
        wix.loyaltyCoupons.getCurrentMemberCoupons().catch(() => ({ loyaltyCoupons: [] })),
        import("./actions").then(({ getTierInfo }) => getTierInfo()),
      ]);

      const acc = accountResult.account ?? accountResult;
      const points = acc.points ?? {};
      const expiration = acc.pointsExpiration as { expirationDate?: string | Date; expiringPointsAmount?: number } | undefined;

      setAccount({
        balance: points.balance ?? 0,
        earned: points.earned ?? 0,
        redeemed: points.redeemed ?? 0,
        rewardAvailable: acc.rewardAvailable ?? false,
        tierName: acc.tier?.tierDefinition?.name ?? undefined,
        tierPoints: acc.tier?.points ?? undefined,
        tierId: acc.tier?._id ?? null,
        rollingWindowPoints: acc.tier?.points ?? 0,
        expirationDate: expiration?.expirationDate
          ? new Date(expiration.expirationDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
          : undefined,
        expiringPoints: expiration?.expiringPointsAmount,
      });

      setTierInfo(tierData);

      setRewards(rewardsData);

      const couponsList = (couponsResult?.loyaltyCoupons ?? []) as {
        _id?: string;
        id?: string;
        couponReference?: {
          code?: string;
          name?: string;
          specification?: {
            type?: string;
            moneyOffAmount?: number;
            percentOffRate?: number;
            freeShipping?: boolean;
          };
        };
        status?: string;
        rewardName?: string;
      }[];

      setCoupons(
        couponsList
          .filter((c) => c.status === "ACTIVE" || c.status === "PENDING")
          .map((c) => ({
            id: c._id ?? c.id ?? "",
            code: c.couponReference?.code ?? "",
            name: c.rewardName ?? c.couponReference?.name ?? "Coupon",
            status: c.status ?? "UNKNOWN",
            discountAmount: c.couponReference?.specification?.moneyOffAmount,
            discountType: c.couponReference?.specification?.type,
          }))
      );
    } catch (err) {
      console.error("Failed to load loyalty account:", err);
      setError("Rewards programme not available.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleRedeem(rewardId: string) {
    setRedeemingId(rewardId);
    setRedeemedCoupon(null);
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      const result = await wix.loyaltyCoupons.redeemCurrentMemberPointsForCoupon(rewardId);
      const coupon = result.coupon;
      const code = coupon?.couponReference?.code ?? "";
      const name = coupon?.rewardName ?? "Reward";

      setRedeemedCoupon({ code, name });

      // Refresh data to update balance and coupons list
      await fetchData();
    } catch (err) {
      console.error("Failed to redeem reward:", err);
      showToast("Unable to redeem reward. Please try again.", "error");
    } finally {
      setRedeemingId(null);
    }
  }

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

      {/* Tier Progress */}
      {(() => {
        const tiers = tierInfo?.tiers ?? [];
        const currentTierId = account.tierId;
        const currentTierName = currentTierId
          ? tiers.find((t) => t.id === currentTierId)?.name ?? account.tierName ?? "Member"
          : tierInfo?.baseTierName ?? "Green";

        // Find next tier
        const sortedTiers = [...tiers].sort((a, b) => a.requiredPoints - b.requiredPoints);
        const currentTierIndex = currentTierId
          ? sortedTiers.findIndex((t) => t.id === currentTierId)
          : -1; // base tier = before all tiers
        const nextTier = sortedTiers[currentTierIndex + 1];

        const windowPoints = account.rollingWindowPoints ?? account.earned;
        const nextRequired = nextTier?.requiredPoints ?? 0;
        const progress = nextRequired > 0 ? Math.min((windowPoints / nextRequired) * 100, 100) : 100;

        return (
          <div className="bg-surface-container-low px-6 py-6 mb-4">
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface-variant text-center mb-1">
              Your current tier
            </p>
            <p className="font-serif text-2xl tracking-tight text-on-surface text-center">
              {currentTierName}
            </p>

            {nextTier && (
              <>
                <p className="mt-4 text-[10px] tracking-[0.2em] uppercase text-on-surface-variant text-center">
                  Total points earned:
                </p>
                <p className="text-sm font-medium text-on-surface text-center">
                  {windowPoints.toLocaleString()} / {nextRequired.toLocaleString()}
                </p>

                {/* Progress bar */}
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-2 bg-surface-container overflow-hidden">
                    <div
                      className="h-full bg-secondary transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-[10px] tracking-wide text-on-surface-variant font-medium">
                    {Math.round(progress)}%
                  </span>
                </div>

                <p className="mt-2 text-[10px] tracking-[0.15em] text-on-surface-variant text-center">
                  Next tier: {nextTier.name}
                </p>
              </>
            )}

            {!nextTier && (
              <p className="mt-2 text-[10px] tracking-[0.15em] text-secondary text-center uppercase font-medium">
                Highest tier reached
              </p>
            )}
          </div>
        );
      })()}

      {/* Points Expiration */}
      {account.expiringPoints && account.expiringPoints > 0 && account.expirationDate && (
        <div className="bg-surface-container-low px-5 py-4 mb-4">
          <p className="text-[10px] tracking-[0.2em] uppercase text-on-surface-variant">
            <span className="font-medium">{account.expiringPoints.toLocaleString()} points</span> expiring on {account.expirationDate}
          </p>
        </div>
      )}

      {/* Redeemed coupon success message */}
      {redeemedCoupon && (
        <div
          onClick={() => copyCode(redeemedCoupon.code)}
          className="bg-surface-container-low px-6 py-5 mb-6 border-l-2 border-secondary cursor-pointer active:scale-[0.99] transition-transform"
        >
          <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-secondary mb-2">
            Coupon Redeemed
          </p>
          <p className="text-sm text-on-surface-variant mb-2">
            {redeemedCoupon.name}
          </p>
          <p className="font-mono text-lg tracking-widest text-on-surface font-medium">
            {redeemedCoupon.code}
          </p>
          <p className="mt-2 text-[10px] tracking-wide text-on-surface-variant">
            {copiedCode === redeemedCoupon.code ? "Copied!" : "Tap to copy code"}
          </p>
        </div>
      )}

      {/* Available Rewards */}
      {(() => {
        // Filter out rewards restricted to tiers the user doesn't have
        const visibleRewards = rewards.filter((r) =>
          !r.restrictedToTierId || r.restrictedToTierId === account.tierId
        );
        if (visibleRewards.length === 0) return null;
        return (
        <div className="mb-8">
          <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface-variant mb-3">
            Available Rewards
          </p>
          <div className="space-y-2">
            {visibleRewards.map((reward) => {
              const canAfford = account.balance >= reward.costInPoints;
              const isRedeeming = redeemingId === reward.id;

              return (
                <div
                  key={reward.id}
                  className="bg-surface-container-low px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface truncate">
                      {reward.name}
                    </p>
                    <p className="mt-0.5 text-[10px] tracking-widest text-on-surface-variant">
                      {reward.discountAmount} off
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    <span className="text-[10px] tracking-widest text-secondary font-medium">
                      {reward.costInPoints.toLocaleString()} pts
                    </span>
                    <button
                      onClick={() => handleRedeem(reward.id)}
                      disabled={!canAfford || isRedeeming}
                      className={`px-4 py-2 text-[10px] tracking-[0.2em] uppercase font-medium transition-colors ${
                        canAfford
                          ? "bg-on-surface text-on-primary hover:bg-on-surface/90"
                          : "bg-surface-container text-on-surface-variant cursor-not-allowed"
                      } disabled:opacity-50`}
                    >
                      {isRedeeming ? "..." : "Redeem"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        );
      })()}

      {/* Existing Coupons */}
      {coupons.length > 0 && (
        <div className="mb-8">
          <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-on-surface-variant mb-3">
            Your Coupons
          </p>
          <div className="space-y-2">
            {coupons.map((coupon) => (
              <div
                key={coupon.id}
                onClick={() => copyCode(coupon.code)}
                className="bg-surface-container-low px-5 py-4 flex items-center justify-between gap-4 cursor-pointer active:scale-[0.99] transition-transform"
              >
                <div className="min-w-0">
                  <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface truncate">
                    {coupon.name}
                  </p>
                  {coupon.discountAmount && (
                    <p className="mt-0.5 text-[10px] tracking-widest text-on-surface-variant">
                      HK${coupon.discountAmount} off
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs tracking-widest text-on-surface font-medium">
                    {coupon.code}
                  </p>
                  <p className="mt-0.5 text-[10px] tracking-wide text-on-surface-variant">
                    {copiedCode === coupon.code ? "Copied!" : "Tap to copy"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-6">
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

const COUNTRIES = [
  { code: "AU", name: "Australia" },
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BR", name: "Brazil" },
  { code: "CA", name: "Canada" },
  { code: "CN", name: "China" },
  { code: "DK", name: "Denmark" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GR", name: "Greece" },
  { code: "HK", name: "Hong Kong" },
  { code: "IN", name: "India" },
  { code: "IE", name: "Ireland" },
  { code: "IL", name: "Israel" },
  { code: "IT", name: "Italy" },
  { code: "JP", name: "Japan" },
  { code: "MX", name: "Mexico" },
  { code: "NL", name: "Netherlands" },
  { code: "NZ", name: "New Zealand" },
  { code: "NO", name: "Norway" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "SG", name: "Singapore" },
  { code: "KR", name: "South Korea" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "CH", name: "Switzerland" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
];

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
  const { member: ctxMember, loading: memberLoading } = useMember();
  const [addresses, setAddresses] = useState<AddressData[]>([]);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<AddressData>({});
  const [saving, setSaving] = useState(false);

  // Initial load from context
  useEffect(() => {
    if (memberLoading) return;
    if (ctxMember) {
      setMemberId(ctxMember._id ?? null);
      setAddresses((ctxMember.contact?.addresses as AddressData[]) ?? []);
    }
    setLoading(false);
  }, [ctxMember, memberLoading]);

  async function fetchAddresses() {
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);
      const response = await wix.members.getCurrentMember({
        fieldsets: ["FULL"],
      });
      const member = (response as unknown as { member?: Record<string, unknown> }).member ?? response;
      setMemberId((member._id as string) ?? null);
      setAddresses(((member.contact as Record<string, unknown>)?.addresses as AddressData[]) ?? []);
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
    if (!form.country || !form.addressLine?.trim() || !form.city?.trim() || !form.postalCode?.trim()) {
      showToast("Please fill in all required fields.", "error");
      return;
    }
    setSaving(true);
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
      showToast("Address saved.", "success");
    } catch (err) {
      console.error("Failed to save address:", err);
      showToast("Unable to save address. Please try again.", "error");
    } finally {
      setSaving(false);
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
          <div>
            <label className="block text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant mb-2">
              Country / Region *
            </label>
            <select
              value={form.country ?? ""}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors appearance-none"
            >
              <option value="">Select country</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant mb-2">
              Address *
            </label>
            <input
              type="text"
              placeholder="Street address"
              value={form.addressLine ?? ""}
              onChange={(e) => setForm({ ...form, addressLine: e.target.value })}
              className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant mb-2">
              City *
            </label>
            <input
              type="text"
              placeholder="City"
              value={form.city ?? ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
            />
          </div>
          <div>
            <label className="block text-[10px] tracking-[0.2em] uppercase font-medium text-on-surface-variant mb-2">
              Zip / Postal code *
            </label>
            <input
              type="text"
              placeholder="Postal code"
              value={form.postalCode ?? ""}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              className="w-full bg-surface-container-low px-4 py-3 text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none border-b border-outline-variant/20 focus:border-on-surface transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-4 mt-8">
          <button
            onClick={saveAddress}
            disabled={saving}
            className="flex-1 bg-on-surface text-on-primary py-4 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
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
              key={i}
              className="bg-surface-container-low px-5 py-4"
            >
              <p className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
                {[addr.addressLine, addr.addressLine2]
                  .filter(Boolean)
                  .join(", ")}
              </p>
              <p className="mt-1 text-[10px] tracking-widest text-on-surface-variant">
                {[addr.city, addr.postalCode, COUNTRIES.find((c) => c.code === addr.country)?.name ?? addr.country]
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
  const { member: ctxMember, isLoggedIn: ctxLoggedIn, loading: memberLoading } = useMember();
  const [activeTab, setActiveTab] = useState<Tab>("orders");

  const memberName = ctxMember?.contact?.firstName ?? ctxMember?.profile?.nickname ?? "";
  const memberEmail = ctxMember?.loginEmail ?? ctxMember?.contact?.emails?.[0] ?? "";

  if (memberLoading) return null;

  if (!ctxLoggedIn) {
    return (
      <section className="px-5 lg:px-10 xl:max-w-7xl xl:mx-auto">
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
    <section className="px-5 lg:px-10 xl:max-w-7xl xl:mx-auto">
      <SectionHeading title={memberName ? `Hello, ${memberName}` : "Account"} />
      <TabBar active={activeTab} onChange={setActiveTab} />
      {activeTab === "orders" && <OrdersTab />}
      {activeTab === "rewards" && <RewardsTab />}
      {activeTab === "addresses" && <AddressesTab />}
      {activeTab === "settings" && <SettingsTab />}
    </section>
  );
}
