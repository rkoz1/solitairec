# JS Bundle Optimization Plan

## Problem

Lighthouse mobile LCP is ~5.5s despite real browser LCP being ~636ms. The gap is caused by **5.2MB of JavaScript** (240KB compressed) downloaded and parsed under Lighthouse's simulated slow 4G (1.6 Mbps) + 4x CPU throttle. The hero image itself is only 24KB AVIF — no longer the bottleneck.

Two chunks dominate:
- `0tsts2npie3...js` — 1,096KB (133KB compressed)
- `10_smojt9rlee.js` — 1,017KB (107KB compressed)

Both contain **Wix SDK modules** pulled into the client bundle.

## Root Cause

`src/lib/wix-browser-client.ts` imports 6 Wix SDK packages:

```
@wix/sdk          — Core SDK, OAuthStrategy
@wix/ecom         — currentCart, checkout, orders, backInStockNotifications
@wix/loyalty      — accounts, transactions, coupons
@wix/members      — members
@wix/redirects    — redirects
@wix/referral     — customers
```

These are pulled into the client bundle by **16 client components**. The critical path is:

1. **`MemberContext`** (`src/contexts/MemberContext.tsx`) — wraps the entire app in `layout.tsx`, always loaded on every page
2. **`CartBadge`** (`src/components/CartBadge.tsx`) — in the header on every page, calls `getBrowserWixClient()` in `useEffect`
3. **`ProductCardActions`** (`src/components/ProductCardActions.tsx`) — on every product card, imports cart functions
4. **`PayPalCheckout` + `ExpressCheckout`** — loaded on product pages before user clicks buy

Because `MemberContext` is in the root layout, the entire Wix SDK is in the critical path of every single page.

## Phases

### Phase 1: Lazy-load MemberContext (High Impact, ~200KB saved)

**Current:** `MemberContext` is directly imported and mounted in `src/app/layout.tsx`, forcing the Wix SDK into the main bundle.

**Change:** Use `next/dynamic` to lazy-load the provider:

```tsx
// layout.tsx
const MemberProvider = dynamic(
  () => import("@/contexts/MemberContext").then((m) => m.MemberProvider),
  { ssr: false }
);
```

**Considerations:**
- Components that consume `useMember()` need to handle the case where the context isn't mounted yet (member = null during initial render)
- Auth-dependent UI (account links, personalized content) will flash briefly on hydration — acceptable tradeoff
- MetaPixel and Clarity identity calls depend on member data — they already handle null member, so no change needed

### Phase 2: Defer CartBadge SDK init (Medium Impact, ~100KB saved)

**Current:** `CartBadge` calls `getBrowserWixClient()` and `getCurrentCart()` in a `useEffect` on every page mount.

**Change:** Don't fetch the cart count on mount. Instead:
- Show no badge initially
- Fetch cart count only after a `cart-updated` event fires (add-to-cart, page where cart is relevant)
- Or lazy-import the Wix client inside the effect:

```tsx
useEffect(() => {
  import("@/lib/wix-browser-client").then(({ getBrowserWixClient }) => {
    // fetch cart count
  });
}, []);
```

This moves the Wix SDK import out of the main bundle and into an async chunk loaded after LCP paint.

### Phase 3: Dynamic import checkout components (Medium Impact, ~150KB saved)

**Current:** `PayPalCheckout` and `ExpressCheckout` are statically imported on the product page.

**Change:** Use `next/dynamic`:

```tsx
const PayPalCheckout = dynamic(() => import("./PayPalCheckout"), {
  loading: () => null,
});
const ExpressCheckout = dynamic(() => import("./ExpressCheckout"), {
  loading: () => null,
});
```

These components are below the fold on product pages and only relevant when the user is ready to purchase. No LCP impact.

### Phase 4: Split wix-browser-client into light/full (High Impact, ~200KB saved)

**Current:** Single `wix-browser-client.ts` imports everything. Any component that needs `currentCart` also pulls in `loyalty`, `referral`, `members`, etc.

**Change:** Create two clients:

```
src/lib/wix-browser-client-light.ts  — @wix/sdk + @wix/ecom (currentCart only)
src/lib/wix-browser-client-full.ts   — everything (loyalty, members, referral, etc.)
```

Update components:
- `CartBadge`, `ProductCardActions`, `AddToCartButton`, `GiftCardForm` → use light client
- `AccountPage`, `ReferFriends`, `MemberContext` → use full client (lazy-loaded from Phase 1)

This ensures the bulk of the SDK is only loaded on pages that need it (account, checkout).

## Expected Results

| Phase | Savings (compressed) | Main bundle reduction | Effort |
|-------|---------------------|----------------------|--------|
| 1     | ~50-60KB            | Wix SDK deferred     | Medium |
| 2     | ~30-40KB            | Cart SDK async       | Low    |
| 3     | ~40-50KB            | Checkout async       | Low    |
| 4     | ~50-60KB            | SDK split            | Medium |
| **Total** | **~170-210KB**  | **~65% reduction**   |        |

Under Lighthouse's 1.6 Mbps, 200KB fewer = ~1s faster. Combined with reduced CPU parse time, target is LCP < 3.5s.

## Files to Modify

- `src/app/layout.tsx` — dynamic import MemberProvider
- `src/contexts/MemberContext.tsx` — ensure graceful null handling
- `src/components/CartBadge.tsx` — async import wix client
- `src/app/products/[slug]/ProductInfo.tsx` — dynamic import checkout components
- `src/lib/wix-browser-client.ts` — split into light/full
- `src/components/ProductCardActions.tsx` — use light client
- `src/app/products/[slug]/AddToCartButton.tsx` — use light client
- `src/app/gift-cards/GiftCardForm.tsx` — use light client
- `src/app/account/page.tsx` — use full client (already lazy by route)
- `src/app/refer-friends/page.tsx` — use full client (already lazy by route)

## Verification

1. `npm run build` — check chunk sizes in build output, compare before/after
2. Chrome DevTools Coverage tab — verify Wix SDK code is no longer in initial load
3. Lighthouse mobile — LCP should drop by ~1-1.5s
4. Manual testing — cart, checkout, account, wishlist all still functional
