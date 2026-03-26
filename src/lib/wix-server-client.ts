import { createClient } from "@wix/sdk";
import { ApiKeyStrategy } from "@wix/sdk/auth/api-key";
import { currentCart, checkout } from "@wix/ecom";
import { products, collections } from "@wix/stores";
import {
  programs as loyaltyPrograms,
  earningRules,
  rewards as loyaltyRewards,
  tiers as loyaltyTiers,
} from "@wix/loyalty";

/**
 * Server-side Wix client — uses API Key auth.
 * ONLY use this in Server Components, API routes, or Server Actions.
 * The API key is never exposed to the browser.
 */
export function getServerWixClient() {
  if (!process.env.WIX_API_KEY || !process.env.WIX_SITE_ID) {
    throw new Error("Missing WIX_API_KEY or WIX_SITE_ID environment variables");
  }

  return createClient({
    modules: {
      products,
      collections,
      currentCart,
      checkout,
      loyaltyPrograms,
      earningRules,
      loyaltyRewards,
      loyaltyTiers,
    },
    auth: ApiKeyStrategy({
      apiKey: process.env.WIX_API_KEY,
      siteId: process.env.WIX_SITE_ID,
    }),
  });
}
