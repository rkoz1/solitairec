import { NextResponse } from "next/server";
import { getStripeServer } from "@/lib/stripe";
import { getShippingRegions } from "@/app/actions";
import { getRegionForCountry } from "@/lib/shipping-regions";

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
    const productTotal = unitPrice * quantity;
    const productAmountCents = Math.round(productTotal * 100);

    // Look up real shipping rates from Wix
    const regionData = await getShippingRegions();
    const country = shippingAddress?.country ?? "HK";
    const region = getRegionForCountry(country, regionData);

    // Compare the single product total against the free shipping threshold
    const qualifiesForFreeShipping =
      region.freeThreshold > 0 && productTotal > region.freeThreshold;

    const shippingCostCents = qualifiesForFreeShipping
      ? 0
      : Math.round(region.shippingCost * 100);

    const shippingOptions = [
      {
        id: "standard",
        label: qualifiesForFreeShipping
          ? "Free Shipping"
          : `Standard Shipping (${region.name})`,
        detail: region.estimatedDelivery,
        amount: shippingCostCents,
      },
    ];

    const defaultShipping = shippingOptions[0];
    const totalAmount = productAmountCents + defaultShipping.amount;

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
