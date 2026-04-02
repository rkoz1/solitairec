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
    const paymentIntent = await getStripeServer().paymentIntents.retrieve(
      paymentIntentId,
      { expand: ["latest_charge"] }
    );

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Payment has not been completed" },
        { status: 400 }
      );
    }

    const {
      productId,
      productName: metaProductName,
      selectedOptions: selectedOptionsStr,
      variantId,
      quantity: quantityStr,
      manageVariants: manageVariantsStr,
      unitPrice,
      currency: metaCurrency,
      shippingAmount: shippingAmountStr,
    } = paymentIntent.metadata;

    const selectedOptions = selectedOptionsStr
      ? JSON.parse(selectedOptionsStr)
      : {};
    const quantity = parseInt(quantityStr ?? "1", 10);
    const manageVariants = manageVariantsStr === "true";
    const hasOptions = Object.keys(selectedOptions).length > 0;
    const price = parseFloat(unitPrice ?? "0");
    const currency = metaCurrency ?? "HKD";
    const shippingAmount = shippingAmountStr
      ? (parseInt(shippingAmountStr, 10) / 100).toFixed(2)
      : "0";
    const subtotal = (price * quantity).toFixed(2);
    const total = (
      parseFloat(subtotal) + parseFloat(shippingAmount)
    ).toFixed(2);

    // Build catalog reference
    let appId: string;
    let catalogOptions:
      | { options: Record<string, string>; variantId: string }
      | undefined;

    if (!hasOptions) {
      appId = WIX_STORES_V1_APP_ID;
    } else if (manageVariants && variantId) {
      appId = WIX_STORES_V3_APP_ID;
      catalogOptions = { options: selectedOptions, variantId };
    } else {
      appId = WIX_STORES_V3_APP_ID;
      catalogOptions = {
        options: selectedOptions,
        variantId: ZERO_VARIANT_ID,
      };
    }

    // Extract shipping and billing from Stripe
    const shipping = paymentIntent.shipping;
    const charge = paymentIntent.latest_charge;
    const billingDetails =
      typeof charge === "object" && charge !== null
        ? (
            charge as {
              billing_details?: {
                name?: string;
                email?: string;
                phone?: string;
                address?: {
                  line1?: string;
                  line2?: string;
                  city?: string;
                  state?: string;
                  postal_code?: string;
                  country?: string;
                };
              };
            }
          ).billing_details
        : undefined;

    const shippingName = shipping?.name ?? billingDetails?.name ?? "";
    const nameParts = shippingName.split(" ");
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || "";
    const shippingAddr = shipping?.address ?? billingDetails?.address;

    const wix = getServerWixClient();

    // Create order directly via orders API (not checkout)
    const order = await wix.orders.createOrder(
      {
        channelInfo: { type: "WEB" },
        paymentStatus: "PAID",
        currency,
        lineItems: [
          {
            productName: { original: metaProductName || "Product" },
            catalogReference: {
              catalogItemId: productId,
              appId,
              options: catalogOptions as Record<string, unknown> | undefined,
            },
            quantity,
            price: { amount: String(price) },
            itemType: { preset: "PHYSICAL" },
            taxDetails: { taxRate: "0" },
          },
        ],
        priceSummary: {
          subtotal: { amount: subtotal },
          shipping: { amount: shippingAmount },
          total: { amount: total },
        },
        buyerInfo: {
          email: billingDetails?.email ?? undefined,
        },
        billingInfo: {
          address: {
            country: shippingAddr?.country ?? null,
            subdivision: shippingAddr?.state ?? null,
            city: shippingAddr?.city ?? null,
            postalCode: shippingAddr?.postal_code ?? null,
            addressLine1: shippingAddr?.line1 ?? null,
            addressLine2: shippingAddr?.line2 ?? null,
          },
          contactDetails: {
            firstName,
            lastName,
            phone: billingDetails?.phone ?? null,
          },
        },
        shippingInfo: {
          title: "Standard Shipping",
          logistics: {
            shippingDestination: {
              address: {
                country: shippingAddr?.country ?? null,
                subdivision: shippingAddr?.state ?? null,
                city: shippingAddr?.city ?? null,
                postalCode: shippingAddr?.postal_code ?? null,
                addressLine1: shippingAddr?.line1 ?? null,
                addressLine2: shippingAddr?.line2 ?? null,
              },
              contactDetails: {
                firstName,
                lastName,
                phone: billingDetails?.phone ?? null,
              },
            },
          },
        },
      },
      {
        settings: {
          orderApprovalStrategy: "PAYMENT_RECEIVED",
        },
      }
    );

    return NextResponse.json({
      orderId: order._id,
      orderNumber: order.number ?? 0,
      total: `HK$${total}`,
      itemCount: quantity,
      status: order.status ?? "APPROVED",
      date: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });
  } catch (error) {
    console.error("Error confirming order:", error);
    const message =
      error instanceof Error ? error.message : "Failed to confirm order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
