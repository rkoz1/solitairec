"use client";

import { useRef, useCallback } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

interface PayPalCheckoutProps {
  productId: string;
  productName?: string;
  productPrice: string;
  selectedOptions: Record<string, string>;
  variantId?: string;
  manageVariants: boolean;
}

export default function PayPalCheckout(props: PayPalCheckoutProps) {
  const clientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  if (!clientId) return null;

  return (
    <PayPalScriptProvider
      options={{
        clientId,
        currency: "HKD",
        intent: "capture",
        disableFunding: "card,credit",
      }}
    >
      <PayPalButtonsInner {...props} />
    </PayPalScriptProvider>
  );
}

function PayPalButtonsInner({
  productId,
  selectedOptions,
  variantId,
}: PayPalCheckoutProps) {
  // Use refs so the PayPal callbacks always see the latest values
  const propsRef = useRef({ productId, selectedOptions, variantId });
  propsRef.current = { productId, selectedOptions, variantId };

  const createOrder = useCallback(async (): Promise<string> => {
    const { productId, selectedOptions, variantId } = propsRef.current;

    const res = await fetch("/api/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId,
        selectedOptions,
        variantId,
        quantity: 1,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create PayPal order");
    }

    const data = await res.json();
    return data.orderID;
  }, []);

  const onApprove = useCallback(async (data: { orderID: string }) => {
    const res = await fetch("/api/paypal/capture-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderID: data.orderID }),
    });

    if (res.ok) {
      const orderData = await res.json();
      sessionStorage.setItem("expressOrder", JSON.stringify(orderData));
      window.location.href = `/order-confirmation?source=express`;
    } else {
      // Payment captured but Wix order failed — still redirect
      window.location.href = `/order-confirmation?paypalOrder=${data.orderID}`;
    }
  }, []);

  return (
    <div className="mt-3 [&_iframe]:!rounded-none">
      <PayPalButtons
        style={{
          layout: "vertical",
          shape: "rect",
          label: "buynow",
          height: 52,
          color: "silver",
          tagline: false,
        }}
        fundingSource="paypal"
        createOrder={createOrder}
        onApprove={onApprove}
        onError={(err) => {
          console.error("PayPal error:", err);
        }}
      />
    </div>
  );
}
