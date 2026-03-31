import { describe, it, expect } from "vitest";
import {
  buildCatalogReference,
  buildStockKey,
  buildV1Fallback,
  WIX_STORES_V1_APP_ID,
  WIX_STORES_V3_APP_ID,
  ZERO_VARIANT_ID,
} from "../cart";

describe("buildCatalogReference", () => {
  it("returns V1 with no options for products without any selectedOptions", () => {
    const result = buildCatalogReference({
      productId: "abc-123",
      manageVariants: false,
    });

    expect(result.reference.appId).toBe(WIX_STORES_V1_APP_ID);
    expect(result.reference.catalogItemId).toBe("abc-123");
    expect(result.reference.options).toBeUndefined();
    expect(result.usedFallback).toBe(false);
  });

  it("returns V3 + zero-UUID for manageVariants:false with options (jacket-type product)", () => {
    const result = buildCatalogReference({
      productId: "abc-123",
      manageVariants: false,
      selectedOptions: { Size: "S" },
    });

    // V3 is tried first; addItemToCart will fall back to V1 if rejected
    expect(result.reference.appId).toBe(WIX_STORES_V3_APP_ID);
    expect(result.reference.options).toEqual({
      options: { Size: "S" },
      variantId: ZERO_VARIANT_ID,
    });
    expect(result.usedFallback).toBe(false);
  });

  it("returns V3 with real variantId for manageVariants:true products", () => {
    const result = buildCatalogReference({
      productId: "abc-123",
      manageVariants: true,
      selectedOptions: { Size: "S" },
      variantId: "e3f84e7c-cc58-4d26-b626-4541df79342a",
    });

    expect(result.reference.appId).toBe(WIX_STORES_V3_APP_ID);
    expect(result.reference.options).toEqual({
      options: { Size: "S" },
      variantId: "e3f84e7c-cc58-4d26-b626-4541df79342a",
    });
    expect(result.usedFallback).toBe(false);
  });

  it("returns V3 with zero-UUID fallback when manageVariants:true but variantId missing", () => {
    const result = buildCatalogReference({
      productId: "abc-123",
      manageVariants: true,
      selectedOptions: { Size: "M" },
    });

    expect(result.reference.appId).toBe(WIX_STORES_V3_APP_ID);
    expect(result.reference.options?.variantId).toBe(ZERO_VARIANT_ID);
    expect(result.usedFallback).toBe(true);
  });

  it("returns V1 when manageVariants:true but selectedOptions is empty", () => {
    const result = buildCatalogReference({
      productId: "abc-123",
      manageVariants: true,
      selectedOptions: {},
    });

    expect(result.reference.appId).toBe(WIX_STORES_V1_APP_ID);
    expect(result.reference.options).toBeUndefined();
  });

  it("returns V1 when manageVariants:true but selectedOptions is undefined", () => {
    const result = buildCatalogReference({
      productId: "abc-123",
      manageVariants: true,
    });

    expect(result.reference.appId).toBe(WIX_STORES_V1_APP_ID);
    expect(result.reference.options).toBeUndefined();
  });

  it("handles multi-option manageVariants:true products correctly", () => {
    const result = buildCatalogReference({
      productId: "abc-123",
      manageVariants: true,
      selectedOptions: { Color: "Black", Size: "L" },
      variantId: "real-uuid",
    });

    expect(result.reference.appId).toBe(WIX_STORES_V3_APP_ID);
    expect(result.reference.options).toEqual({
      options: { Color: "Black", Size: "L" },
      variantId: "real-uuid",
    });
  });
});

describe("buildV1Fallback", () => {
  it("returns V1 reference with no options", () => {
    const ref = buildV1Fallback("abc-123");
    expect(ref.appId).toBe(WIX_STORES_V1_APP_ID);
    expect(ref.catalogItemId).toBe("abc-123");
    expect(ref.options).toBeUndefined();
  });
});

describe("buildStockKey", () => {
  it("builds key from single option", () => {
    expect(buildStockKey({ Size: "M" })).toBe("Size:M");
  });

  it("sorts options alphabetically by key name", () => {
    expect(buildStockKey({ Size: "M", Color: "Black" })).toBe(
      "Color:Black|Size:M"
    );
  });

  it("handles three options", () => {
    expect(
      buildStockKey({ Size: "M", Color: "Black", Material: "Leather" })
    ).toBe("Color:Black|Material:Leather|Size:M");
  });

  it("returns empty string for empty object", () => {
    expect(buildStockKey({})).toBe("");
  });

  it("is deterministic regardless of input order", () => {
    const a = buildStockKey({ Color: "Blue", Size: "S" });
    const b = buildStockKey({ Size: "S", Color: "Blue" });
    expect(a).toBe(b);
  });
});
