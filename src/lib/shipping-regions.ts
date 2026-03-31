export interface ShippingRegion {
  id: string;
  name: string;
  countries: string[];
  shippingCost: number;
  freeThreshold: number;
  estimatedDelivery: string;
}

export interface ShippingRegionData {
  regions: ShippingRegion[];
  countryToRegionId: Record<string, string>;
  defaultRegionId: string;
}

// Default currency per country (common ones)
export const COUNTRY_CURRENCY: Record<string, string> = {
  HK: "HKD", MO: "MOP", TW: "TWD", CN: "CNY",
  JP: "JPY", KR: "KRW", SG: "SGD", MY: "MYR",
  TH: "THB", PH: "PHP", ID: "IDR", VN: "VND",
  IN: "INR", KH: "USD", AU: "AUD", NZ: "NZD",
  US: "USD", CA: "CAD", GB: "GBP", FR: "EUR",
  DE: "EUR", IT: "EUR", ES: "EUR", NL: "EUR",
  PT: "EUR", BE: "EUR", CH: "CHF", SE: "SEK",
  NO: "NOK", DK: "DKK", IE: "EUR", AT: "EUR",
  AE: "AED", SA: "SAR", IL: "ILS", BR: "BRL",
  MX: "MXN", ZA: "ZAR",
};

export function getRegionForCountry(
  countryCode: string,
  data: ShippingRegionData
): ShippingRegion {
  const regionId = data.countryToRegionId[countryCode];
  if (regionId) {
    const region = data.regions.find((r) => r.id === regionId);
    if (region) return region;
  }
  // Fall back to rest of world
  const row = data.regions.find((r) => r.countries.length === 0);
  if (row) return row;
  return data.regions.find((r) => r.id === data.defaultRegionId) ?? data.regions[0];
}

// ISO 3166 country names for the dropdown
export const COUNTRY_LIST: { code: string; name: string }[] = [
  { code: "HK", name: "Hong Kong" },
  { code: "MO", name: "Macau" },
  { code: "TW", name: "Taiwan" },
  { code: "CN", name: "China" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
  { code: "TH", name: "Thailand" },
  { code: "PH", name: "Philippines" },
  { code: "ID", name: "Indonesia" },
  { code: "VN", name: "Vietnam" },
  { code: "IN", name: "India" },
  { code: "KH", name: "Cambodia" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "PT", name: "Portugal" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "SE", name: "Sweden" },
  { code: "NO", name: "Norway" },
  { code: "DK", name: "Denmark" },
  { code: "IE", name: "Ireland" },
  { code: "AT", name: "Austria" },
  { code: "AE", name: "United Arab Emirates" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "IL", name: "Israel" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "ZA", name: "South Africa" },
];
