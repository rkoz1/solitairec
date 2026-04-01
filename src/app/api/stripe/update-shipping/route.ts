import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";

export async function POST(request: Request) {
  try {
    const { paymentIntentId, shippingAddress } = await request.json();

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId is required" },
        { status: 400 }
      );
    }

    // Retrieve the current PaymentIntent to get product amount
    const paymentIntent = await getStripeServer().paymentIntents.retrieve(paymentIntentId);
    const unitPrice = parseFloat(paymentIntent.metadata.unitPrice ?? "0");
    const quantity = parseInt(paymentIntent.metadata.quantity ?? "1", 10);
    const productAmount = Math.round(unitPrice * quantity * 100);

    // For now, use a flat shipping calculation.
    // TODO: integrate with Wix shippingOptions module for dynamic rates
    // based on shippingAddress.country
    const shippingOptions = [
      {
        id: "standard",
        label: "Standard Shipping",
        detail: "5-10 business days",
        amount: shippingAddress?.country === "HK" ? 0 : 5000, // Free for HK, 50 HKD otherwise
      },
      {
        id: "express",
        label: "Express Shipping",
        detail: "2-3 business days",
        amount: shippingAddress?.country === "HK" ? 3000 : 10000, // 30 HKD for HK, 100 HKD otherwise
      },
    ];

    // Default to the first (cheapest) option
    const defaultShipping = shippingOptions[0];
    const totalAmount = productAmount + defaultShipping.amount;

    // Update PaymentIntent with shipping-inclusive total
    await getStripeServer().paymentIntents.update(paymentIntentId, {
      amount: totalAmount,
      metadata: {
        ...paymentIntent.metadata,
        shippingMethod: defaultShipping.id,
        shippingAmount: String(defaultShipping.amount),
      },
    });

    return NextResponse.json({
      shippingOptions: shippingOptions.map((opt) => ({
        id: opt.id,
        label: opt.label,
        detail: opt.detail,
        amount: opt.amount,
      })),
      totalAmount,
    });
  } catch (error) {
    console.error("Error updating shipping:", error);
    return NextResponse.json(
      { error: "Failed to update shipping" },
      { status: 500 }
    );
  }
}
