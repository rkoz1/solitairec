"use client";

import { useState } from "react";
import Image from "next/image";
import {
  getBrowserWixClient,
  ensureVisitorTokens,
} from "@/lib/wix-browser-client";

const GIFT_CARD_APP_ID = "d80111c5-a0f4-47a8-b63a-65b54d774a27";
const GIFT_CARD_PRODUCT_ID = "4d374f36-761a-4189-84f7-11de05394dbf";

const GIFT_CARD_IMAGE =
  "https://static.wixstatic.com/media/06e64d_68624605f52a417bb71651bb4a50dc70~mv2.png";

const VARIANTS = [
  {
    id: "8deb164b-8835-4376-82b4-4699507a22d9",
    amount: 2000,
    label: "HK$2,000",
    bonusCredits: 100,
    bonusTotal: 2100,
  },
  {
    id: "b13d8f03-86c8-4753-9a7d-0fe874d49ecf",
    amount: 3000,
    label: "HK$3,000",
    bonusCredits: 200,
    bonusTotal: 3200,
  },
  {
    id: "424dde37-f103-4b2c-b1dd-dcec85e1887a",
    amount: 5000,
    label: "HK$5,000",
    bonusCredits: 400,
    bonusTotal: 5400,
  },
];

type Variant = (typeof VARIANTS)[number];

type RecipientType = "someone_else" | "myself";

export default function GiftCardForm() {
  const [selectedVariant, setSelectedVariant] = useState<Variant>(VARIANTS[0]);
  const [quantity, setQuantity] = useState(1);
  const [recipientType, setRecipientType] =
    useState<RecipientType>("someone_else");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState(false);

  async function addToCart(buyNow = false) {
    if (recipientType === "someone_else" && !recipientEmail.trim()) {
      alert("Please enter the recipient's email address.");
      return;
    }

    setLoading(true);
    try {
      const wix = getBrowserWixClient();
      await ensureVisitorTokens(wix);

      const nameParts = recipientName.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      await wix.currentCart.addToCurrentCart({
        lineItems: [
          {
            quantity,
            catalogReference: {
              appId: GIFT_CARD_APP_ID,
              catalogItemId: GIFT_CARD_PRODUCT_ID,
              options: {
                quantity,
                currency: "HKD",
                variantId: selectedVariant.id,
                giftingInfo:
                  recipientType === "someone_else"
                    ? {
                        recipientInfo: {
                          firstName,
                          lastName,
                          email: recipientEmail.trim(),
                        },
                      }
                    : undefined,
                wixGiftCardsAppNewCatalog: true,
              } as Record<string, unknown>,
            },
          },
        ],
      });

      window.dispatchEvent(new Event("cart-updated"));

      // Fly-to-cart animation
      const imgEl = document.querySelector("[data-gift-card-image]");
      const rect = imgEl?.getBoundingClientRect();
      window.dispatchEvent(
        new CustomEvent("cart-item-added", {
          detail: {
            imageUrl: GIFT_CARD_IMAGE,
            sourceX: rect
              ? rect.left + rect.width / 2
              : window.innerWidth / 2,
            sourceY: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
            productName: "Credits for More",
          },
        })
      );

      if (buyNow) {
        // Redirect to checkout
        const result =
          await wix.currentCart.createCheckoutFromCurrentCart({
            channelType: "WEB",
          });
        const checkoutId = result.checkoutId;
        if (!checkoutId) throw new Error("No checkout ID returned");

        const { redirectSession } =
          await wix.redirects.createRedirectSession({
            ecomCheckout: { checkoutId },
            callbacks: {
              thankYouPageUrl: `${window.location.origin}/order-confirmation`,
              postFlowUrl: `${window.location.origin}/gift-cards`,
            },
          });

        const redirectUrl = redirectSession?.fullUrl;
        if (!redirectUrl) throw new Error("No redirect URL returned");
        window.location.href = redirectUrl;
        return;
      }

      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (error) {
      console.error("Failed to add gift card to cart:", error);
      alert("Failed to add to cart. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pb-28">
      {/* Gift card image */}
      <div
        className="relative aspect-[1748/1240] bg-surface-container-low mb-8"
        data-gift-card-image
      >
        <Image
          src={GIFT_CARD_IMAGE}
          alt="SolitaireC Gift Card"
          fill
          className="object-cover"
          sizes="(max-width: 672px) 100vw, 672px"
          priority
        />
      </div>

      {/* Title + price */}
      <h2 className="font-serif italic text-xl tracking-tight text-on-surface">
        Credits for More
      </h2>
      <p className="mt-2 text-2xl font-serif tracking-tight text-on-surface">
        {selectedVariant.label}
      </p>

      {/* Bonus credits info */}
      <div className="mt-4 space-y-1">
        {VARIANTS.map((v) => (
          <p
            key={v.id}
            className="text-xs tracking-wide text-on-surface-variant"
          >
            <span className="text-secondary">
              HKD{v.amount.toLocaleString()} + {v.bonusCredits} credits
            </span>{" "}
            = HKD{v.bonusTotal.toLocaleString()}
          </p>
        ))}
        <p className="text-xs tracking-wide text-on-surface-variant mt-2">
          *Valid for 12 months *Extra Credits Code will be emailed to you after
          gift card purchase
        </p>
      </div>

      {/* Amount selection */}
      <div className="mt-8">
        <label className="text-[11px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
          Gift Card Amount
        </label>
        <div className="flex gap-3 mt-3">
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setSelectedVariant(v)}
              className={`px-5 py-3 text-xs tracking-wider font-medium transition-colors ${
                selectedVariant.id === v.id
                  ? "bg-on-surface text-on-primary"
                  : "bg-transparent text-on-surface border border-outline-variant/30 hover:border-on-surface"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div className="mt-8">
        <label className="text-[11px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
          Quantity
        </label>
        <div className="flex items-center gap-0 mt-3 w-fit border border-outline-variant/30">
          <button
            type="button"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="w-11 h-11 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">
              remove
            </span>
          </button>
          <span className="w-10 text-center text-sm font-medium text-on-surface">
            {quantity}
          </span>
          <button
            type="button"
            onClick={() => setQuantity(quantity + 1)}
            className="w-11 h-11 flex items-center justify-center text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>
      </div>

      {/* Recipient toggle */}
      <div className="mt-8">
        <label className="text-[11px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
          Who&apos;s the credit purchase for?
        </label>
        <div className="flex gap-3 mt-3">
          <button
            type="button"
            onClick={() => setRecipientType("someone_else")}
            className={`flex-1 py-3 text-xs tracking-wider font-medium transition-colors ${
              recipientType === "someone_else"
                ? "bg-on-surface text-on-primary"
                : "bg-transparent text-on-surface border border-outline-variant/30 hover:border-on-surface"
            }`}
          >
            For someone else
          </button>
          <button
            type="button"
            onClick={() => setRecipientType("myself")}
            className={`flex-1 py-3 text-xs tracking-wider font-medium transition-colors ${
              recipientType === "myself"
                ? "bg-on-surface text-on-primary"
                : "bg-transparent text-on-surface border border-outline-variant/30 hover:border-on-surface"
            }`}
          >
            For myself
          </button>
        </div>
      </div>

      {/* Recipient fields */}
      {recipientType === "someone_else" && (
        <div className="mt-8 space-y-6">
          <div>
            <label className="text-[11px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
              Recipient email *
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              required
              className="w-full mt-2 px-4 py-3 bg-surface-container-low text-sm text-on-surface outline-none focus:ring-1 focus:ring-secondary"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="text-[11px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
              Recipient name
            </label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full mt-2 px-4 py-3 bg-surface-container-low text-sm text-on-surface outline-none focus:ring-1 focus:ring-secondary"
              placeholder="Name"
            />
          </div>
        </div>
      )}

      {/* Message */}
      <div className="mt-8">
        <label className="text-[11px] tracking-[0.2em] uppercase font-medium text-on-surface-variant">
          {recipientType === "someone_else"
            ? "Message to recipient"
            : "Personal note"}
        </label>
        <p className="mt-1 text-[10px] tracking-wide text-on-surface-variant/70">
          Gift card expires 12 months after purchase.
        </p>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full mt-2 px-4 py-3 bg-surface-container-low text-sm text-on-surface outline-none focus:ring-1 focus:ring-secondary resize-none"
          placeholder={
            recipientType === "someone_else"
              ? "Add a personal message..."
              : "Add a note..."
          }
        />
      </div>

      {/* Action buttons */}
      <div className="mt-10 space-y-3">
        <button
          onClick={() => addToCart(false)}
          disabled={loading}
          className="w-full bg-on-surface text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {loading
            ? "Adding..."
            : added
              ? "Added to Bag!"
              : "Add to Bag"}
        </button>
        <button
          onClick={() => addToCart(true)}
          disabled={loading}
          className="w-full bg-secondary text-on-primary py-5 text-xs tracking-[0.25em] font-bold uppercase transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "Processing..." : "Buy Now"}
        </button>
      </div>
    </div>
  );
}
