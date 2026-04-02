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
          setProcessing(false);
          return;
        }

        // Payment succeeded — create order in Wix
        const orderRes = await fetch("/api/stripe/confirm-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentIntentId }),
        });

        if (orderRes.ok) {
          const { orderId } = await orderRes.json();
          window.location.href = `/order-confirmation?orderId=${orderId}`;
        } else {
          // Payment succeeded but order creation failed — still show confirmation
          window.location.href = `/order-confirmation?stripePayment=${paymentIntentId}`;
        }
      } catch (err) {
        console.error("Express checkout error:", err);
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
            googlePay: "always",
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
