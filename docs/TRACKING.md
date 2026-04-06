# SolitaireC — Tracking, Analytics & Marketing Reference

## Overview

This document captures all advertising, analytics, and user tracking implementations in the SolitaireC headless e-commerce frontend. Use it to verify coverage, debug issues, and onboard new integrations.

---

## Tracking Providers

| Provider | Purpose | Consent Required | Files |
|----------|---------|-----------------|-------|
| **Vercel Analytics** | Page views, Web Vitals, custom events | No (privacy-friendly) | `src/lib/analytics.ts` |
| **Meta Pixel** | Browser-side ad tracking (fbq) | Yes (CookieConsent) | `src/components/MetaPixel.tsx`, `src/lib/meta-pixel.ts` |
| **Meta Conversions API** | Server-side ad tracking (deduped with Pixel) | No (server-side) | `src/lib/meta-capi.ts`, `src/app/api/meta/capi/route.ts` |
| **Microsoft Clarity** | Session recordings, heatmaps, user identification | Yes (CookieConsent) | `src/components/Clarity.tsx`, `src/lib/clarity.ts` |

### Consent Gating

MetaPixel and Clarity are rendered inside `<CookieConsent>` in `src/app/layout.tsx`. They only load after the user accepts cookies. Vercel Analytics and server-side CAPI do not require consent.

---

## User Identity

### How it works

**Member data** is fetched once via `MemberProvider` (`src/contexts/MemberContext.tsx`) and shared to all consumers via the `useMember()` hook. This replaces 9 independent `getCurrentMember()` calls with 1 shared call.

**Token-level identity** (user ID, member vs visitor) is extracted via `getUserIdentity()` in `src/lib/analytics.ts`.

**Wix token format:** Wix access tokens are NOT standard JWTs. They have format:
```
OauthNG.JWS.<header>.<payload>.<signature>
```
The payload (at dot-split index 3) contains `{ data: "<JSON string>" }` where the inner JSON has `instance.uid` (the Wix member/visitor ID). The shared utility `parseWixTokenUid()` handles this.

**Member vs Visitor:** Detected via `refreshToken.role === "member"` from the Wix auth tokens.

**Caching:** Identity is cached in-memory per session. Reset on `auth-changed` event (login/logout) via `resetUserIdentity()`.

### Where identity is used

| Consumer | What it reads | File |
|----------|--------------|------|
| Clarity identify | `getUserIdentity()` for user_id/type, then `getCurrentMember()` for name | `src/components/Clarity.tsx` |
| Vercel Analytics events | `getUserIdentity()` auto-attached to all `trackAnalytics()` calls | `src/lib/analytics.ts` |
| Meta Pixel advanced matching | `parseWixTokenUid()` for external_id, `getCurrentMember()` for email/phone/name | `src/components/MetaPixel.tsx` |
| Meta CAPI (unified tracker) | Accepts optional `userEmail` and `externalId` params | `src/lib/meta-track.ts` |
| Express/PayPal checkout | `parseWixTokenUid()` for wixVisitorId, `getCurrentMember()._id` for wixMemberId | `ExpressCheckout.tsx`, `PayPalCheckout.tsx` |

---

## E-commerce Event Tracking

### Event Flow

Each standard event fires via **both** browser Pixel and server CAPI with a shared `eventId` for deduplication (via `trackMetaEvent()` in `src/lib/meta-track.ts`).

| Event | Trigger | Pixel | CAPI | Deduped | Files |
|-------|---------|-------|------|---------|-------|
| **PageView** | Every route change | Yes (MetaPixel.tsx useEffect) | Yes (inline fetch in MetaPixel.tsx) | Yes (shared eventId) | `src/components/MetaPixel.tsx` |
| **ViewContent** | Product page load | Yes | Yes | Yes (shared eventId) | `src/app/products/[slug]/TrackView.tsx` |
| **AddToCart** | Add to bag button | Yes | Yes | Yes (shared eventId) | `src/app/products/[slug]/AddToCartButton.tsx` |
| **Search** | Search results page | Yes | Yes | Yes (shared eventId) | `src/app/search/SearchClient.tsx` |
| **InitiateCheckout** | Cart checkout / Express / PayPal | Yes | Yes | Yes (shared eventId) | `src/app/cart/page.tsx`, `ExpressCheckout.tsx`, `PayPalCheckout.tsx` |
| **Purchase (cart)** | Wix checkout redirect back | Yes | Yes (via CAPI relay) | Yes (shared eventId) | `src/app/order-confirmation/page.tsx` |
| **Purchase (express)** | Stripe/PayPal payment confirm | Yes (client) | Yes (direct server CAPI) | Yes (shared eventId) | `ExpressCheckout.tsx` + `api/stripe/confirm-order`, `PayPalCheckout.tsx` + `api/paypal/capture-order` |

### Event Data Requirements

| Event | Required Data | Notes |
|-------|--------------|-------|
| ViewContent | content_ids, content_name, content_type, value, currency | value = product price in HKD |
| AddToCart | content_ids, content_name, content_type, value, currency | value = product price in HKD |
| Search | search_string | Query term |
| InitiateCheckout | value, currency | value = cart subtotal |
| Purchase | value, currency, content_ids, content_type, order_id, num_items | Cart: via `trackMetaEvent()`. Express/PayPal: browser `trackEvent()` + server `sendCapiEvent()` with IP/UA/fbc/fbp |

### CAPI Relay Endpoint

`POST /api/meta/capi` — receives event data from the browser, enriches with server-side signals:
- IP address (from `x-forwarded-for`)
- User agent
- `_fbc` and `_fbp` cookies (read from request headers)
- Forwards to Meta Graph API

---

## Microsoft Clarity

### Identification

`identifyUser()` in `src/components/Clarity.tsx` calls:
```js
window.clarity("identify", clarityId, undefined, undefined, friendlyName)
```

- **clarityId**: Wix member `_id` (from `getCurrentMember()`) for members, JWT uid for visitors
- **friendlyName**: Member's first+last name, or email, or "Member"/"Visitor" as fallback
- Re-fires on every route change (600ms delay to avoid Clarity's SPA restart window)
- Re-fires on `auth-changed` event

### Custom Tags

Set via `clarityTag(key, value)` from `src/lib/clarity.ts`:
- `user_type` — "member" or "visitor"
- `member_id` — Wix member ID (for members only)
- `last_product_viewed` — product name (set on product page view)
- `last_product_price` — product price
- `last_added_product` — product name (set on add to cart)

### Custom Events

Fired via `clarityEvent(name)` from `src/lib/clarity.ts`:
- `add_to_cart` — when item added to bag

---

## Vercel Analytics

Custom events sent via `trackAnalytics(event, properties)` from `src/lib/analytics.ts`. Auto-attaches `user_id` and `user_type`. In development, logs to console instead of sending.

Key events:
- `product_view` — product page load (product_id, product_name, price, currency)
- `add_to_cart` — add to bag (product_id, product_name, variant_id, source)
- `search_page_view` — search results (query, result_count)
- `initiate_checkout` — checkout started (item_count, subtotal)
- `hero_click` — hero carousel click (product_slug, slide_index)
- `newsletter_subscribe` — newsletter signup (source)
- `cart_view` — cart page opened

---

## SEO

### Structured Data (JSON-LD)

| Type | Page | File |
|------|------|------|
| Organization | All pages (root layout) | `src/app/layout.tsx` |
| Product + Offer | Product pages | `src/app/products/[slug]/page.tsx` |
| BreadcrumbList | Product pages | `src/app/products/[slug]/page.tsx` |

Product JSON-LD includes: name, description, image, sku, brand, url, offers (price, currency, availability, itemCondition, seller).

### Meta Tags

- Open Graph (og:title, og:description, og:image) — per-page via Next.js `generateMetadata()`
- Twitter Cards (summary_large_image)
- Canonical URLs — handled by Next.js automatically

### Hreflang

Set in `src/app/layout.tsx` `<head>`:
- `en-HK` (primary market)
- `en` (generic English)
- `x-default` (fallback)

### Sitemap & Robots

- Dynamic sitemap: `src/app/sitemap.ts` — includes all products, collections, and static pages
- `public/robots.txt` — allows all crawlers, disallows /cart, /checkout, /account, /order-confirmation

### Product Feed

Google Shopping product feed available at `/api/product-feed` (`src/app/api/product-feed/route.ts`).

---

## Performance

### LCP Optimizations

- Hero carousel first image: `priority` + `fetchPriority="high"` for preload
- Material Symbols font: loaded non-blockingly via `src/components/MaterialSymbols.tsx` (not render-blocking)
- Body fonts (Noto Serif, Inter): loaded via `next/font/google` (self-hosted, preloaded)
- Product images: Next.js Image optimization with appropriate `sizes` attributes

### Third-Party Script Loading Order

1. Fonts (non-blocking via MaterialSymbols component)
2. Vercel Analytics (ungated, lightweight)
3. After cookie consent: Clarity (`afterInteractive`), Meta Pixel (`afterInteractive`)
4. On demand: Stripe SDK, PayPal SDK (only on product pages with express checkout)

---

## Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel ID | For Meta tracking |
| `META_CAPI_TOKEN` | Meta Conversions API access token | For server-side CAPI |
| `NEXT_PUBLIC_CLARITY_ID` | Microsoft Clarity project ID | For Clarity |
| `NEXT_PUBLIC_SITE_URL` | Canonical site URL | For SEO/structured data |

---

## Debugging

### Development Console

In dev mode, tracking logs to console:
- `[analytics] <event> {data}` — Vercel Analytics events with user identity
- `[Clarity] identify: {clarityId, friendlyName, user_type}` — Clarity identification
- `[Clarity] getUserIdentity returned null` — identity extraction failed
- `[Clarity] window.clarity not available` — Clarity script not loaded (check consent)

### Meta Events Manager

1. Go to Events Manager > Test Events
2. Enter your site URL and browse
3. Verify events appear in both "Browser" and "Server" columns
4. Check Event Match Quality score (target: 6.0+)
5. Check Event Coverage (target: 75%+ for ViewContent)

### Clarity Dashboard

- Recordings can be filtered by Custom User ID
- Custom Tags appear under Filters > Custom Tags (30min-2hr propagation delay)
- "Friendly Name" column shows identified user names

---

## Future Improvements (Not Yet Implemented)

- **Google Analytics 4** — critical for attribution and funnel visibility
- **Google Ads conversion tag** — depends on GA4
- **Sentry error monitoring** — catch checkout failures
- **Consent API for Clarity** — required for EU visitors (`window.clarity("consent")`)
