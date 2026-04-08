# Attribution Fix Plan — Purchase, Auth, and Event Coverage

**Date:** 2026-04-08 (updated Apr 9)
**Branch:** feature/attribution-problem
**Priority:** Critical — affects Meta campaign optimization

---

## Problem Summary

After migrating from Wix hosted to headless Next.js, multiple Meta events are broken or fragile. The core problem: any user action that involves Wix hosted pages (checkout at shop.solitairec.com, login, signup) loses attribution because our tracking code only runs on solitairec.com.

**Clarity:** Smart events are working (delayed tagging in dashboard, not a code issue).

**Meta events broken/missing:**

| Event | Integration | Status | Problem |
|-------|------------|--------|---------|
| Purchase | Multiple | Fragile | Only fires if user returns to `/order-confirmation`. No server-side fallback for cart checkout. |
| WixOrderPlaced | Meta Pixel only | Dead (7d ago) | Only existed in Wix's native pixel. Never implemented in custom code. |
| Sign up Success | Meta Pixel only | Dead (7d ago) | Only from Wix's native pixel. Not in our code. |
| Complete registration | Meta Pixel only | Dead (17d ago) | Same — Wix native only. |
| Lead | Multiple | Dead (8d ago) | Not fired from our code. |
| Add payment info | Multiple | Works (1d ago) | From Wix checkout page, not our code. |
| Search | Meta Pixel only | Works but no CAPI | `trackMetaEvent("Search")` fires pixel+CAPI but CAPI not appearing in Events Manager. |

Events working fine: PageView, ViewContent, AddToCart, InitiateCheckout.

---

## Root Cause Analysis

### 1. Cart checkout Purchase depends entirely on client-side redirect (fragile)

Purchase event for cart checkout ONLY fires on `solitairec.com/order-confirmation` (`src/app/order-confirmation/page.tsx:115`). If user never reaches this page (stays on shop.solitairec.com, signs up there, closes browser), NOTHING fires.

Stripe/PayPal work reliably because they fire CAPI server-side from their API routes BEFORE any redirect.

### 2. Three places use `window.location.origin` for Wix redirect callbacks

- `src/app/cart/page.tsx:298` — checkout redirect
- `src/app/gift-cards/GiftCardForm.tsx:138` — gift card checkout
- `src/lib/wix-auth.ts:12` — OAuth login/signup redirect

If Wix overrides these or user ends up on shop.solitairec.com, the callback URL points to the wrong domain.

### 3. Auth events never implemented in custom code

Sign up Success, Complete registration, and Log in Success only existed in Wix's native pixel (which fires on Wix's hosted auth pages). Our custom code fires zero auth-related Meta events. The Wix native pixel is effectively dead since migration.

### 4. WixOrderPlaced never implemented

Same as auth events — only existed in Wix's native pixel.

### 5. No idempotency on order-confirmation page

Refreshing fires Purchase again. No dedup guard.

---

## Fix Plan (7 changes, ordered by impact)

### Fix 1: Wix Webhook for Server-Side Purchase (CRITICAL)

**Why:** Only way to guarantee Purchase fires for every cart checkout order.

**Create** `src/app/api/webhooks/wix-order/route.ts`:
- Accept POST from Wix webhook (`ecom/v1/orders/approved`)
- Validate webhook signature
- Extract order data: total, currency, line items, buyer email, order number
- Fire `sendCapiEvent("Purchase", ...)` from `src/lib/meta-capi.ts`
- Also fire `sendCapiEvent("WixOrderPlaced", ...)` — restores the dead event
- Use deterministic eventId: `createHash('sha256').update('purchase-' + orderId).digest('hex').slice(0, 36)` — enables dedup with client-side
- Skip Stripe/PayPal orders (already have CAPI coverage)
- Set `action_source: "website"`, `event_source_url: "https://solitairec.com/order-confirmation"`

**Env vars:** `WIX_WEBHOOK_SECRET`

**Wix Dashboard:** Developer Tools > Webhooks > Add `ecom/v1/orders/approved` → `https://solitairec.com/api/webhooks/wix-order`

### Fix 2: Fix ALL Redirect URLs (Quick Win)

Use `NEXT_PUBLIC_SITE_URL` instead of `window.location.origin`:

**Modify** `src/app/cart/page.tsx` lines 298-299:
```js
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
thankYouPageUrl: `${siteUrl}/order-confirmation`,
postFlowUrl: `${siteUrl}/cart`,
```

**Modify** `src/app/gift-cards/GiftCardForm.tsx` lines 138-139: Same.

**Modify** `src/lib/wix-auth.ts` line 12:
```js
const redirectUri = `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`;
```

### Fix 3: Fire Auth Events (Sign up Success, Login Success)

**Modify** `src/app/auth/callback/page.tsx`:
After successful `handleCallback()`, detect new signup vs returning login:
- Check `member._createdDate` — if within last 2 minutes, it's a new signup
- New signup → fire `trackMetaEvent("CompleteRegistration", { status: true })` + `clarityEvent("sign_up_success")`
- All auth → fire `trackMetaEvent("Lead", {}, email, memberId)`

**Modify** `src/app/account/page.tsx` lines 1005-1007:
- Add `trackMetaEvent("Lead", {})` before `startLogin()` call

### Fix 4: Deterministic EventId + Cookie Preservation + Idempotency

**Modify** `src/lib/meta-track.ts`:
- Add optional `eventId` param to `trackMetaEvent()`
- Add optional `fbc`/`fbp` params to pass to CAPI relay

**Modify** `src/app/cart/page.tsx`:
- Before redirect, save `_fbc`/`_fbp` cookies to sessionStorage

**Modify** `src/app/order-confirmation/page.tsx`:
- Compute deterministic eventId from order ID (same hash as webhook)
- Read stored `_fbc`/`_fbp` from sessionStorage
- Add idempotency: `sessionStorage.getItem('tracked_purchase_' + orderId)` → skip if present

**Modify** `src/app/api/meta/capi/route.ts`:
- Accept optional `fbc`/`fbp` body overrides

### Fix 5: Clarity Event Queue (Lower Priority)

**Modify** `src/lib/clarity.ts`:
- Buffer calls when `window.clarity` is undefined, flush on next available call

**Modify** `src/components/Clarity.tsx`:
- Change `strategy="lazyOnload"` to `strategy="afterInteractive"`
- Reduce identify setTimeout from 600ms to 100ms

### Fix 6: Investigate Search CAPI

Events Manager shows Search as "Meta Pixel" only (no CAPI).
- Add temporary logging in `/api/meta/capi/route.ts` for Search events
- Verify the CAPI response status

### Fix 7: Sign-Up Button on solitairec.com

**Modify** `src/app/account/page.tsx`:
- Rename "Sign In" → "Sign In / Create Account" or add separate button
- Both call `startLogin()` (Wix OAuth has signup built in)
- Check if Wix SDK supports `prompt: "signup"` to default to signup view

---

## Files Summary

| File | Action | Fixes |
|------|--------|-------|
| `src/app/api/webhooks/wix-order/route.ts` | CREATE | #1 |
| `src/lib/wix-auth.ts` | MODIFY (redirect URL) | #2 |
| `src/app/cart/page.tsx` | MODIFY (redirect URL + save cookies) | #2, #4 |
| `src/app/gift-cards/GiftCardForm.tsx` | MODIFY (redirect URL) | #2 |
| `src/app/auth/callback/page.tsx` | MODIFY (fire auth events) | #3 |
| `src/app/account/page.tsx` | MODIFY (Lead event + signup button) | #3, #7 |
| `src/app/order-confirmation/page.tsx` | MODIFY (deterministic eventId, idempotency, stored cookies) | #4 |
| `src/lib/meta-track.ts` | MODIFY (optional eventId + fbc/fbp params) | #4 |
| `src/app/api/meta/capi/route.ts` | MODIFY (accept fbc/fbp body overrides) | #4 |
| `src/lib/clarity.ts` | MODIFY (event queue) | #5 |
| `src/components/Clarity.tsx` | MODIFY (strategy + delay) | #5 |
| `.env.local` | ADD `WIX_WEBHOOK_SECRET` | #1 |

---

## Wix Dashboard Changes (not code)

1. **Webhooks**: Developer Tools > Webhooks > Add `ecom/v1/orders/approved` → `https://solitairec.com/api/webhooks/wix-order`
2. **OAuth**: Settings > OAuth Apps > Verify only `https://solitairec.com/auth/callback` is registered. Remove `shop.solitairec.com` entries.
3. **Checkout**: Settings > eCommerce > Check default thank-you page URL

---

## Testing Meta Events

### 1. Meta Test Events (Best Method)
Meta Events Manager > Test Events tab > enter `solitairec.com` > "Open Website". Events from that test session show in real-time. Both Pixel and CAPI events visible. Does NOT affect production data.

### 2. Meta Pixel Helper (Chrome Extension)
Shows event count badge per page. Click for event details (name, params, eventID). Only shows browser pixel events, not CAPI.

### 3. CAPI via Vercel Logs
After deploying webhook, check Vercel function logs for `/api/webhooks/wix-order` and `/api/meta/capi`. Look for `[Meta CAPI] Error:` lines. 200 from Meta = accepted.

### 4. Direct CAPI Test
```bash
curl -X POST "https://graph.facebook.com/v21.0/205505954064502/events?access_token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"data":[{"event_name":"TestEvent","event_time":'$(date +%s)',"action_source":"website","event_source_url":"https://solitairec.com","user_data":{"client_ip_address":"1.2.3.4","client_user_agent":"test"}}]}'
```
Returns `{"events_received":1}` if token is valid. (This is how the existing "TestEvent" entries were created.)

### 5. Dedup Verification
Meta Events Manager > Purchase > View Details > check "Overlap" section for deduplicated events.

### 6. End-to-End
1. Open Meta Test Events session
2. Browse product → verify ViewContent
3. Add to cart → verify AddToCart
4. Checkout → verify InitiateCheckout fires before redirect
5. Complete Wix checkout → verify Purchase from webhook (CAPI)
6. Check order-confirmation page → verify Purchase dedup
7. Sign up → verify CompleteRegistration in callback

---

## Why Events Are Fragile Today

Purchase only fires when ALL of these are true simultaneously:
1. User accepted cookie consent → MetaPixel loads
2. Wix redirected back to solitairec.com/order-confirmation after checkout
3. Order-confirmation page fetched order from Wix API successfully
4. Order was created within last 5 minutes (recency filter at line 86)

If ANY fails, attribution is lost. The webhook (Fix 1) eliminates dependency on all 4 conditions.
