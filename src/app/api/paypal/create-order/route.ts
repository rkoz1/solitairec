import { NextResponse } from "next/server";
import { paypalRequest } from "@/lib/paypal";
import { getServerWixClient } from "@/lib/wix-server-client";

export async function POST(request: Request) {
  try {
    const { productId, selectedOptions, variantId, quantity = 1 } =
      await request.json();

    if (!productId) {
      return NextResponse.json(
        { error: "productId is required" },
        { status: 400 }
      );
    }

    // Fetch authoritative product price from Wix
    const wix = getServerWixClient();
    const { items } = await wix.products
      .queryProducts()
      .eq("_id", productId)
      .limit(1)
      .find();

    const product = items[0];
    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const stockStatus = (
      product.stock as { inventoryStatus?: string } | undefined
    )?.inventoryStatus;
    if (stockStatus === "OUT_OF_STOCK") {
      return NextResponse.json(
        { error: "Product is out of stock" },
        { status: 400 }
      );
    }

    const price = product.priceData?.price ?? 0;
    const currency = product.priceData?.currency ?? "HKD";
    const totalAmount = (price * quantity).toFixed(2);

    const order = await paypalRequest("/v2/checkout/orders", "POST", {
      intent: "CAPTURE",
      purchase_units: [
        {
          description: product.name ?? "Product",
          amount: {
            currency_code: currency,
            value: totalAmount,
            breakdown: {
              item_total: {
                currency_code: currency,
                value: totalAmount,
              },
            },
          },
          items: [
            {
              name: product.name ?? "Product",
              quantity: String(quantity),
              unit_amount: {
                currency_code: currency,
                value: price.toFixed(2),
              },
            },
          ],
          custom_id: JSON.stringify({
            productId,
            selectedOptions: selectedOptions ?? {},
            variantId: variantId ?? "",
            manageVariants: product.manageVariants ?? false,
          }),
        },
      ],
      application_context: {
        shipping_preference: "GET_FROM_FILE",
      },
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            user_action: "PAY_NOW",
            brand_name: "SOLITAIREC",
          },
        },
      },
    });

    const orderData = order as { id: string };
    return NextResponse.json({ orderID: orderData.id });
  } catch (error) {
    console.error("Error creating PayPal order:", error);
    return NextResponse.json(
      { error: "Failed to create PayPal order" },
      { status: 500 }
    );
  }
}
