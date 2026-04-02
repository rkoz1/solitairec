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

    // Verify payment succeeded and get shipping details
    const paymentIntent =
      await getStripeServer().paymentIntents.retrieve(paymentIntentId, {
        expand: ["latest_charge"],
      });

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

    // Extract shipping and billing from Stripe
    const shipping = paymentIntent.shipping;
    const charge = paymentIntent.latest_charge;
    const billingDetails = typeof charge === "object" && charge !== null
      ? (charge as { billing_details?: { name?: string; email?: string; phone?: string; address?: { line1?: string; line2?: string; city?: string; state?: string; postal_code?: string; country?: string } } }).billing_details
      : undefined;

    const shippingName = shipping?.name ?? billingDetails?.name ?? "";
    const shippingNameParts = shippingName.split(" ");
    const firstName = shippingNameParts[0] ?? "";
    const lastName = shippingNameParts.slice(1).join(" ") || "";

    const shippingAddr = shipping?.address ?? billingDetails?.address;
    const addressWithContact = shippingAddr ? {
      address: {
        country: shippingAddr.country ?? null,
        subdivision: shippingAddr.state ?? null,
        city: shippingAddr.city ?? null,
        postalCode: shippingAddr.postal_code ?? null,
        addressLine1: shippingAddr.line1 ?? null,
        addressLine2: shippingAddr.line2 ?? null,
      },
      contactDetails: {
        firstName,
        lastName,
        phone: billingDetails?.phone ?? null,
      },
    } : undefined;

    const wix = getServerWixClient();

    // Create a Wix checkout with the line item and delivery info
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
      ...(addressWithContact ? {
        checkoutInfo: {
          shippingInfo: {
            shippingDestination: addressWithContact,
          },
          billingInfo: addressWithContact,
          buyerInfo: {
            email: billingDetails?.email ?? undefined,
          },
        },
      } : {}),
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
