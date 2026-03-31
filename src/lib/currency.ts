/**
 * Centralized currency display logic.
 * All price formatting goes through here.
 * Reads user preference from localStorage (set by RegionSelector).
 */

const STORAGE_KEY_CURRENCY = "display_currency";
const STORAGE_KEY_RATE = "display_currency_rate";
const STORAGE_KEY_SYMBOL = "display_currency_symbol";

export interface DisplayCurrencyInfo {
  currency: string;
  rate: number;
  symbol: string;
}

const DEFAULT: DisplayCurrencyInfo = { currency: "HKD", rate: 1, symbol: "HK$" };

/**
 * Read the user's display currency preference from localStorage.
 */
export function getDisplayCurrency(): DisplayCurrencyInfo {
  if (typeof window === "undefined") return DEFAULT;
  return {
    currency: localStorage.getItem(STORAGE_KEY_CURRENCY) || "HKD",
    rate: parseFloat(localStorage.getItem(STORAGE_KEY_RATE) || "1"),
    symbol: localStorage.getItem(STORAGE_KEY_SYMBOL) || "HK$",
  };
}

/**
 * Whether the user has selected a non-HKD display currency.
 */
export function isConverted(info: DisplayCurrencyInfo): boolean {
  return info.currency !== "HKD" && info.rate !== 1;
}

/**
 * Format an amount in HKD (the store's base currency).
 */
export function formatHKD(amount: number, decimals = 0): string {
  return `HK$${amount.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/**
 * Format an HKD amount in the user's display currency.
 * If the user hasn't changed currency, returns HKD formatting.
 */
export function formatPrice(hkdAmount: number, info: DisplayCurrencyInfo, decimals = 0): string {
  if (!isConverted(info)) return formatHKD(hkdAmount, decimals);
  const converted = hkdAmount * info.rate;
  return `${info.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/**
 * Format with both currencies: primary (display) + secondary (HKD).
 * Returns null secondary if display IS HKD.
 */
export function formatDual(hkdAmount: number, info: DisplayCurrencyInfo): { primary: string; secondary: string | null } {
  const hkd = formatHKD(hkdAmount, 2);
  if (!isConverted(info)) return { primary: hkd, secondary: null };
  return { primary: formatPrice(hkdAmount, info), secondary: hkd };
}
