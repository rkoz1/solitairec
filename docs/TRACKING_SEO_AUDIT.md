# Tracking & SEO Audit — SOLITAIREC

**Date:** 2026-04-09
**Audited by:** Claude Code (4 parallel agents researching latest docs for each product)

---

## 1. CLARITY

### Ratings

| Area | Rating | Finding |
|------|--------|---------|
| Script Loading | WARN | `lazyOnload` delays capture — should be `afterInteractive` |
| SPA Support | PASS | Auto-detects route changes via History API |
| Identify API | WARN | 600ms timeout is fragile; not passing pathname as page ID |
| Custom Events | WARN | Missing `remove_from_cart`, `view_item` as event; possible duplicate purchase fire |
| Custom Tags | PASS | Good coverage |
| Cookie Consent | FAIL | Not using Clarity Consent API V2 — loses ALL pre-consent data |
| Event Queue | WARN | Silent no-ops when `window.clarity` undefined |
| Performance | PASS | No concerns |

### Issues

**C1 (FAIL) — Cookie consent blocks Clarity entirely**
`CookieConsent.tsx` prevents `<Clarity>` from rendering until user accepts. This means zero data from users who haven't consented. Clarity's Consent API V2 (enforced since Oct 2025) allows loading the script unconditionally in cookieless mode, then calling `window.clarity('consentv2', {...})` when consent is granted. This gives anonymized heatmaps and aggregate metrics even without consent.
- File: `src/components/CookieConsent.tsx` (line 51)
- File: `src/components/Clarity.tsx`
- Docs: https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-consent-api-v2

**C2 (WARN) — Script loading strategy too conservative**
`strategy="lazyOnload"` defers until browser idle. Early user interactions (first clicks, scrolls, rage clicks) are missed. Should be `afterInteractive`.
- File: `src/components/Clarity.tsx` (line 84)

**C3 (WARN) — 600ms identify timeout is fragile**
The Clarity inline snippet defines `window.clarity` as a queue function immediately, so calls are buffered. The 600ms timeout is unnecessary if the inline script runs before the useEffect. With `afterInteractive` this race is less likely.
- File: `src/components/Clarity.tsx` (line 67)

**C4 (WARN) — Not passing pathname as custom-page-id**
Clarity docs recommend passing a page ID per page for filtering. Currently passes `undefined`.
- File: `src/components/Clarity.tsx` (line 53)

**C5 (WARN) — Missing events**
- `remove_from_cart` — no event when items are removed from cart
- `view_item` — product views tracked as tags but not as timeline pin events
- No `upgrade` API call on purchase/checkout sessions (Clarity samples recordings at scale; `upgrade` ensures important sessions are always recorded)

**C6 (WARN) — Duplicate purchase event possible**
`order-confirmation/page.tsx` has two code paths that fire `clarityEvent("purchase")` — express checkout (line 49) and cart checkout (line ~166). If both execute in the same page load, purchase is double-counted.

**C7 (WARN) — Auth-changed resets identity but doesn't re-identify**
Line 74 resets cached identity on `auth-changed`, but re-identify only happens on the next route change. If user logs in without navigating, Clarity session is misidentified.
- File: `src/components/Clarity.tsx` (line 74)

---

## 2. META PIXEL & CAPI

**Current EMQ: 6.1-6.5/10 — Target: 8.0+**

### Ratings

| Area | Rating | Finding |
|------|--------|---------|
| Event Coverage | WARN | 9/10 standard events. Missing: AddPaymentInfo |
| Event Match Quality | FAIL | fn/ln sent to pixel but NEVER to CAPI — primary EMQ drag |
| Deduplication | WARN | Double PageView on initial load (different eventIDs) |
| CAPI Relay | WARN | Doesn't forward fn/ln/address; token in URL query string |
| Cookie Consent | WARN | Both pixel AND CAPI blocked without consent |
| Webhook | WARN | Doesn't extract phone/name/address from order billingInfo |
| Parameters | WARN | InitiateCheckout missing content_ids, num_items; Search fires twice |

### Issues

**M1 (FAIL) — firstName/lastName never sent via CAPI**
`MetaPixel.tsx` reads fn/ln from member data for pixel-side advanced matching (`fbq('init',...)`), but `setMetaUserData()` in `meta-track.ts` doesn't accept fn/ln, the relay endpoint doesn't accept them, and they're never forwarded to `sendCapiEvent()`. This mismatch is the primary drag on EMQ score.
- File: `src/lib/meta-track.ts` (line 26-34 — `setMetaUserData` missing fn/ln)
- File: `src/app/api/meta/capi/route.ts` (doesn't accept fn/ln in body)
- File: `src/lib/meta-capi.ts` (already supports fn/ln in UserData interface — just needs to receive them)
- Estimated impact: +1-2 EMQ points

**M2 (HIGH) — Double PageView on initial load**
`MetaPixel.tsx` fires PageView in the inline `<Script>` block (line 121) AND again in a `useEffect` (line 98). Both have different eventID values, so Meta counts them as 2 separate PageViews. Inflates PageView counts by ~2x on every fresh page load.
- File: `src/components/MetaPixel.tsx` (lines 98, 121)

**M3 (WARN) — Webhook missing user data from order**
The Wix order object has `billingInfo`/`shippingInfo` with full name, phone, and address. The webhook only extracts email and member/visitor ID. Sending these additional fields would significantly improve CAPI match quality for Purchase events.
- File: `src/app/api/webhooks/wix-order/route.ts`
- Available fields: `order.billingInfo.contactDetails.firstName/lastName/phone`, `order.billingInfo.address.city/subdivision/postalCode/country`

**M4 (WARN) — InitiateCheckout missing parameters**
Cart checkout fires `trackMetaEvent("InitiateCheckout", { currency: "HKD", value: subtotalNum })` but doesn't include `content_ids`, `num_items`, or `content_type`. Express/PayPal also missing `value`.
- File: `src/app/cart/page.tsx` (line 278)
- File: `src/app/products/[slug]/ExpressCheckout.tsx` (line 132)
- File: `src/app/products/[slug]/PayPalCheckout.tsx` (line 56)

**M5 (WARN) — AddPaymentInfo not implemented**
Standard Meta e-commerce event fired when user enters payment details. Not tracked anywhere.

**M6 (WARN) — Search fires twice per query**
`SearchClient.tsx` useEffect depends on `[query, data]`, causing the Search event to fire when query changes AND when data arrives.
- File: `src/app/search/SearchClient.tsx`

**M7 (WARN) — Access token in URL query string**
`meta-capi.ts` passes the access token as a URL parameter. Should use Authorization header for security.
- File: `src/lib/meta-capi.ts` (line 99)

**M8 (WARN) — Cookie consent blocks CAPI**
When consent is not given, `trackMetaEvent()` still fires CAPI via the relay (the function doesn't check consent). BUT the pixel isn't loaded, so no `_fbc`/`_fbp` cookies exist, degrading match quality. The webhook fires regardless (server-to-server).

---

## 3. VERCEL ANALYTICS

### Ratings

| Area | Rating | Finding |
|------|--------|---------|
| Setup | PASS | Correctly outside cookie consent gate |
| Custom Events | PASS | 27 event types, consistent snake_case |
| Coverage Gaps | WARN | login/signup missing from auth callback |
| Property Completeness | WARN | purchase missing currency; add_to_cart missing price |
| User Identity | WARN | resetUserIdentity() not called in auth callback |
| Performance | PASS | No concerns |
| Limitations | WARN | 5-property limit exceeded on enriched events |

### Issues

**V1 (WARN) — Login/signup events missing**
Auth callback fires events to Meta and Clarity but NOT Vercel Analytics. Every other user action is tracked.
- File: `src/app/auth/callback/page.tsx`

**V2 (WARN) — 5-property limit exceeded**
`trackAnalytics()` auto-attaches `user_id` and `user_type` (2 props). Events with 4+ explicit properties exceed Vercel's 5-property limit. Affected: `purchase` (4 props + 2 = 6), `add_to_cart` (4 props + 2 = 6). Extra properties are silently dropped.
- File: `src/lib/analytics.ts` (line 82-87 — auto-attach)

**V3 (WARN) — Purchase missing currency**
The store supports HKD/USD/GBP/EUR via RegionSelector, but `purchase` event doesn't include currency.
- File: `src/app/order-confirmation/page.tsx`

**V4 (WARN) — Inconsistent total type**
Express checkout sends `total` as string, cart checkout sends as float. Causes inconsistent dashboard filtering.
- File: `src/app/order-confirmation/page.tsx` (lines 44 vs 139)

**V5 (WARN) — add_to_cart missing price**
Price is available in the component but not included in the analytics call.
- File: `src/app/products/[slug]/AddToCartButton.tsx`

---

## 4. SEO

### Ratings

| Area | Rating | Finding |
|------|--------|---------|
| Metadata | PASS | Every page type has title, description, canonical |
| Open Graph | WARN | Homepage missing og:image; products use type "website" not "product" |
| Structured Data | PASS | Product + BreadcrumbList + Organization JSON-LD |
| Sitemap | PASS | Dynamic from Wix API, excludes out-of-stock |
| Robots.txt | PASS | Correct config, references sitemap |
| Hreflang | WARN | Only on root layout, always points to homepage (no-op) |
| Canonical URLs | PASS | Set on every page |
| Redirects | PASS | Old Wix URLs redirected |
| Core Web Vitals | WARN | No next/image — missing WebP/AVIF, no srcset |
| Missing Elements | FAIL | Several missing schemas and configurations |

### Issues

**S1 (FAIL) — Organization logo is favicon**
Google requires minimum 112x112px for Organization schema logo. Favicon is typically 32x32.
- File: `src/app/layout.tsx`

**S2 (FAIL) — Search result pages are indexable**
Search pages with query params are indexed by Google, creating thin/duplicate content. Should be `noindex`.
- File: `src/app/search/page.tsx` or layout metadata

**S3 (FAIL) — No WebSite schema with SearchAction**
Missing sitelinks search box opportunity in Google SERPs.
- File: `src/app/layout.tsx` or `src/app/page.tsx`

**S4 (WARN) — Homepage missing og:image**
Social sharing produces imageless preview. Needs a default brand image.
- File: `src/app/page.tsx` or `src/app/layout.tsx`

**S5 (WARN) — Product OG type is "website" not "product"**
Product pages inherit `type: "website"` from root layout instead of using `type: "product"` with price/currency tags.
- File: `src/app/products/[slug]/page.tsx`

**S6 (WARN) — No CollectionPage/ItemList JSON-LD**
Collection pages have no structured data for the product list.
- File: `src/app/collections/[slug]/page.tsx`

**S7 (WARN) — Hreflang is a no-op**
Hreflang tags are only in root layout and always point to the homepage URL regardless of current page. Since this is a single-language site, hreflang provides no value in current form.
- File: `src/app/layout.tsx`

**S8 (WARN) — No next/image anywhere**
All images use raw `<img>` tags. Missing automatic WebP/AVIF conversion, responsive srcset, and built-in CLS prevention. Wix image service handles resizing but not format negotiation.

---

## Cross-Cutting Issues

**X1 — Cookie consent architecture**
Both Clarity and Meta are blocked entirely by `CookieConsent.tsx`. Both products offer consent APIs that allow loading unconditionally with cookieless/limited mode. Adopting these would recover significant data from non-consented users.

**X2 — Auth callback tracking incomplete**
`src/app/auth/callback/page.tsx` fires Meta + Clarity events but NOT Vercel Analytics. Should fire all three consistently.

**X3 — Double PageView**
Inflates counts in Meta (pixel + CAPI fire twice with different eventIDs on initial load).

---

## Priority Matrix

### Critical (Revenue Impact)
- M1: Add fn/ln to CAPI pipeline (EMQ +1-2 points)
- M2: Fix double PageView
- M3: Enrich webhook with order billing data

### High (Data Quality)
- C1: Adopt Clarity Consent API V2
- M4: Add content_ids/num_items to InitiateCheckout
- V2: Fix 5-property limit on enriched events
- S2: Noindex search pages

### Medium (Completeness)
- C2: Change Clarity to afterInteractive
- M5: Add AddPaymentInfo event
- M6: Fix Search double-fire
- V1: Add login/signup to Vercel Analytics
- S1: Fix Organization logo
- S4: Add default OG image

### Low (Polish)
- C4: Pass pathname as Clarity page ID
- C5: Add missing Clarity events
- M7: Move access token to Authorization header
- S3: Add WebSite schema with SearchAction
- S5: Product OG type
- S6: CollectionPage JSON-LD
