"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Elements,
  ExpressCheckoutElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import type {
  StripeExpressCheckoutElementClickEvent,
  StripeExpressCheckoutElementConfirmEvent,
  StripeExpressCheckoutElementReadyEvent,
  StripeExpressCheckoutElementShippingAddressChangeEvent,
  StripeExpressCheckoutElementShippingRateChangeEvent,
} from "@stripe/stripe-js";
import { getStripe } from "@/lib/stripe-client";
import { getBrowserWixClient, ensureVisitorTokens } from "@/lib/wix-browser-client";
import { trackMetaEvent } from "@/lib/meta-track";
import { trackEvent, generateEventId } from "@/lib/meta-pixel";
import { trackAnalytics } from "@/lib/analytics";
import { showToast } from "@/lib/toast";

interface ExpressCheckoutProps {
  productId: string;
  productName?: string;
  productPrice: string;
  selectedOptions: Record<string, string>;
  variantId?: string;
  manageVariants: boolean;
}

export default function ExpressCheckout(props: ExpressCheckoutProps) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Stabilize selectedOptions to avoid infinite useEffect loops
  const optionsKey = JSON.stringify(props.selectedOptions);
  const optionsRef = useRef(props.selectedOptions);
  if (JSON.stringify(optionsRef.current) !== optionsKey) {
    optionsRef.current = props.selectedOptions;
  }

  // Create PaymentIntent when component mounts or variant changes
  useEffect(() => {
    let cancelled = false;

    async function createIntent() {
      setError(null);
      setClientSecret(null);
      setPaymentIntentId(null);

      try {
        const res = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: props.productId,
            selectedOptions: optionsRef.current,
            variantId: props.variantId,
            quantity: 1,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to initialize payment");
        }

        const data = await res.json();
        if (!cancelled) {
          setClientSecret(data.clientSecret);
          setPaymentIntentId(data.paymentIntentId);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to initialize payment"
          );
        }
      }
    }

    createIntent();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.productId, optionsKey, props.variantId]);

  if (error || !clientSecret || !paymentIntentId) return null;

  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret,
        appearance: {
          theme: "flat",
          variables: {
            borderRadius: "0px",
            fontFamily: "Inter, sans-serif",
          },
        },
      }}
      key={clientSecret}
    >
      <ExpressCheckoutInner paymentIntentId={paymentIntentId} />
    </Elements>
  );
}

function ExpressCheckoutInner({
  paymentIntentId,
}: {
  paymentIntentId: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);


  const onClick = useCallback(
    (event: StripeExpressCheckoutElementClickEvent) => {
      trackMetaEvent("InitiateCheckout", { currency: "HKD" });
      trackAnalytics("express_checkout_click", {
        payment_method: "wallet",
      });
      event.resolve({
        emailRequired: true,
        shippingAddressRequired: true,
        allowedShippingCountries: [
          "HK", "US", "GB", "AU", "CA", "JP", "KR", "SG", "TW",
          "DE", "FR", "IT", "ES", "NL", "BE", "AT", "CH", "SE",
          "DK", "NO", "FI", "IE", "PT", "PL", "CZ", "NZ",
        ],
      });
    },
    []
  );

  const onReady = useCallback(
    ({ availablePaymentMethods }: StripeExpressCheckoutElementReadyEvent) => {
      if (availablePaymentMethods) {
        // Only show for Apple Pay or Google Pay — not Link
        const hasWallet =
          availablePaymentMethods.applePay || availablePaymentMethods.googlePay;
        setReady(!!hasWallet);
      }
    },
    []
  );

  const onShippingAddressChange = useCallback(
    async (
      event: StripeExpressCheckoutElementShippingAddressChangeEvent
    ) => {
      try {
        const res = await fetch("/api/stripe/update-shipping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            paymentIntentId,
            shippingAddress: event.address,
          }),
        });

        if (!res.ok) {
          event.reject();
          return;
        }

        const data = await res.json();
        event.resolve({
          shippingRates: data.shippingOptions.map(
            (opt: {
              id: string;
              label: string;
              detail: string;
              amount: number;
            }) => ({
              id: opt.id,
              displayName: opt.label,
              amount: opt.amount,
            })
          ),
        });
      } catch {
        event.reject();
      }
    },
    [paymentIntentId]
  );

  const onShippingRateChange = useCallback(
    async (event: StripeExpressCheckoutElementShippingRateChangeEvent) => {
      // Accept the selected shipping rate
      event.resolve();
    },
    []
  );

  const onConfirm = useCallback(
    async (_event: StripeExpressCheckoutElementConfirmEvent) => {
      if (!stripe || !elements) return;

      setProcessing(true);

      try {
        const { error: confirmError } = await stripe.confirmPayment({
          elements,
          redirect: "if_required",
        });

        if (confirmError) {
          console.error("Payment failed:", confirmError.message);
          showToast(confirmError.message ?? "Payment failed. Please try again.", "error");
          setProcessing(false);
          return;
        }

        // Get Wix visitor/member ID to associate order with this session
        let wixVisitorId: string | undefined;
        let wixMemberId: string | undefined;
        try {
          const wixClient = getBrowserWixClient();
          await ensureVisitorTokens(wixClient);
          const member = await wixClient.members.getCurrentMember({ fieldsets: ["FULL"] }).catch(() => null);
          const memberData = member as { member?: { _id?: string } } | null;
          if (memberData?.member?._id) {
            wixMemberId = memberData.member._id;
          } else {
            // Extract visitor ID from tokens
            const tokens = wixClient.auth.getTokens();
            const accessToken = tokens.accessToken?.value;
            if (accessToken) {
              try {
                const payload = JSON.parse(atob(accessToken.split(".")[1]));
                wixVisitorId = payload.sub;
              } catch { /* ignore */ }
            }
          }
        } catch { /* ignore - order will still be created */ }

        // Payment succeeded — create order in Wix
        const eventId = generateEventId();
        const orderRes = await fetch("/api/stripe/confirm-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId, wixVisitorId, wixMemberId, metaEventId: eventId, eventSourceUrl: window.location.href }),
        });

        if (orderRes.ok) {
          const orderData = await orderRes.json();
          trackEvent("Purchase", {
            value: parseFloat(orderData.total?.replace(/[^0-9.]/g, "") || "0"),
            currency: "HKD",
            content_ids: [paymentIntentId],
            order_id: String(orderData.orderNumber),
          }, eventId);
          sessionStorage.setItem("expressOrder", JSON.stringify(orderData));
          window.location.href = `/order-confirmation?source=express`;
        } else {
          // Payment succeeded but order creation failed
          const errData = await orderRes.json().catch(() => ({}));
          console.error("Order creation failed:", errData);
          showToast("Your payment was processed but we had trouble creating your order. Please contact us and we'll sort it out.", "error");
        }
      } catch (err) {
        console.error("Express checkout error:", err);
        showToast("Something went wrong during checkout. Please try again.", "error");
      } finally {
        setProcessing(false);
      }
    },
    [stripe, elements, paymentIntentId]
  );

  return (
    <div className={`mt-4 ${ready ? "" : "hidden"}`}>
      <div className="flex items-center gap-4 my-4">
        <div className="flex-1 h-px bg-outline-variant/30" />
        <span className="text-[10px] tracking-[0.25em] uppercase text-on-surface-variant">
          or
        </span>
        <div className="flex-1 h-px bg-outline-variant/30" />
      </div>

      <ExpressCheckoutElement
        onClick={onClick}
        onReady={onReady}
        onConfirm={onConfirm}
        onShippingAddressChange={onShippingAddressChange}
        onShippingRateChange={onShippingRateChange}
        options={{
          buttonType: {
            applePay: "buy",
            googlePay: "buy",
          },
          paymentMethods: {
            paypal: "never",
            link: "never",
          },
          wallets: {
            applePay: "always",
            googlePay: "auto",
          },
          buttonHeight: 52,
          layout: {
            maxColumns: 1,
            maxRows: 3,
          },
        }}
      />

      {processing && (
        <p className="mt-2 text-[10px] tracking-[0.15em] text-on-surface-variant text-center">
          Processing your order...
        </p>
      )}
    </div>
  );
}
