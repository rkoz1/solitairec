import { log } from "./logger";

// Wix Catalog App IDs
export const WIX_STORES_V1_APP_ID = "1380b703-ce81-ff05-f115-39571d94dfcd";
export const WIX_STORES_V3_APP_ID = "215238eb-22a5-4c36-9e7b-e7c08025e04e";
export const ZERO_VARIANT_ID = "00000000-0000-0000-0000-000000000000";

// --- Pure functions (testable, no side effects) ---

export interface CartItemInput {
  productId: string;
  productName?: string;
  manageVariants: boolean;
  selectedOptions?: Record<string, string>;
  variantId?: string;
  quantity?: number;
}

export interface CartCatalogReference {
  catalogItemId: string;
  appId: string;
  options?: { options: Record<string, string>; variantId: string };
}

export interface BuildResult {
  reference: CartCatalogReference;
  usedFallback: boolean;
}

/**
 * Build the correct catalogReference for adding a product to cart.
 *
 * Rules:
 * - manageVariants: true + options → V3 appId + options + real variantId
 * - manageVariants: false + has options → V3 + zero-UUID (primary), V1 no options (fallback)
 * - No options → V1 appId, no options
 */
export function buildCatalogReference(input: CartItemInput): BuildResult {
  const hasSelectedOptions =
    input.selectedOptions &&
    Object.keys(input.selectedOptions).length > 0;

  // No options at all → V1
  if (!hasSelectedOptions) {
    return {
      reference: {
        catalogItemId: input.productId,
        appId: WIX_STORES_V1_APP_ID,
      },
      usedFallback: false,
    };
  }

  // manageVariants: true → V3 with real variantId
  if (input.manageVariants) {
    return {
      reference: {
        catalogItemId: input.productId,
        appId: WIX_STORES_V3_APP_ID,
        options: {
          options: input.selectedOptions!,
          variantId: input.variantId || ZERO_VARIANT_ID,
        },
      },
      usedFallback: !input.variantId,
    };
  }

  // manageVariants: false + has options → V3 + zero-UUID
  // (some products need this, e.g. jacket with Size; others don't, e.g. standalone bags)
  // addItemToCart will retry with V1 if this fails
  return {
    reference: {
      catalogItemId: input.productId,
      appId: WIX_STORES_V3_APP_ID,
      options: {
        options: input.selectedOptions!,
        variantId: ZERO_VARIANT_ID,
      },
    },
    usedFallback: false,
  };
}

/**
 * Build V1 fallback reference (no options).
 * Used when V3 + zero-UUID is rejected for manageVariants:false products.
 */
export function buildV1Fallback(productId: string): CartCatalogReference {
  return {
    catalogItemId: productId,
    appId: WIX_STORES_V1_APP_ID,
  };
}

/**
 * Build a deterministic stock key from option selections.
 * Sorted alphabetically by option name, e.g. "Color:Black|Size:M"
 */
export function buildStockKey(opts: Record<string, string>): string {
  return Object.entries(opts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
}

// --- Async wrapper (browser-only, needs wix client) ---

export interface AddToCartResult {
  success: boolean;
  error?: string;
}

type WixClient = {
  currentCart: {
    addToCurrentCart: (params: {
      lineItems: {
        catalogReference: Record<string, unknown>;
        quantity: number;
      }[];
    }) => Promise<{
      cart?: {
        lineItems?: { catalogReference?: { catalogItemId?: string } }[];
      };
    }>;
  };
};

/**
 * Add an item to the cart with full verification and logging.
 * Returns { success: true } or { success: false, error: "..." }.
 * Does NOT dispatch UI events — caller handles cart-updated, fly animation, toasts.
 */
export async function addItemToCart(
  wix: WixClient,
  input: CartItemInput
): Promise<AddToCartResult> {
  const { reference, usedFallback } = buildCatalogReference(input);

  if (usedFallback) {
    log({
      level: "warn",
      action: "add-to-cart-zero-uuid-fallback",
      details: {
        productId: input.productId,
        productName: input.productName,
        selectedOptions: input.selectedOptions,
      },
    });
  }

  const result = await wix.currentCart.addToCurrentCart({
    lineItems: [
      {
        catalogReference: reference as unknown as Record<string, unknown>,
        quantity: input.quantity ?? 1,
      },
    ],
  });

  // Verify the item was actually added (Wix silently drops invalid items)
  const itemInCart = result.cart?.lineItems?.some(
    (li) => li.catalogReference?.catalogItemId === input.productId
  );

  if (itemInCart) {
    return { success: true };
  }

  // For manageVariants:false products with options, V3 may fail for standalone
  // per-color products. Retry with V1 (no options) as fallback.
  const hasOptions = input.selectedOptions && Object.keys(input.selectedOptions).length > 0;
  if (!input.manageVariants && hasOptions) {
    log({
      level: "info",
      action: "add-to-cart-v3-rejected-trying-v1",
      details: { productId: input.productId, productName: input.productName },
    });

    const fallback = buildV1Fallback(input.productId);
    const retryResult = await wix.currentCart.addToCurrentCart({
      lineItems: [
        {
          catalogReference: fallback as unknown as Record<string, unknown>,
          quantity: input.quantity ?? 1,
        },
      ],
    });

    const retryInCart = retryResult.cart?.lineItems?.some(
      (li) => li.catalogReference?.catalogItemId === input.productId
    );

    if (retryInCart) {
      return { success: true };
    }
  }

  log({
    level: "error",
    action: "add-to-cart-rejected",
    details: {
      productId: input.productId,
      productName: input.productName,
      manageVariants: input.manageVariants,
      selectedOptions: input.selectedOptions,
      variantId: reference.options?.variantId,
      appId: reference.appId,
      usedFallback,
      cartItemIds: result.cart?.lineItems?.map(
        (li) => li.catalogReference?.catalogItemId
      ),
    },
  });

  return {
    success: false,
    error: "Item was not added to cart. It may be out of stock or unavailable in the selected option.",
  };
}

/**
 * Verify that a specific product exists in a cart response.
 * Useful for gift cards and other custom catalog items.
 */
export function verifyItemInCart(
  cart: { lineItems?: { catalogReference?: { catalogItemId?: string } }[] } | undefined,
  productId: string
): boolean {
  return cart?.lineItems?.some(
    (li) => li.catalogReference?.catalogItemId === productId
  ) ?? false;
}
