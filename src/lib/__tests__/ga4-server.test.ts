// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from "vitest";

// Set env vars before any import
process.env.NEXT_PUBLIC_GA4_ID = "G-TEST123";
process.env.GA4_API_SECRET = "test-secret";

// Mock fetch globally before module loads
const fetchMock = vi.fn(() =>
  Promise.resolve(new Response(null, { status: 204 })),
);
vi.stubGlobal("fetch", fetchMock);

describe("ga4ServerPurchase", () => {
  beforeEach(() => {
    fetchMock.mockClear();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    vi.resetModules();
  });

  it("sends correct Measurement Protocol payload", async () => {
    const { ga4ServerPurchase } = await import("../ga4");

    await ga4ServerPurchase(
      "client-abc",
      "ORDER-1001",
      [
        { item_id: "p1", item_name: "Shirt", quantity: 2, price: 250 },
        { item_id: "p2", item_name: "Pants" },
      ],
      750,
      "HKD",
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://www.google-analytics.com/mp/collect?measurement_id=G-TEST123&api_secret=test-secret",
    );
    expect(init.method).toBe("POST");
    expect(init.headers).toEqual({ "Content-Type": "application/json" });

    const body = JSON.parse(init.body);
    expect(body.client_id).toBe("client-abc");
    expect(body.events).toHaveLength(1);
    expect(body.events[0].name).toBe("purchase");
    expect(body.events[0].params.transaction_id).toBe("ORDER-1001");
    expect(body.events[0].params.currency).toBe("HKD");
    expect(body.events[0].params.value).toBe(750);
    expect(body.events[0].params.items).toEqual([
      { item_id: "p1", item_name: "Shirt", quantity: 2, price: 250 },
      { item_id: "p2", item_name: "Pants", quantity: 1 },
    ]);
  });

  it("defaults quantity to 1 and omits price when undefined", async () => {
    const { ga4ServerPurchase } = await import("../ga4");

    await ga4ServerPurchase(
      "client-xyz",
      "ORDER-1002",
      [{ item_id: "p3", item_name: "Bag" }],
      500,
      "HKD",
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.events[0].params.items[0]).toEqual({
      item_id: "p3",
      item_name: "Bag",
      quantity: 1,
    });
  });

  it("logs error on non-OK response", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(
      new Response("Bad Request", { status: 400 }),
    );

    const { ga4ServerPurchase } = await import("../ga4");
    await ga4ServerPurchase("c1", "O1", [], 100, "HKD");

    expect(errorSpy).toHaveBeenCalledWith(
      "[GA4 MP] Error:",
      400,
      "Bad Request",
    );
    errorSpy.mockRestore();
  });

  it("logs error on network failure", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new Error("Network down"));

    const { ga4ServerPurchase } = await import("../ga4");
    await ga4ServerPurchase("c1", "O1", [], 100, "HKD");

    expect(errorSpy).toHaveBeenCalledWith(
      "[GA4 MP] Failed to send purchase:",
      "Network down",
    );
    errorSpy.mockRestore();
  });

  it("no-ops when env vars are missing", async () => {
    const prev = process.env.GA4_API_SECRET;
    delete process.env.GA4_API_SECRET;

    const { ga4ServerPurchase } = await import("../ga4");
    await ga4ServerPurchase("c1", "O1", [], 100, "HKD");

    expect(fetchMock).not.toHaveBeenCalled();
    process.env.GA4_API_SECRET = prev;
  });
});
