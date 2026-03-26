# Analytics & User Tracking Analysis — SolitaireC

## Executive Summary

SolitaireC currently has **zero analytics or event tracking**. No GA4, no pixels, no custom events, no server-side tracking. The Wix SDK includes `@wix/analytics` (v1.15.0) and `@wix/consent-policy-manager` (v1.15.0) as transitive dependencies, but neither works in a headless setup — they depend on `window.wixAnalytics` and `window.consentPolicyManager` globals only injected on Wix-hosted sites.

**Recommendation:** Build a custom event bus abstraction (`src/lib/analytics.ts`) with platform adapters (GA4, Meta Pixel, PostHog). Start with GA4 (free), add ad pixels only if running campaigns, and use Wix webhooks for server-side purchase tracking.

---

## Current State: Nothing Exists

Every file was audited. The only grep hits for "tracking" in the codebase are Tailwind CSS `tracking-[0.15em]` letter-spacing classes — zero actual analytics code. No `gtag`, no `fbq`, no custom event dispatching.

---

## Wix SDK Limitations for Headless

| Package | Status | Issue |
|---------|--------|-------|
| `@wix/analytics` | **Unusable** | Relies on `window.wixAnalytics` / `window.wixDevelopersAnalytics` globals — not injected in headless |
| `@wix/consent-policy-manager` | **Unusable** | Relies on `window.consentPolicyManager` — not injected in headless |

**We must build our own dispatch layer and consent management.**

---

## Critical Gap: Checkout Tracking

Since checkout redirects to Wix-hosted pages (`wix.checkout.getCheckoutUrl()`), we **lose client-side tracking** between `begin_checkout` and `purchase`. The only way to track mid-checkout steps and purchases is via **Wix webhooks** received at a Next.js API route.

---

## Event Taxonomy

### P0 — Critical (must-have for basic analytics)

| Event | Trigger Location | GA4 Equivalent | Data Payload |
|-------|-----------------|----------------|--------------|
| `page_view` | `src/app/layout.tsx` (route change) | `page_view` | `page_path`, `page_title` |
| `view_item` | `src/app/products/[slug]/page.tsx` | `view_item` | `item_id`, `item_name`, `price`, `category` |
| `add_to_cart` | Cart add button components | `add_to_cart` | `item_id`, `item_name`, `price`, `quantity`, `variant` |
| `remove_from_cart` | Cart remove button | `remove_from_cart` | `item_id`, `item_name`, `price`, `quantity` |
| `view_cart` | Cart page / drawer open | `view_cart` | `items[]`, `cart_total` |
| `begin_checkout` | Checkout initiation | `begin_checkout` | `items[]`, `cart_total`, `coupon` |
| `purchase` | **Wix webhook** (server-side only) | `purchase` | `transaction_id`, `value`, `items[]`, `shipping`, `tax` |
| `login` | `src/lib/wix-auth.ts` callback | `login` | `method` (wix_oauth) |

### P1 — Important (conversion optimization)

| Event | Trigger Location | GA4 Equivalent | Data Payload |
|-------|-----------------|----------------|--------------|
| `view_item_list` | Collection/category pages | `view_item_list` | `list_name`, `items[]` |
| `select_item` | Product card click | `select_item` | `item_id`, `item_name`, `list_name` |
| `sign_up` | Registration flow | `sign_up` | `method` |
| `search` | Search input | `search` | `search_term` |
| `select_promotion` | Banner/promo click | `select_promotion` | `promotion_id`, `promotion_name` |

### P2 — Enhanced (engagement & UX insights)

| Event | Trigger Location | Data Payload |
|-------|-----------------|--------------|
| `variant_select` | Size/color picker | `item_id`, `variant_type`, `variant_value` |
| `image_zoom` | Product image gallery | `item_id`, `image_index` |
| `filter_apply` | Collection filter UI | `filter_type`, `filter_value` |
| `sort_change` | Collection sort UI | `sort_by`, `sort_order` |
| `scroll_depth` | All pages | `page_path`, `depth_percent` |
| `nav_click` | `src/components/NavigationDrawer.tsx` | `nav_item`, `nav_position` |
| `share` | Share button (if implemented) | `item_id`, `method` |

---

## Wix Webhooks Inventory

Available webhooks for headless e-commerce tracking:

| Webhook | Use Case | Key Data |
|---------|----------|----------|
| `wix.ecom.v2.order.created` | **Purchase tracking** | Order ID, items, totals, customer |
| `wix.ecom.v2.order.updated` | Fulfillment tracking | Order status changes |
| `wix.ecom.v2.order.cancelled` | Refund tracking | Cancellation reason |
| `wix.ecom.v2.cart.created` | Cart abandonment | Cart ID, items |
| `wix.ecom.v2.cart.updated` | Cart changes (server-side) | Updated items, totals |
| `wix.ecom.v2.checkout.created` | Checkout funnel entry | Checkout ID, items |
| `wix.members.v1.member.created` | Registration tracking | Member ID, email |
| `wix.members.v1.member.updated` | Profile changes | Updated fields |

**Subscription:** Configure via Wix Dashboard → Developer Tools → Webhooks, pointing to `https://yourdomain.com/api/webhooks/wix`

---

## Platform Comparison

| Platform | Cost | E-commerce Events | Session Replay | Funnels | Data Ownership | Setup Effort |
|----------|------|-------------------|----------------|---------|---------------|--------------|
| **GA4** | Free | Native support | No | Basic | Google-owned | Low |
| **PostHog** | Free tier (1M events) | Via custom events | Yes | Advanced | Self-hostable | Medium |
| **Mixpanel** | Free tier (20M events) | Via custom events | No | Advanced | Cloud | Medium |
| **Meta Pixel** | Free | Limited | No | No | Meta-owned | Low |
| **Custom** | Server costs | Full control | No | Build yourself | Full ownership | High |

**Recommendation:** GA4 first (free, standard), then PostHog for session replay and deeper funnels.

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────┐
│                    Browser                       │
│                                                  │
│  Components → useAnalytics() → Event Bus        │
│                                    │             │
│                          ┌─────────┼──────────┐  │
│                          ▼         ▼          ▼  │
│                       GA4       Meta      PostHog│
│                      (gtag)    (fbq)     (posthog)│
│                                                  │
│  Consent Banner ─── gates all dispatching        │
└──────────────────────────┬───────────────────────┘
                           │
┌──────────────────────────┼───────────────────────┐
│                    Server                        │
│                                                  │
│  /api/webhooks/wix ← Wix Webhooks               │
│         │                                        │
│         ▼                                        │
│  GA4 Measurement Protocol                        │
│  (server-side purchase, checkout events)         │
│                                                  │
│  /api/events ← Beacon API (batched client events)│
│         │                                        │
│         ▼                                        │
│  Server-side forwarding (Meta CAPI, etc.)        │
└──────────────────────────────────────────────────┘
```

### Key Files to Create

| File | Purpose |
|------|---------|
| `src/lib/analytics.ts` | Event bus: `trackEvent()`, `registerHandler()`, consent gating |
| `src/lib/analytics/ga4.ts` | GA4 adapter (gtag wrapper) |
| `src/lib/analytics/meta.ts` | Meta Pixel adapter |
| `src/lib/analytics/posthog.ts` | PostHog adapter |
| `src/hooks/useAnalytics.ts` | React hook for components |
| `src/components/ConsentBanner.tsx` | Cookie consent UI |
| `src/app/api/webhooks/wix/route.ts` | Wix webhook receiver |
| `src/app/api/events/route.ts` | Client event batch receiver |

### Event Bus Pattern

```typescript
// src/lib/analytics.ts (conceptual)
type EventHandler = (event: string, data: Record<string, any>) => void;

const handlers: EventHandler[] = [];
let consentGranted = false;

export function registerHandler(handler: EventHandler) {
  handlers.push(handler);
}

export function trackEvent(event: string, data: Record<string, any>) {
  if (!consentGranted) return; // or queue for later
  handlers.forEach(h => h(event, data));
}

export function setConsent(granted: boolean) {
  consentGranted = granted;
}
```

---

## Session & Identity Stitching

| Scenario | Approach |
|----------|----------|
| Anonymous browsing | GA4 auto-generates `client_id` via cookie |
| Login | Set `user_id` in GA4 config from Wix member ID (in `src/lib/wix-auth.ts` `handleCallback`) |
| Logout | Clear `user_id`, new anonymous session continues |
| Cross-device | GA4 `user_id` links sessions across devices post-login |
| Wix webhook → GA4 | Include `client_id` (from cookie) in checkout URL params, forward in Measurement Protocol |

---

## Performance Considerations

| Technique | Purpose |
|-----------|---------|
| `defer` / `async` on gtag script | Don't block initial render |
| `navigator.sendBeacon()` | Fire-and-forget for page unload events |
| Event batching | Collect events, flush every 5s or on page leave |
| Web Worker (Phase 6) | Move PostHog heavy lifting off main thread |
| Conditional loading | Only load Meta Pixel if consent granted + ad campaigns active |
| `next/script strategy="afterInteractive"` | Load analytics after hydration |

---

## Privacy & Consent Requirements

| Requirement | Implementation |
|-------------|---------------|
| Cookie consent banner | Custom `ConsentBanner.tsx` — show before any tracking fires |
| GDPR (EU users) | Opt-in required before analytics cookies. Queue events until consent. |
| Essential vs analytics cookies | Separate consent categories (essential, analytics, marketing) |
| Data retention | Configure GA4 retention (14 months default, adjustable) |
| User data deletion | Wix member deletion webhook → GA4 User Deletion API |
| Cookie policy page | Link from consent banner to `/privacy` page |

---

## Implementation Roadmap

### Phase 1 — Core Analytics (2-3 days)
- Create event bus (`src/lib/analytics.ts`)
- GA4 adapter + script loading
- Instrument P0 events: `page_view`, `view_item`, `add_to_cart`, `remove_from_cart`, `view_cart`, `begin_checkout`
- Identity: set `user_id` on login

### Phase 2 — Consent & Identity (2 days)
- Cookie consent banner component
- Consent-gated event dispatching (queue → flush on accept)
- Privacy policy page
- Consent preference persistence (localStorage + cookie)

### Phase 3 — Server-Side Purchase Tracking (2-3 days)
- Wix webhook receiver (`/api/webhooks/wix`)
- Webhook signature verification
- GA4 Measurement Protocol forwarding for `purchase` events
- Order confirmation event correlation

### Phase 4 — Enhanced Tracking (2 days)
- P1 events: `view_item_list`, `select_item`, `search`, `sign_up`
- P2 events: `variant_select`, `filter_apply`, `sort_change`
- Navigation and scroll depth tracking

### Phase 5 — Ad Pixels (1 day, conditional)
- Meta Pixel adapter (only if running Facebook/Instagram ads)
- TikTok Pixel adapter (only if running TikTok ads)
- Meta Conversions API (server-side deduplication)

### Phase 6 — Advanced (3-5 days)
- PostHog integration (session replay, advanced funnels)
- Event batching with `navigator.sendBeacon()`
- Web Worker for heavy analytics processing
- `/api/events` batch endpoint for server-side forwarding

**Total estimated effort: 12-16 days across all phases.**
**Phase 1 alone gives you basic e-commerce analytics with GA4 in 2-3 days.**
