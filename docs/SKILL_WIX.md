# Wix Headless SDK Patterns — SolitaireC

## Two-Client Architecture

| | Server Client | Browser Client |
|---|---|---|
| **File** | `src/lib/wix-server-client.ts` | `src/lib/wix-browser-client.ts` |
| **Auth** | `ApiKeyStrategy` (API key + site ID) | `OAuthStrategy` (public client ID + visitor tokens) |
| **Modules** | `products`, `currentCart`, `checkout` | `currentCart`, `checkout` |
| **Use in** | Server Components, Server Actions | `"use client"` components only |
| **Pattern** | Function call (`getServerWixClient()`) | Singleton (`getBrowserWixClient()`) |

**Rule:** The `products` module is server-only. Never import it in client components.

## SDK Imports

```typescript
// Server
import { createClient } from "@wix/sdk";
import { ApiKeyStrategy } from "@wix/sdk/auth/api-key";
import { products } from "@wix/stores";
import { currentCart, checkout } from "@wix/ecom";

// Browser
import { createClient, OAuthStrategy } from "@wix/sdk";
import { currentCart, checkout } from "@wix/ecom";

// Image utility
import { media } from "@wix/sdk";  // NOT from @wix/media
```

## Token Management (Browser Client)

- **localStorage key:** `"wix_tokens"`
- **SSR guard:** `if (typeof window === "undefined") return null` in load/save
- **Singleton:** `clientInstance` cached at module scope; `getBrowserWixClient()` returns same instance
- **Race condition prevention:** `ensureVisitorTokens()` deduplicates concurrent calls via a shared `visitorTokenPromise`. Always call this before any cart operation:

```typescript
const wix = getBrowserWixClient();
await ensureVisitorTokens(wix);
// now safe to use wix.currentCart.*
```

## Image Handling

**File:** `src/lib/wix-image.ts`

```typescript
import { media } from "@wix/sdk";
media.getScaledToFillImageUrl(wixMediaIdentifier, width, height, {});
```

| Context | Dimensions | Where |
|---------|-----------|-------|
| Default | 500×500 | Fallback |
| ProductCard | 600×800 | `src/components/ProductCard.tsx` |
| PDP gallery | 800×1067 | `src/app/products/[slug]/page.tsx` |

**Fallback:** `https://placehold.co/{w}x{h}/e2e2e2/999?text=No+Image` when media identifier is null or `getScaledToFillImageUrl` throws.

## Module Map

| Package | Module | Used In | Purpose |
|---------|--------|---------|---------|
| `@wix/stores` | `products` | Server client | `queryProducts().eq().limit().find()` |
| `@wix/ecom` | `currentCart` | Both clients | `getCurrentCart`, `addToCurrentCart`, `removeLineItemsFromCurrentCart`, `createCheckoutFromCurrentCart` |
| `@wix/ecom` | `checkout` | Both clients | `getCheckoutUrl(checkoutId)` |
| `@wix/sdk` | `media` | `wix-image.ts` | `getScaledToFillImageUrl` |

## Known Gotchas

1. **WIX_STORES_APP_ID is hardcoded:** `"1380b703-ce81-ff05-f115-39571d94dfcd"` — required in `catalogReference.appId` when adding items to cart. This is a Wix platform constant, not project-specific.

2. **Options nesting:** Product options must be wrapped in a double-nested structure:
   ```typescript
   catalogReference: {
     catalogItemId: productId,
     appId: WIX_STORES_APP_ID,
     options: { options: selectedOptions }  // note the double nesting
   }
   ```

3. **Cart sync contract:** After any cart mutation, dispatch `window.dispatchEvent(new Event("cart-updated"))`. `CartBadge` listens for this event to update its count. Missing this = stale badge.

4. **Checkout is a redirect:** `getCheckoutUrl()` returns `{ checkoutUrl }` — a Wix-hosted page. The flow is `createCheckoutFromCurrentCart` → `getCheckoutUrl` → `window.location.href` redirect.

5. **Product query by slug, not ID:** PDP uses `.eq("slug", slug)`, not `.eq("_id", id)`. Slugs come from the product URL.

6. **CartBadge checks tokens before API call:** It reads localStorage for existing tokens to avoid creating unnecessary visitor sessions just to show a zero count.

## Dependency Versions

```json
{
  "@wix/ecom": "^1.0.1978",
  "@wix/media": "^1.0.237",
  "@wix/sdk": "^1.21.5",
  "@wix/stores": "^1.0.724"
}
```

Wix SDK APIs can change between versions. Pin these if upgrading causes issues.
