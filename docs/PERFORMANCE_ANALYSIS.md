# Performance Analysis: Wix Headless Facade/Middleware Layer

## Executive Summary

SolitaireC makes direct Wix SDK calls with no caching, deduplication, or response shaping. Seven key problems were identified that, when addressed, could reduce home/PDP TTFB from ~800-1200ms to ~20-100ms and cut Wix API calls by 90%+.

---

## Current State Audit

### Problem 1: Duplicate Product Queries
`src/components/CompleteTheLook.tsx:14` re-fetches the same `queryProducts().limit(12).find()` that the home page already runs, adding ~200-400ms to every PDP.

### Problem 2: No Caching
Both `src/app/page.tsx` and `src/app/products/[slug]/page.tsx` export `force-dynamic`, so every request hits Wix APIs fresh. Product data changes hourly/daily but is fetched as if it changes per-second.

### Problem 3: New Server Client Per Call
`getServerWixClient()` creates a new `createClient()` instance every time — no singleton pattern like the browser client has.

### Problem 4: Over-fetching
Home page only needs `_id/slug/name/price/imageUrl` but receives full product objects with HTML descriptions, all media, SEO data, variants, etc.

### Problem 5: Duplicate CartBadge Calls
`src/app/layout.tsx` renders **two** `CartBadge` instances (lines 55 and 76), each independently calling `getCurrentCart()` on every page navigation.

### Problem 6: Massive Dependency Tree
117 `@wix/*` packages totaling 219 MB. `@wix/media` (356 KB) is in `package.json` but never imported.

### Problem 7: No Server-Side Request Deduplication
No use of `React.cache()` or similar across concurrent React Server Component renders.

---

## Caching Strategy by Data Type

| Data Type | Cacheable? | TTL | Invalidation Strategy | Cache Location |
|-----------|-----------|-----|----------------------|----------------|
| Product catalog | Yes | 5-15 min | ISR revalidate + Wix webhook | Next.js Data Cache / ISR |
| Collections | Yes | 15-30 min | ISR revalidate | Next.js Data Cache |
| Single product | Yes | 5-10 min | ISR revalidate + on-demand | Next.js Data Cache / ISR |
| Inventory/stock | Yes (short) | 30-60 sec | Stale-while-revalidate | In-memory / edge |
| Cart | No (per-user) | — | Client state (React context) | Browser only |
| Checkout | No (per-session) | — | — | Browser only |
| Site settings | Yes | 1 hour+ | TTL | Build-time / edge |

---

## Request Optimization Opportunities

### Batching & Deduplication
- **React.cache()** — Wrap Wix query functions so concurrent server component renders share a single request
- **unstable_cache** — Layer Next.js persistent cache on top for cross-request deduplication
- **CompleteTheLook** — Pass products from parent instead of re-fetching

### Response Shaping
- Build a facade that returns only needed fields (`id`, `slug`, `name`, `price`, `mainImage`)
- Product list cards don't need descriptions, SEO data, or variant details
- Estimated payload reduction: ~60-70% for product list responses

### Client Bundle
- Move cart/checkout operations to API routes — removes Wix SDK from client bundle
- Current estimated Wix client JS: ~80-120 KB gzipped
- After API route migration: ~5-10 KB gzipped (just fetch calls)

---

## Next.js-Specific Optimizations

### ISR / Static Generation
- **Home page**: `revalidate = 300` (5 min) instead of `force-dynamic`
- **Product pages**: `generateStaticParams()` to pre-render top products at build time
- **Collection pages**: ISR with 5-10 min revalidation

### Edge Middleware
- Geo-based currency/shipping detection
- A/B testing without client-side flicker
- Cart count injection via cookie (avoids server round-trip for CartBadge)

### Streaming
- Product page: stream description/reviews after initial paint
- Collection page: stream product grid while filters load

---

## Wix SDK Overhead

| Metric | Current |
|--------|---------|
| `@wix/*` packages | 117 packages, 219 MB on disk |
| Unused packages | `@wix/media` (356 KB) — never imported |
| Client initialization | New instance per server request (no singleton) |
| Client bundle impact | ~80-120 KB gzipped (SDK + dependencies) |

---

## Facade Architecture (Proposed)

```
Browser → Next.js Edge/Server → Facade Layer → Wix SDK → Wix APIs
                                    ↓
                              Cache Layer
                         (React.cache + ISR +
                          unstable_cache)
```

The facade would:
1. Expose typed functions like `getProductList()`, `getProductBySlug()`
2. Apply `React.cache()` for per-request dedup
3. Apply `unstable_cache()` for cross-request caching
4. Shape responses to only include needed fields
5. Handle error fallbacks (serve stale on Wix outage)

---

## Recommendations (Prioritized by Impact vs Effort)

| # | Technique | Impact | Effort | Description |
|---|-----------|--------|--------|-------------|
| R1 | Remove `force-dynamic`, enable ISR | **High** | **Low** | Change to `revalidate = 300` on home + product pages. Single-line changes. |
| R2 | Fix CompleteTheLook duplicate query | **High** | **Low** | Pass products from parent or use React.cache wrapper. |
| R3 | Product data facade with caching | **High** | **Medium** | `React.cache()` + `unstable_cache` wrapper around Wix product queries. |
| R4 | Shared cart context (dedup CartBadge) | **Medium** | **Low** | Single CartProvider in layout, remove duplicate CartBadge. |
| R5 | API routes for cart/checkout | **Medium** | **Medium** | Move Wix SDK cart calls to `/api/cart/*` routes, shrink client bundle. |
| R6 | Response shaping in facade | **Medium** | **Low** | Return only needed fields from facade functions. |
| R7 | `generateStaticParams` for PDPs | **Medium** | **Low** | Pre-render top product pages at build time. |
| R8 | Server client singleton | **Low** | **Low** | Cache `createClient()` in module scope for server lifetime. |
| R9 | Optimistic cart updates | **Medium** | **Medium** | Update UI immediately, sync with Wix in background. |
| R10 | CDN cache headers on API routes | **Medium** | **Low** | `Cache-Control` headers on cacheable API responses. |
| R11 | Remove unused `@wix/media` | **Low** | **Low** | Delete from `package.json`. |
| R12 | SWR pattern for orders/wishlist | **Low** | **Medium** | Stale-while-revalidate for user-specific data. |

---

## Estimated Impact

| Metric | Current | After Phase 1 (1-2 days) | After All Phases |
|--------|---------|--------------------------|-----------------|
| Home/PDP TTFB | ~800-1200ms | ~50-100ms (cached) | ~20-50ms (edge) |
| Wix API calls/min (10 users) | ~60-100 | ~5-10 | ~2-5 |
| Client JS (Wix portion) | ~80-120 KB gz | ~80-120 KB gz | ~5-10 KB gz |
| PDP API round-trips | 2 | 1 | 0 (pre-rendered) |

---

## Implementation Roadmap

### Phase 1 — Quick Wins (1-2 days)
- R1: Switch `force-dynamic` → `revalidate = 300`
- R2: Fix CompleteTheLook duplicate query
- R4: Remove duplicate CartBadge from layout
- R8: Server client singleton
- R11: Remove unused `@wix/media`

### Phase 2 — Facade Layer (3-5 days)
- R3: Build `src/lib/wix-facade/` with cached query functions
- R6: Response shaping for product lists vs detail
- R7: `generateStaticParams` for product pages
- R10: CDN cache headers

### Phase 3 — Client Optimization (3-5 days)
- R5: API routes for cart/checkout operations
- R9: Optimistic cart updates
- R12: SWR pattern for user data

**Phase 1 alone delivers the majority of performance gains with minimal code changes.**
