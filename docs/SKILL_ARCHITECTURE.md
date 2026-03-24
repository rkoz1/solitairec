# Project Architecture — SolitaireC

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.1 |
| UI | React | 19.2.4 |
| Styling | Tailwind CSS v4 | ^4 (PostCSS plugin) |
| Backend | Wix Headless (BaaS) | SDK 1.21.5 |
| Language | TypeScript | ^5 (strict mode) |

**Important:** Next.js 16 has breaking changes vs. training data. Always check `node_modules/next/dist/docs/` before using any Next.js API. See `AGENTS.md`.

## Route Structure

```
src/app/
  layout.tsx            Server   Root layout: frosted header, bottom nav, fonts, Material Symbols CDN
  globals.css           —        Design tokens (@theme inline), animations, icon config
  page.tsx              Server   Home: fetches 12 products, categorizes by name keywords
  loading.tsx           Server   Root loading fallback (branded "S" pulse)
  products/[slug]/
    page.tsx            Server   PDP: queries by slug, image gallery, editorial description
    ProductInfo.tsx     Client   Variant/size selector state
    AddToCartButton.tsx Client   Cart mutation via browser Wix client
    loading.tsx         Server   PDP loading fallback
  cart/page.tsx         Client   Full cart view, remove items, checkout redirect
  account/page.tsx      Server   Placeholder (no auth yet)
```

## Server vs Client Split

**Rule:** Catalog reads (`products` module) = server only. Cart/checkout mutations = browser only.

| Type | Components |
|------|-----------|
| **Server** | `HomePage`, `ProductPage`, `ProductCard`, `CompleteTheLook`, `LoadingIndicator` |
| **Client** (`"use client"`) | `CartPage`, `AddToCartButton`, `ProductInfo`, `CartBadge`, `NavigationDrawer`, `NavigationLoader`, `ImageCarousel` |

Server components call `getServerWixClient()`. Client components call `getBrowserWixClient()`.

## Data Flow Patterns

### Product listing (home page)
```
getServerWixClient() → wix.products.queryProducts().limit(12).find()
→ filter by name keywords into categories (shoes/bags/other)
→ render ProductCard per item
```

### Product detail (PDP)
```
getServerWixClient() → wix.products.queryProducts().eq("slug", slug).limit(1).find()
→ notFound() if empty
→ extract main image (800×1067) + up to 5 additional images
→ server-render gallery + editorial sections
→ hand off to ProductInfo (client) for variant selection
```

### Add to cart
```
getBrowserWixClient() → ensureVisitorTokens(wix)
→ wix.currentCart.addToCurrentCart({ lineItems: [{ catalogReference: { catalogItemId, appId: WIX_STORES_APP_ID, options: { options: selectedOptions } }, quantity }] })
→ window.dispatchEvent(new Event("cart-updated"))
```

### Checkout
```
wix.currentCart.createCheckoutFromCurrentCart({ channelType: "WEB" })
→ wix.checkout.getCheckoutUrl(checkoutId)
→ window.location.href = checkoutUrl   (redirect to Wix-hosted checkout)
```

### Cross-component cart sync
`CartBadge` listens for `"cart-updated"` DOM events. Any code that mutates the cart **must** dispatch this event afterward.

## Component Inventory

| Component | Location | Type | Purpose |
|-----------|----------|------|---------|
| `ProductCard` | `src/components/` | Server | Image + name + price link card |
| `CompleteTheLook` | `src/components/` | Server | Cross-sell section (4 random products) |
| `LoadingIndicator` | `src/components/` | Server | Pulsing "S" brand loading state |
| `CartBadge` | `src/components/` | Client | Cart icon with count; listens `cart-updated` |
| `NavigationDrawer` | `src/components/` | Client | Full-screen nav overlay (portal) |
| `NavigationLoader` | `src/components/` | Client | Page transition overlay; 8s safety timeout |
| `ImageCarousel` | `src/components/` | Client | Snap-scroll carousel with dot indicators |
| `ProductInfo` | `src/app/products/[slug]/` | Client | Variant selector + wraps AddToCartButton |
| `AddToCartButton` | `src/app/products/[slug]/` | Client | Cart add mutation with 2s success feedback |

## Naming Conventions

- **Components:** PascalCase filenames (`ProductCard.tsx`)
- **Lib modules:** kebab-case (`wix-server-client.ts`)
- **Route-colocated client components:** Live in the route dir (e.g., `products/[slug]/AddToCartButton.tsx`)
- **Shared components:** Flat in `src/components/` (no subdirectories)
- **Path alias:** `@/` → `src/`

## Next.js 16 Specifics

- `params` is a **Promise** in page components: `const { slug } = await params;`
- `export const dynamic = "force-dynamic"` on pages that fetch Wix data
- Image config in `next.config.ts` whitelists: `static.wixstatic.com`, `placehold.co`

## Environment Variables

| Variable | Scope | Purpose |
|----------|-------|---------|
| `WIX_API_KEY` | Server only | API Key auth for `getServerWixClient()` |
| `WIX_SITE_ID` | Server only | Identifies the Wix site |
| `NEXT_PUBLIC_WIX_CLIENT_ID` | Public (browser) | OAuth client ID for visitor sessions |
