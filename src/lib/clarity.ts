/**
 * Microsoft Clarity helper — custom tags and events.
 *
 * Tags enrich sessions so you can filter in the Clarity dashboard:
 *   e.g. show me all sessions where cart_value > 500, or user_type = "member"
 *
 * Events mark key moments in the session timeline:
 *   e.g. "add_to_cart", "initiate_checkout" appear as pins on the recording
 */

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

/** Set a custom tag on the current Clarity session (filterable in dashboard). */
export function clarityTag(key: string, value: string | number | boolean): void {
  if (typeof window === "undefined" || !window.clarity) return;
  window.clarity("set", key, String(value));
}

/** Fire a custom Clarity event (appears as a pin on the session recording timeline). */
export function clarityEvent(name: string): void {
  if (typeof window === "undefined" || !window.clarity) return;
  window.clarity("event", name);
}
