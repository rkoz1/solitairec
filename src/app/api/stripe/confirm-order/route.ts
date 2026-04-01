import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";
import { getServerWixClient } from "@/lib/wix-server-client";
import {
  WIX_STORES_V1_APP_ID,
  WIX_STORES_V3_APP_ID,
  ZERO_VARIANT_ID,
} from "@/lib/cart";

export async function POST(request: Request) {
  try {
    const { paymentIntentId } = await request.json();

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId is required" },
        { status: 400 }
      );
    }

    // Verify payment succeeded
    const paymentIntent =
      await getStripeServer().paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment has not been completed" },
        { status: 400 }
      );
    }

    const {
      productId,
      selectedOptions: selectedOptionsStr,
      variantId,
      quantity: quantityStr,
      manageVariants: manageVariantsStr,
    } = paymentIntent.metadata;

    const selectedOptions = selectedOptionsStr
      ? JSON.parse(selectedOptionsStr)
      : {};
    const quantity = parseInt(quantityStr ?? "1", 10);
    const manageVariants = manageVariantsStr === "true";
    const hasOptions = Object.keys(selectedOptions).length > 0;

    // Build catalog reference (same logic as cart.ts)
    let appId: string;
    let options: { options: Record<string, string>; variantId: string } | undefined;

    if (!hasOptions) {
      appId = WIX_STORES_V1_APP_ID;
    } else if (manageVariants && variantId) {
      appId = WIX_STORES_V3_APP_ID;
      options = { options: selectedOptions, variantId };
    } else {
      appId = WIX_STORES_V3_APP_ID;
      options = { options: selectedOptions, variantId: ZERO_VARIANT_ID };
    }

    const wix = getServerWixClient();

    // Create a Wix checkout with the line item
    const checkoutResult = await wix.checkout.createCheckout({
      channelType: "WEB",
      lineItems: [
        {
          quantity,
          catalogReference: {
            catalogItemId: productId,
            appId,
            options: options as Record<string, unknown> | undefined,
          },
        },
      ],
    });

    const checkoutId = checkoutResult._id;
    if (!checkoutId) {
      return NextResponse.json(
        { error: "Failed to create Wix checkout" },
        { status: 500 }
      );
    }

    // Create a Wix order from the checkout
    const orderResult = await wix.checkout.createOrder(checkoutId);

    return NextResponse.json({
      orderId: orderResult.orderId,
      checkoutId,
    });
  } catch (error) {
    console.error("Error confirming order:", error);
    const message =
      error instanceof Error ? error.message : "Failed to confirm order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
