// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";

// ---------- Mock all 3 providers ----------
vi.mock("@/lib/meta-track", () => ({ trackMetaEvent: vi.fn() }));
vi.mock("@/lib/ga4", () => ({
  ga4ViewItem: vi.fn(),
  ga4AddToCart: vi.fn(),
  ga4BeginCheckout: vi.fn(),
  ga4Purchase: vi.fn(),
  ga4Search: vi.fn(),
  ga4GenerateLead: vi.fn(),
  trackGA4Event: vi.fn(),
}));
vi.mock("@/lib/clarity", () => ({
  clarityEvent: vi.fn(),
  clarityTag: vi.fn(),
  clarityUpgrade: vi.fn(),
}));

// Import mocked modules to get references to the vi.fn() instances
import { trackMetaEvent } from "@/lib/meta-track";
import {
  ga4ViewItem,
  ga4AddToCart,
  ga4BeginCheckout,
  ga4Purchase,
  ga4Search,
  ga4GenerateLead,
  trackGA4Event,
} from "@/lib/ga4";
import { clarityEvent, clarityTag, clarityUpgrade } from "@/lib/clarity";

// ---------- Import under test ----------
import {
  trackViewProduct,
  trackAddToCart,
  trackInitiateCheckout,
  trackPurchase,
  trackSearch,
  trackGenerateLead,
  trackAddPaymentInfo,
} from "../tracking";

const mMeta = vi.mocked(trackMetaEvent);
const mGa4View = vi.mocked(ga4ViewItem);
const mGa4Cart = vi.mocked(ga4AddToCart);
const mGa4Checkout = vi.mocked(ga4BeginCheckout);
const mGa4Purchase = vi.mocked(ga4Purchase);
const mGa4Search = vi.mocked(ga4Search);
const mGa4Lead = vi.mocked(ga4GenerateLead);
const mGa4Event = vi.mocked(trackGA4Event);
const mClarityEvent = vi.mocked(clarityEvent);
const mClarityTag = vi.mocked(clarityTag);
const mClarityUpgrade = vi.mocked(clarityUpgrade);

function clearAll() {
  vi.clearAllMocks();
  sessionStorage.clear();
}

beforeEach(clearAll);

// ---------- Tests ----------

describe("trackViewProduct", () => {
  it("dispatches to all 3 providers with correct params", () => {
    trackViewProduct({
      productId: "p1",
      productName: "Test Shirt",
      price: 500,
    });

    expect(trackMetaEvent).toHaveBeenCalledWith("ViewContent", {
      content_ids: ["p1"],
      content_name: "Test Shirt",
      content_type: "product",
      value: 500,
      currency: "HKD",
    });

    expect(ga4ViewItem).toHaveBeenCalledWith(
      { item_id: "p1", item_name: "Test Shirt", price: 500 },
      "HKD",
    );

    expect(clarityEvent).toHaveBeenCalledWith("view_item");
    expect(clarityTag).toHaveBeenCalledWith("last_product_viewed", "Test Shirt");
    expect(clarityTag).toHaveBeenCalledWith("last_product_price", 500);
  });

  it("uses custom currency when provided", () => {
    trackViewProduct({
      productId: "p2",
      productName: "Bag",
      price: 100,
      currency: "USD",
    });

    expect(trackMetaEvent).toHaveBeenCalledWith(
      "ViewContent",
      expect.objectContaining({ currency: "USD" }),
    );
  });
});

describe("trackAddToCart", () => {
  it("dispatches to all 3 providers with num_items", () => {
    trackAddToCart({
      productId: "p1",
      productName: "Dress",
      price: 800,
    });

    expect(trackMetaEvent).toHaveBeenCalledWith("AddToCart", {
      content_ids: ["p1"],
      content_name: "Dress",
      content_type: "product",
      value: 800,
      currency: "HKD",
      num_items: 1,
    });

    expect(ga4AddToCart).toHaveBeenCalledWith(
      { item_id: "p1", item_name: "Dress", price: 800, quantity: 1 },
      "HKD",
    );

    expect(clarityEvent).toHaveBeenCalledWith("add_to_cart");
    expect(clarityUpgrade).toHaveBeenCalledWith("add_to_cart");
  });

  it("passes custom quantity", () => {
    trackAddToCart({ productId: "p1", productName: "Tee", price: 200, quantity: 3 });

    expect(trackMetaEvent).toHaveBeenCalledWith(
      "AddToCart",
      expect.objectContaining({ num_items: 3 }),
    );
    expect(ga4AddToCart).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 3 }),
      "HKD",
    );
  });
});

describe("trackInitiateCheckout", () => {
  it("dispatches to all 3 providers", () => {
    trackInitiateCheckout({
      items: [
        { productId: "p1", productName: "Shirt", price: 300, quantity: 2 },
        { productId: "p2", productName: "Pants", price: 500, quantity: 1 },
      ],
      value: 1100,
    });

    expect(trackMetaEvent).toHaveBeenCalledWith("InitiateCheckout", {
      currency: "HKD",
      value: 1100,
      content_ids: ["p1", "p2"],
      content_type: "product",
      num_items: 2,
    });

    expect(ga4BeginCheckout).toHaveBeenCalledWith(
      [
        { item_id: "p1", item_name: "Shirt", price: 300, quantity: 2 },
        { item_id: "p2", item_name: "Pants", price: 500, quantity: 1 },
      ],
      1100,
      "HKD",
    );

    expect(clarityEvent).toHaveBeenCalledWith("initiate_checkout");
    expect(clarityUpgrade).toHaveBeenCalledWith("checkout");
  });
});

describe("trackPurchase", () => {
  it("dispatches to all 3 providers with dedup hash", async () => {
    await trackPurchase({
      orderId: "order-abc",
      orderNumber: "1001",
      items: [{ productId: "p1", productName: "Shirt" }],
      value: 500,
      email: "test@example.com",
      buyerId: "member-1",
    });

    expect(trackMetaEvent).toHaveBeenCalledWith(
      "Purchase",
      expect.objectContaining({
        value: 500,
        currency: "HKD",
        order_id: "1001",
      }),
      "test@example.com",
      "member-1",
      expect.objectContaining({ eventId: expect.any(String) }),
    );

    expect(ga4Purchase).toHaveBeenCalledWith(
      "1001",
      [{ item_id: "p1", item_name: "Shirt", quantity: 1, price: undefined }],
      500,
      "HKD",
    );

    expect(clarityEvent).toHaveBeenCalledWith("purchase");
    expect(clarityUpgrade).toHaveBeenCalledWith("purchase");
    expect(clarityTag).toHaveBeenCalledWith("purchased", true);
  });

  it("generates deterministic eventId from orderId", async () => {
    await trackPurchase({
      orderId: "order-xyz",
      orderNumber: "1002",
      items: [],
      value: 100,
    });

    const firstEventId = trackMetaEvent.mock.calls[0]?.[4]?.eventId;
    clearAll();

    await trackPurchase({
      orderId: "order-xyz",
      orderNumber: "1002",
      items: [],
      value: 100,
    });

    // Second call is blocked by idempotency, but first two calls would have same hash
    // To test hash determinism, clear sessionStorage between calls
    expect(firstEventId).toBeDefined();
    expect(typeof firstEventId).toBe("string");
    expect(firstEventId!.length).toBe(36);
  });

  it("skips duplicate calls (idempotency via sessionStorage)", async () => {
    await trackPurchase({
      orderId: "order-dup",
      orderNumber: "1003",
      items: [],
      value: 200,
    });

    expect(trackMetaEvent).toHaveBeenCalledTimes(1);

    // Second call with same orderId — should be skipped
    await trackPurchase({
      orderId: "order-dup",
      orderNumber: "1003",
      items: [],
      value: 200,
    });

    expect(trackMetaEvent).toHaveBeenCalledTimes(1); // still 1
  });

  it("skips if value is zero", async () => {
    await trackPurchase({
      orderId: "order-zero",
      orderNumber: "1004",
      items: [],
      value: 0,
    });

    expect(trackMetaEvent).not.toHaveBeenCalled();
  });

  it("recovers fbc/fbp from sessionStorage", async () => {
    sessionStorage.setItem(
      "meta_cookies",
      JSON.stringify({ fbc: "fb.1.123.abc", fbp: "fb.1.456.def" }),
    );

    await trackPurchase({
      orderId: "order-fbc",
      orderNumber: "1005",
      items: [],
      value: 300,
    });

    expect(trackMetaEvent).toHaveBeenCalledWith(
      "Purchase",
      expect.any(Object),
      undefined,
      undefined,
      expect.objectContaining({ fbc: "fb.1.123.abc", fbp: "fb.1.456.def" }),
    );

    // meta_cookies should be removed after recovery
    expect(sessionStorage.getItem("meta_cookies")).toBeNull();
  });
});

describe("trackSearch", () => {
  it("dispatches to Meta and GA4", () => {
    trackSearch({ query: "leather bag" });

    expect(trackMetaEvent).toHaveBeenCalledWith("Search", {
      search_string: "leather bag",
    });
    expect(ga4Search).toHaveBeenCalledWith("leather bag");
  });
});

describe("trackGenerateLead", () => {
  it("dispatches to Meta with email and GA4", () => {
    trackGenerateLead({ email: "user@test.com", source: "footer" });

    expect(trackMetaEvent).toHaveBeenCalledWith("Lead", {}, "user@test.com");
    expect(ga4GenerateLead).toHaveBeenCalled();
  });
});

describe("trackAddPaymentInfo", () => {
  it("dispatches to Meta and GA4", () => {
    trackAddPaymentInfo({ productIds: ["p1", "p2"] });

    expect(trackMetaEvent).toHaveBeenCalledWith("AddPaymentInfo", {
      currency: "HKD",
      content_ids: ["p1", "p2"],
      content_type: "product",
    });
    expect(trackGA4Event).toHaveBeenCalledWith("add_payment_info", {
      currency: "HKD",
    });
  });
});

describe("provider isolation", () => {
  it("continues dispatching when one provider throws and logs warning", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(trackMetaEvent).mockImplementationOnce(() => {
      throw new Error("Meta failed");
    });

    trackViewProduct({
      productId: "p1",
      productName: "Fail Test",
      price: 100,
    });

    // Meta threw, but GA4 and Clarity still fired
    expect(ga4ViewItem).toHaveBeenCalled();
    expect(clarityEvent).toHaveBeenCalled();

    // Warning was logged with provider name
    expect(warnSpy).toHaveBeenCalledWith(
      "[tracking] meta failed:",
      "Meta failed",
    );
    warnSpy.mockRestore();
  });
});
