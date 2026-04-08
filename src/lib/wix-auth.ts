import { getBrowserWixClient, resetClient } from "./wix-browser-client";

const OAUTH_DATA_KEY = "wix_oauth_data";
const TOKENS_KEY = "wix_tokens";

/**
 * Start the Wix OAuth login flow.
 * Generates PKCE data, stores it in sessionStorage, and redirects to Wix login page.
 */
export async function startLogin() {
  const wix = getBrowserWixClient();
  // Must use window.location.origin (not NEXT_PUBLIC_SITE_URL) because
  // OAuth PKCE data is stored in sessionStorage on the current origin.
  // A different origin would lose the sessionStorage data after redirect.
  const redirectUri = `${window.location.origin}/auth/callback`;

  const oauthData = wix.auth.generateOAuthData(redirectUri, window.location.href);
  sessionStorage.setItem(OAUTH_DATA_KEY, JSON.stringify(oauthData));

  const { authUrl } = await wix.auth.getAuthUrl(oauthData);
  window.location.href = authUrl;
}

/**
 * Handle the OAuth callback after Wix redirects back.
 * Exchanges the auth code for member tokens and persists them.
 */
export async function handleCallback(): Promise<{ success: boolean; error?: string }> {
  const wix = getBrowserWixClient();

  const raw = sessionStorage.getItem(OAUTH_DATA_KEY);
  if (!raw) {
    return { success: false, error: "Missing OAuth data. Please try signing in again." };
  }

  const oauthData = JSON.parse(raw);
  const { code, state, error, errorDescription } = wix.auth.parseFromUrl();

  if (error) {
    return { success: false, error: errorDescription || error };
  }

  try {
    const tokens = await wix.auth.getMemberTokens(code, state, oauthData);
    wix.auth.setTokens(tokens);
    localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    sessionStorage.removeItem(OAUTH_DATA_KEY);
    window.dispatchEvent(new Event("auth-changed"));
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Authentication failed." };
  }
}

/**
 * Log the member out — clears tokens and resets the client singleton.
 */
export async function startLogout() {
  const wix = getBrowserWixClient();

  try {
    const { logoutUrl } = await wix.auth.logout(window.location.href);
    localStorage.removeItem(TOKENS_KEY);
    resetClient();
    window.dispatchEvent(new Event("auth-changed"));
    window.location.href = logoutUrl;
  } catch {
    // If logout URL fails, still clear local state
    localStorage.removeItem(TOKENS_KEY);
    resetClient();
    window.dispatchEvent(new Event("auth-changed"));
    window.location.href = "/account";
  }
}

/**
 * Check if the current user is a logged-in member (not just a visitor).
 */
export function isLoggedIn(): boolean {
  try {
    const wix = getBrowserWixClient();
    return wix.auth.loggedIn();
  } catch {
    return false;
  }
}
