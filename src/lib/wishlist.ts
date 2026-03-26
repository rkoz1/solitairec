const STORAGE_KEY = "solitairec_wishlist";

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
}

export function removeFromWishlist(productId: string) {
  save(load().filter((id) => id !== productId));
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
