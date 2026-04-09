"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { handleCallback } from "@/lib/wix-auth";
import { getBrowserWixClient, ensureVisitorTokens } from "@/lib/wix-browser-client";
import { addItemToCart, type CartItemInput } from "@/lib/cart";
import { syncWishlistOnLogin } from "@/lib/wishlist";
import { trackMetaEvent } from "@/lib/meta-track";
import { trackAnalytics } from "@/lib/analytics";
import { clarityEvent, clarityTag } from "@/lib/clarity";
import LoadingIndicator from "@/components/LoadingIndicator";

const CART_BEFORE_LOGIN_KEY = "cart_before_login";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleCallback().then(async (result) => {
      if (result.success) {
        const wix = getBrowserWixClient();

        // Fire auth tracking events
        try {
          const resp = await wix.members.getCurrentMember({ fieldsets: ["FULL"] });
          const member = (resp as { member?: typeof resp }).member ?? resp;

          const email = member?.loginEmail;
          const memberId = member?._id;

          // Detect new signup: member created within the last 2 minutes
          const isNewSignup =
            member?._createdDate &&
            Date.now() - new Date(member._createdDate).getTime() < 2 * 60 * 1000;

          if (isNewSignup) {
            trackMetaEvent("CompleteRegistration", { currency: "HKD" }, email, memberId);
            trackAnalytics("signup", { method: "wix_oauth" });
            clarityEvent("sign_up_success");
            clarityTag("signup_completed", true);
          } else {
            trackAnalytics("login", { method: "wix_oauth" });
          }

          trackMetaEvent("Lead", {}, email, memberId);
          clarityEvent("login_success");
        } catch {
          // Don't block redirect if tracking fails
        }

        // Merge visitor cart into member cart
        try {
          const savedCart = sessionStorage.getItem(CART_BEFORE_LOGIN_KEY);
          if (savedCart) {
            const items: CartItemInput[] = JSON.parse(savedCart);
            await ensureVisitorTokens(wix);
            for (const item of items) {
              await addItemToCart(wix, item);
            }
            sessionStorage.removeItem(CART_BEFORE_LOGIN_KEY);
            window.dispatchEvent(new Event("cart-updated"));
          }
        } catch {
          // Don't block redirect if cart merge fails
        }

        // Sync wishlist: merge localStorage with Wix server
        try {
          await syncWishlistOnLogin(wix);
        } catch {
          // Don't block redirect if wishlist sync fails
        }

        router.push("/account");
      } else {
        setError(result.error ?? "Authentication failed.");
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <section className="px-5">
        <div className="pt-12 pb-10">
          <h2 className="font-serif italic text-2xl tracking-tight text-on-surface">
            Sign In Failed
          </h2>
          <div className="mt-3 w-12 h-[2px] bg-secondary" />
        </div>
        <div className="max-w-md">
          <p className="text-sm leading-relaxed text-on-surface-variant">{error}</p>
          <Link
            href="/account"
            className="mt-8 inline-block text-xs tracking-[0.15em] uppercase font-medium text-on-surface underline underline-offset-4"
          >
            Try Again
          </Link>
        </div>
      </section>
    );
  }

  return <LoadingIndicator />;
}
