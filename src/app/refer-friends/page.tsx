"use client";

import { useState, useEffect } from "react";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";

export default function ReferFriendsPage() {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchReferralCode() {
      try {
        const wix = getBrowserWixClient();
        await ensureVisitorTokens(wix);

        const result = await wix.referralCustomers.generateReferringCustomerForContact("me");
        const code = result.referringCustomer?.referralCode;
        if (code) setReferralCode(code);
      } catch (err) {
        console.error("Failed to fetch referral code:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchReferralCode();
  }, []);

  const referralUrl = referralCode
    ? `${typeof window !== "undefined" ? window.location.origin : "https://solitairec.com"}/referral/${referralCode}`
    : null;

  function handleCopy() {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <section className="max-w-2xl mx-auto">
      {/* Hero */}
      <div className="bg-surface-container-low px-8 pt-16 pb-12 text-center">
        <span className="material-symbols-outlined text-[48px] text-secondary/60 mb-4">
          card_giftcard
        </span>
        <h1 className="font-serif italic text-2xl tracking-tight text-secondary">
          Get a 10% discount for each friend you refer
        </h1>
        <p className="mt-4 font-serif text-lg tracking-tight text-on-surface">
          Get special perks for you and your friends
        </p>
      </div>

      <div className="px-5">
        <div className="pt-10" />

        {/* Steps */}
        <div className="space-y-8 pb-10">
          <div className="text-center">
            <p className="font-serif text-base tracking-tight text-on-surface">
              1. Give your friends a 10% discount.
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Applies to the lowest priced item in the cart.
            </p>
          </div>

          <div className="text-center">
            <p className="font-serif text-base tracking-tight text-on-surface">
              2. Get a 10% discount for each friend who places an order.
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              Applies to the lowest priced item in the cart.
            </p>
          </div>
        </div>

        {/* Referral link */}
        <div className="border-t border-outline-variant/20 pt-8 pb-20">
          {loading ? (
            <p className="text-center text-sm text-on-surface-variant">
              Loading your referral link...
            </p>
          ) : referralUrl ? (
            <div className="text-center">
              <p className="text-sm text-on-surface-variant mb-4">
                Copy your referral link
              </p>

              <div className="bg-surface-container-low px-4 py-3 mb-3">
                <p className="text-sm text-on-surface truncate">
                  {referralUrl}
                </p>
              </div>

              <button
                onClick={handleCopy}
                className="w-full bg-secondary text-on-primary py-4 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98]"
              >
                {copied ? "Copied!" : "Copy"}
              </button>

              <p className="mt-4 font-serif text-base tracking-tight text-on-surface">
                Share it with anyone
              </p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-sm text-on-surface-variant mb-4">
                Log in to get your personal referral link.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
