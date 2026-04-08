import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { sendCapiEvent } from "@/lib/meta-capi";
import { getServerWixClient } from "@/lib/wix-server-client";

const WEBHOOK_SECRET = process.env.WIX_WEBHOOK_SECRET;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

/**
 * Wix Automation webhook for "Order placed".
 *
 * Receives minimal data from Wix Automation (just orderNumber),
 * fetches the full order from Wix API, then fires server-side
 * Meta CAPI Purchase + WixOrderPlaced events.
 *
 * Uses a deterministic eventId derived from the order ID so that
 * if the client-side order-confirmation page also fires Purchase,
 * Meta deduplicates them (same event_name + event_id within 48h).
 *
 * Auth: shared secret in query param `?secret=<WIX_WEBHOOK_SECRET>`.
 *
 * Wix Automation config:
 *   Trigger: "Order placed"
 *   Action:  "Send HTTP request"
 *   Method:  POST
 *   URL:     https://solitairec.com/api/webhooks/wix-order?secret=<SECRET>
 *   Body params:
 *     Key: orderNumber   Value: (Order placed > Order number)
 */
export async function POST(request: Request) {
  // Validate shared secret
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  if (!WEBHOOK_SECRET || secret !== WEBHOOK_SECRET) {
    console.error("[wix-order webhook] Invalid or missing secret");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const orderNumber = body.orderNumber ?? body.data?.orderNumber;

    if (!orderNumber) {
      console.error("[wix-order webhook] No orderNumber in payload:", body);
      return NextResponse.json({ error: "Missing orderNumber" }, { status: 400 });
    }

    console.log(`[wix-order webhook] Received order #${orderNumber}`);

    // Fetch full order from Wix API (same pattern as Stripe/PayPal routes)
    const wix = getServerWixClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (wix.orders as any).searchOrders({
      search: {
        filter: { "number": { "$eq": parseInt(orderNumber, 10) } },
      },
    });
    const order = result.orders?.[0];

    if (!order?._id) {
      console.error(`[wix-order webhook] Order #${orderNumber} not found in Wix`);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Extract order data
    const totalAmount = parseFloat(
      (order.priceSummary?.total?.amount ?? "0").toString().replace(/[^0-9.]/g, "")
    );
    const currency = order.currency ?? "HKD";
    const lineItems = order.lineItems ?? [];
    const numItems = lineItems.length;
    const contentIds = lineItems
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((li: any) => li.catalogReference?.catalogItemId)
      .filter(Boolean) as string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contentName = (lineItems as any)[0]?.productName?.original ?? "Product";

    // Buyer data for Meta matching — extract as much as possible for EMQ
    const buyerEmail = order.buyerInfo?.email;
    const buyerExternalId =
      order.buyerInfo?.memberId ?? order.buyerInfo?.visitorId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const billing = (order as any).billingInfo;
    const billingContact = billing?.contactDetails ?? billing?.address?.contactDetails;
    const billingAddress = billing?.address ?? billing?.address?.address;
    const buyerFirstName = billingContact?.firstName ?? undefined;
    const buyerLastName = billingContact?.lastName ?? undefined;
    const buyerPhone = billingContact?.phone ?? undefined;

    // Deterministic eventId — must match what order-confirmation page uses
    const purchaseEventId = createHash("sha256")
      .update("purchase-" + order._id)
      .digest("hex")
      .slice(0, 36);

    const eventData = {
      value: totalAmount,
      currency,
      contentIds,
      contentName,
      contentType: "product",
      orderId: orderNumber.toString(),
      numItems,
    };

    const userData = {
      email: buyerEmail,
      externalId: buyerExternalId,
      firstName: buyerFirstName,
      lastName: buyerLastName,
      phone: buyerPhone,
    };

    const eventSourceUrl = `${SITE_URL}/order-confirmation`;

    if (totalAmount > 0) {
      // Fire Purchase CAPI
      sendCapiEvent(
        "Purchase",
        purchaseEventId,
        eventData,
        userData,
        eventSourceUrl
      ).catch((err) =>
        console.error("[wix-order webhook] Purchase CAPI error:", err)
      );

      // Fire WixOrderPlaced CAPI (restores dead event from Wix native pixel)
      const wixEventId = createHash("sha256")
        .update("wix-order-placed-" + order._id)
        .digest("hex")
        .slice(0, 36);

      sendCapiEvent(
        "WixOrderPlaced",
        wixEventId,
        eventData,
        userData,
        eventSourceUrl
      ).catch((err) =>
        console.error("[wix-order webhook] WixOrderPlaced CAPI error:", err)
      );

      console.log(
        `[wix-order webhook] Fired Purchase + WixOrderPlaced for order #${orderNumber} (${currency} ${totalAmount})`
      );
    } else {
      console.warn(
        `[wix-order webhook] Skipped — zero total for order #${orderNumber}`
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[wix-order webhook] Error processing:", err);
    return NextResponse.json(
      { error: "Failed to process webhook" },
      { status: 500 }
    );
  }
}
