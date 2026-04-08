"use client";

import { useRef, useCallback } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { getBrowserWixClient } from "@/lib/wix-browser-client";
import { useMember } from "@/contexts/MemberContext";
import { trackMetaEvent } from "@/lib/meta-track";
import { trackEvent, generateEventId } from "@/lib/meta-pixel";
import { trackAnalytics, parseWixTokenUid } from "@/lib/analytics";
import { showToast } from "@/lib/toast";
import { clarityEvent } from "@/lib/clarity";

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
  const { member: ctxMember } = useMember();
  const memberRef = useRef(ctxMember);
  memberRef.current = ctxMember;

  // Use refs so the PayPal callbacks always see the latest values
  const propsRef = useRef({ productId, selectedOptions, variantId });
  propsRef.current = { productId, selectedOptions, variantId };

  const createOrder = useCallback(async (): Promise<string> => {
    const { productId, selectedOptions, variantId } = propsRef.current;

    trackMetaEvent("InitiateCheckout", {
      currency: "HKD",
      content_ids: [productId],
      content_type: "product",
      num_items: 1,
    });
    trackAnalytics("paypal_checkout_click", { product_id: productId });
    clarityEvent("initiate_checkout");

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
    // Payment approved by PayPal
    trackMetaEvent("AddPaymentInfo", {
      currency: "HKD",
      content_ids: [propsRef.current.productId],
      content_type: "product",
    });

    // Get Wix visitor/member ID to associate order with this session
    let wixVisitorId: string | undefined;
    let wixMemberId: string | undefined;
    try {
      const currentMember = memberRef.current;
      if (currentMember?._id) {
        wixMemberId = currentMember._id;
      } else {
        const wixClient = getBrowserWixClient();
        const tokens = wixClient.auth.getTokens();
        const uid = tokens.accessToken?.value
          ? parseWixTokenUid(tokens.accessToken.value)
          : null;
        if (uid) wixVisitorId = uid;
      }
    } catch { /* ignore */ }

    const eventId = generateEventId();
    const res = await fetch("/api/paypal/capture-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderID: data.orderID, wixVisitorId, wixMemberId, metaEventId: eventId, eventSourceUrl: window.location.href }),
    });

    if (res.ok) {
      const orderData = await res.json();
      trackEvent("Purchase", {
        value: parseFloat(orderData.total?.replace(/[^0-9.]/g, "") || "0"),
        currency: "HKD",
        content_ids: [propsRef.current.productId],
        content_type: "product",
        order_id: String(orderData.orderNumber),
      }, eventId);
      sessionStorage.setItem("expressOrder", JSON.stringify(orderData));
      window.location.href = `/order-confirmation?source=express`;
    } else {
      // Payment captured but Wix order failed
      const errData = await res.json().catch(() => ({}));
      console.error("PayPal order creation failed:", errData);
      showToast("Your payment was processed but we had trouble creating your order. Please contact us and we'll sort it out.", "error");
    }
  }, []);

  return (
    <div className="relative mt-3 [&_iframe]:!rounded-none" style={{ zIndex: 1 }}>
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
          showToast("PayPal payment failed. Please try again or use another payment method.", "error");
        }}
      />
    </div>
  );
}
