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
          captures?: Array<{
            amount?: { value?: string; currency_code?: string };
          }>;
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

    // Extract payment and shipping details from PayPal
    const paypalShipping = capture.purchase_units[0]?.shipping;
    const paypalPayer = capture.payer;
    const paypalAddress = paypalShipping?.address;
    const capturedAmount =
      capture.purchase_units[0]?.payments?.captures?.[0]?.amount;
    const total = capturedAmount?.value ?? "0";
    const currency = capturedAmount?.currency_code ?? "HKD";

    const fullName = paypalShipping?.name?.full_name ?? "";
    const nameParts = fullName.split(" ");
    const firstName =
      nameParts[0] ?? paypalPayer?.name?.given_name ?? "";
    const lastName =
      nameParts.slice(1).join(" ") ||
      paypalPayer?.name?.surname ||
      "";

    // Fetch product name from Wix
    const wix = getServerWixClient();
    let productName = "Product";
    try {
      const { items } = await wix.products
        .queryProducts()
        .eq("_id", productId)
        .limit(1)
        .find();
      productName = items[0]?.name ?? "Product";
    } catch {
      // Continue with default name
    }

    // Create order directly via orders API
    const order = await wix.orders.createOrder(
      {
        channelInfo: { type: "WEB" },
        paymentStatus: "PAID",
        currency,
        lineItems: [
          {
            productName: { original: productName },
            catalogReference: {
              catalogItemId: productId,
              appId,
              options: catalogOptions as Record<string, unknown> | undefined,
            },
            quantity: 1,
            price: { amount: total },
            itemType: { preset: "PHYSICAL" },
            taxDetails: { taxRate: "0" },
          },
        ],
        priceSummary: {
          subtotal: { amount: total },
          shipping: { amount: "0" },
          total: { amount: total },
        },
        buyerInfo: {
          email: paypalPayer?.email_address ?? undefined,
        },
        billingInfo: {
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
            phone:
              paypalPayer?.phone?.phone_number?.national_number ?? null,
          },
        },
        shippingInfo: {
          title: "Standard Shipping",
          logistics: {
            shippingDestination: {
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
                phone:
                  paypalPayer?.phone?.phone_number?.national_number ??
                  null,
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

    // Add payment record and approve it to trigger order approval
    const payResult = await wix.orderTransactions.addPayments(order._id!, [
      {
        amount: { amount: total },
        regularPaymentDetails: { status: "APPROVED", offlinePayment: true },
      },
    ]);

    const paymentId = payResult.paymentsIds?.[0];
    if (paymentId) {
      await wix.orderTransactions.updatePaymentStatus(
        { orderId: order._id!, paymentId },
        { status: "APPROVED" }
      );
    }

    // Fetch the updated order to get the real order number
    const approvedOrder = await wix.orders.getOrder(order._id!);

    return NextResponse.json({
      orderId: approvedOrder._id,
      orderNumber: approvedOrder.number ?? 0,
      total: `HK$${total}`,
      itemCount: 1,
      status: approvedOrder.status ?? "APPROVED",
      date: new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });
  } catch (error) {
    console.error("Error capturing PayPal order:", error);
    const message =
      error instanceof Error ? error.message : "Failed to capture order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
