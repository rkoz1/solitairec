import { createClient, OAuthStrategy } from "@wix/sdk";
import { currentCart, checkout, orders, backInStockNotifications } from "@wix/ecom";
import { accounts as loyaltyAccounts, transactions as loyaltyTransactions, coupons as loyaltyCoupons } from "@wix/loyalty";
import { members } from "@wix/members";
import { redirects } from "@wix/redirects";
import { customers as referralCustomers } from "@wix/referral";

let clientInstance: ReturnType<typeof createClient> | null = null;
let visitorTokenPromise: Promise<void> | null = null;

const TOKENS_KEY = "wix_tokens";

/**
 * Browser-side Wix client — singleton with localStorage token persistence.
 * Safe for client components. Handles visitor sessions automatically.
 */
export function getBrowserWixClient() {
  if (clientInstance) return clientInstance;

  const clientId = process.env.NEXT_PUBLIC_WIX_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing NEXT_PUBLIC_WIX_CLIENT_ID environment variable");
  }

  clientInstance = createClient({
    modules: { currentCart, checkout, orders, backInStockNotifications, loyaltyAccounts, loyaltyTransactions, loyaltyCoupons, members, redirects, referralCustomers },
    auth: OAuthStrategy({
      clientId,
      tokens: loadTokens() ?? undefined,
    }),
  });

  return clientInstance;
}

/**
 * Ensure the client has valid visitor tokens.
 * Deduplicates concurrent calls to prevent race conditions.
 */
export async function ensureVisitorTokens(
  client: ReturnType<typeof createClient>
) {
  const tokens = client.auth.getTokens();
  if (tokens.accessToken?.value) return;

  if (!visitorTokenPromise) {
    visitorTokenPromise = client.auth
      .generateVisitorTokens()
      .then(() => {
        saveTokens(client.auth.getTokens());
      })
      .finally(() => {
        visitorTokenPromise = null;
      });
  }

  await visitorTokenPromise;
}

function loadTokens() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Reset the singleton so the next call to getBrowserWixClient()
 * creates a fresh client (e.g. after logout to drop member tokens).
 */
export function resetClient() {
  clientInstance = null;
}

function saveTokens(tokens: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
  } catch {
    // storage full or blocked — ignore
  }
}
