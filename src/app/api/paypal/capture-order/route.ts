import { NextResponse } from "next/server";
import { paypalRequest } from "@/lib/paypal";
import { getServerWixClient } from "@/lib/wix-server-client";
import {
  WIX_STORES_V1_APP_ID,
  WIX_STORES_V3_APP_ID,
  ZERO_VARIANT_ID,
} from "@/lib/cart";

export async function POST(request: Request) {
  try {
    const { orderID } = await request.json();

    if (!orderID) {
      return NextResponse.json(
        { error: "orderID is required" },
        { status: 400 }
      );
    }

    // Capture the PayPal order
    const captureResult = await paypalRequest(
      `/v2/checkout/orders/${orderID}/capture`,
      "POST"
    );

    const capture = captureResult as {
      status: string;
      payer?: {
        name?: { given_name?: string; surname?: string };
        email_address?: string;
        phone?: { phone_number?: { national_number?: string } };
      };
      purchase_units: Array<{
        custom_id?: string;
        shipping?: {
          name?: { full_name?: string };
          address?: {
            address_line_1?: string;
            address_line_2?: string;
            admin_area_1?: string;
            admin_area_2?: string;
            postal_code?: string;
            country_code?: string;
          };
        };
        payments?: {
          captures?: Array<{ amount?: { value?: string; currency_code?: string } }>;
        };
      }>;
    };

    if (capture.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Payment was not completed" },
        { status: 400 }
      );
    }

    // Extract product metadata from custom_id
    const customData = JSON.parse(
      capture.purchase_units[0]?.custom_id ?? "{}"
    );
    const {
      productId,
      selectedOptions = {},
      variantId,
      manageVariants,
    } = customData;

    const hasOptions = Object.keys(selectedOptions).length > 0;

    // Build catalog reference (same logic as cart.ts)
    let appId: string;
    let options:
      | { options: Record<string, string>; variantId: string }
      | undefined;

    if (!hasOptions) {
      appId = WIX_STORES_V1_APP_ID;
    } else if (manageVariants && variantId) {
      appId = WIX_STORES_V3_APP_ID;
      options = { options: selectedOptions, variantId };
    } else {
      appId = WIX_STORES_V3_APP_ID;
      options = { options: selectedOptions, variantId: ZERO_VARIANT_ID };
    }

    // Extract shipping and buyer info from PayPal
    const paypalShipping = capture.purchase_units[0]?.shipping;
    const paypalPayer = capture.payer;
    const paypalAddress = paypalShipping?.address;

    // Split full name into first/last
    const fullName = paypalShipping?.name?.full_name ?? "";
    const nameParts = fullName.split(" ");
    const firstName = nameParts[0] ?? paypalPayer?.name?.given_name ?? "";
    const lastName = nameParts.slice(1).join(" ") || paypalPayer?.name?.surname || "";

    const addressWithContact = {
      address: {
        country: paypalAddress?.country_code ?? null,
        subdivision: paypalAddress?.admin_area_1 ?? null,
        city: paypalAddress?.admin_area_2 ?? null,
        postalCode: paypalAddress?.postal_code ?? null,
        addressLine1: paypalAddress?.address_line_1 ?? null,
        addressLine2: paypalAddress?.address_line_2 ?? null,
      },
      contactDetails: {
        firstName,
        lastName,
        phone: paypalPayer?.phone?.phone_number?.national_number ?? null,
      },
    };

    // Create Wix order for fulfillment
    const wix = getServerWixClient();

    const checkoutResult = await wix.checkout.createCheckout({
      channelType: "WEB",
      lineItems: [
        {
          quantity: 1,
          catalogReference: {
            catalogItemId: productId,
            appId,
            options: options as Record<string, unknown> | undefined,
          },
        },
      ],
      checkoutInfo: {
        shippingInfo: {
          shippingDestination: addressWithContact,
        },
        billingInfo: addressWithContact,
        buyerInfo: {
          email: paypalPayer?.email_address ?? undefined,
        },
      },
    });

    const checkoutId = checkoutResult._id;
    if (!checkoutId) {
      return NextResponse.json(
        { error: "Failed to create Wix checkout" },
        { status: 500 }
      );
    }

    const orderResult = await wix.checkout.createOrder(checkoutId);

    return NextResponse.json({
      orderId: orderResult.orderId,
      paypalOrderId: orderID,
    });
  } catch (error) {
    console.error("Error capturing PayPal order:", error);
    const message =
      error instanceof Error ? error.message : "Failed to capture order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
