# Known Issues & Recommendations

## KI-001: Orders API 403 after login redirect (intermittent)

**Status:** Parked  
**Severity:** Low (intermittent, non-blocking)  
**Location:** `src/app/account/page.tsx` — `OrdersTab` component (line ~242)

**Symptom:**  
After logging in via Wix OAuth and being redirected from `/auth/callback` to `/account`, `wix.orders.searchOrders()` sometimes returns 403 Forbidden. The error is intermittent — most logins work fine.

**Root cause (suspected):**  
Race condition in the Wix SDK's internal token lifecycle. After `handleCallback()` sets member tokens via `wix.auth.setTokens()`, the access token may not be fully propagated for elevated APIs like `searchOrders` by the time the account page fires the request. `getCurrentMember()` (lower permissions) succeeds, but `searchOrders` needs the token fully settled.

The `ensureVisitorTokens()` call in OrdersTab is a no-op for logged-in members — it sees the access token and returns immediately. It does NOT validate the token or ensure readiness for elevated API calls.

**Impact:**  
- Orders tab shows "No orders yet" on the affected load
- A page refresh resolves it
- Does not affect order-confirmation page (different flow)

**Recommended fixes (in order of preference):**

1. **Retry on 403** — If `searchOrders` fails, wait ~1.5s and retry once. Minimal change, preserves existing auth scoping.

2. **Token warm-up** — Call `getCurrentMember()` before `searchOrders` as a lightweight way to ensure the SDK has completed any internal token refresh.

3. **Server action with API key client** — Move `searchOrders` to a server action using `getServerWixClient()`. More robust (API key never has token propagation issues), but requires explicit `buyerInfo.memberId` filtering and introduces a trust/security concern since the memberId would come from the client.

**Why not fix now:**  
Low frequency, non-blocking, and the simplest fixes (retry/warm-up) need testing to confirm they resolve the Wix SDK timing issue. The server action approach needs careful security design.
