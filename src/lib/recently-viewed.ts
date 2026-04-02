const STORAGE_KEY = "recently_viewed";
const MAX_ITEMS = 10;

export function addRecentlyViewed(productId: string): void {
  try {
    const ids = getRecentlyViewedIds();
    const filtered = ids.filter((id) => id !== productId);
    filtered.unshift(productId);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(filtered.slice(0, MAX_ITEMS))
    );
  } catch {
    // localStorage unavailable
  }
}

export function getRecentlyViewedIds(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch {
    return [];
  }
}
