import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";
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

    // Check stock
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
    const amountInCents = Math.round(price * quantity * 100);

    if (amountInCents <= 0) {
      return NextResponse.json(
        { error: "Invalid product price" },
        { status: 400 }
      );
    }

    const paymentIntent = await getStripeServer().paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      payment_method_types: ["card"],
      metadata: {
        productId,
        productName: product.name ?? "",
        productSlug: product.slug ?? "",
        selectedOptions: selectedOptions
          ? JSON.stringify(selectedOptions)
          : "",
        variantId: variantId ?? "",
        quantity: String(quantity),
        manageVariants: String(product.manageVariants ?? false),
        unitPrice: String(price),
        currency,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amountInCents,
      currency: currency.toLowerCase(),
    });
  } catch (error) {
    console.error("Error creating payment intent:", error);
    return NextResponse.json(
      { error: "Failed to create payment intent" },
      { status: 500 }
    );
  }
}
