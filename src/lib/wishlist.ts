import type { createClient } from "@wix/sdk";

const STORAGE_KEY = "solitairec_wishlist";

type WixClient = ReturnType<typeof createClient>;

// ---------------------------------------------------------------------------
// localStorage (fast local cache)
// ---------------------------------------------------------------------------

function load(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("wishlist-updated"));
}

export function getWishlistIds(): string[] {
  return load();
}

export function isInWishlist(productId: string): boolean {
  return load().includes(productId);
}

export function addToWishlist(productId: string) {
  const ids = load();
  if (!ids.includes(productId)) {
    save([...ids, productId]);
  }
  syncAddToWix(productId);
}

export function removeFromWishlist(productId: string) {
  save(load().filter((id) => id !== productId));
  syncRemoveFromWix(productId);
}

export function toggleWishlist(productId: string): boolean {
  if (isInWishlist(productId)) {
    removeFromWishlist(productId);
    return false;
  } else {
    addToWishlist(productId);
    return true;
  }
}

// ---------------------------------------------------------------------------
// Wix wishlist API (server-persisted, member-only)
// ---------------------------------------------------------------------------

/**
 * Fetch the member's Wix-backed wishlist and return product IDs.
 */
export async function fetchWixWishlist(wix: WixClient): Promise<string[]> {
  try {
    const res = await wix.fetchWithAuth(
      `${window.location.origin}/_api/wishlist-server/v1/wishlists/get`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100, offset: 0 }),
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.wishlist?.items ?? [])
      .filter((item: { type?: string }) => item.type === "product")
      .map((item: { _id?: string }) => item._id)
      .filter(Boolean) as string[];
  } catch {
    return [];
  }
}

/**
 * Add a product to the Wix-backed wishlist.
 */
async function addToWixWishlist(wix: WixClient, productId: string) {
  await wix.fetchWithAuth(
    `${window.location.origin}/_api/wishlist-server/v1/wishlists/add`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ _id: productId, type: "product", origin: "wixstores" }],
      }),
    }
  );
}

/**
 * Remove a product from the Wix-backed wishlist.
 */
async function removeFromWixWishlist(wix: WixClient, productId: string) {
  await wix.fetchWithAuth(
    `${window.location.origin}/_api/wishlist-server/v1/wishlists/remove`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [{ _id: productId, type: "product", origin: "wixstores" }],
      }),
    }
  );
}

// ---------------------------------------------------------------------------
// Sync helpers
// ---------------------------------------------------------------------------

/** Lazy-import the browser client only when needed (avoids circular deps). */
function getWixIfLoggedIn(): WixClient | null {
  try {
    // Dynamic require to avoid importing browser client at module level
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getBrowserWixClient } = require("./wix-browser-client");
    const wix = getBrowserWixClient();
    if (!wix.auth.loggedIn()) return null;
    return wix;
  } catch {
    return null;
  }
}

/** Fire-and-forget add to Wix when logged in. */
function syncAddToWix(productId: string) {
  const wix = getWixIfLoggedIn();
  if (wix) addToWixWishlist(wix, productId).catch(() => {});
}

/** Fire-and-forget remove from Wix when logged in. */
function syncRemoveFromWix(productId: string) {
  const wix = getWixIfLoggedIn();
  if (wix) removeFromWixWishlist(wix, productId).catch(() => {});
}

/**
 * Merge localStorage wishlist with Wix server wishlist on login.
 * Union of both is saved to localStorage and Wix.
 */
export async function syncWishlistOnLogin(wix: WixClient) {
  const localIds = load();
  const serverIds = await fetchWixWishlist(wix);

  // Union — deduplicated
  const merged = [...new Set([...serverIds, ...localIds])];

  // Items in local but not on server → add to server
  const toAdd = localIds.filter((id) => !serverIds.includes(id));
  for (const id of toAdd) {
    await addToWixWishlist(wix, id).catch(() => {});
  }

  // Save merged set locally
  save(merged);
}
