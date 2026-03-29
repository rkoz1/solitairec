"use server";

import { getNavCategories, type NavCategory } from "@/lib/collections";
import { getServerWixClient } from "@/lib/wix-server-client";
import { getWixImageUrl } from "@/lib/wix-image";

export async function fetchNavCategories(): Promise<NavCategory[]> {
  return getNavCategories();
}

export interface ColorOption {
  name: string;
  value: string; // hex/rgb
}

export interface CollectionProduct {
  _id: string;
  name: string;
  slug: string;
  price: number;
  formattedPrice: string;
  imageUrl: string;
  sizes: string[];
  colors: ColorOption[];
}

export interface CollectionData {
  name: string;
  slug: string;
  products: CollectionProduct[];
  availableSizes: string[];
  availableColors: ColorOption[];
  priceRange: { min: number; max: number };
}

// Size ordering: standard clothing sizes first, then numeric ascending
const SIZE_ORDER: Record<string, number> = {
  xxs: 1, xs: 2, s: 3, m: 4, l: 5, xl: 6, xxl: 7, xxxl: 8,
  "2xl": 7, "3xl": 8, "4xl": 9,
};

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const aOrder = SIZE_ORDER[a.toLowerCase()] ?? null;
    const bOrder = SIZE_ORDER[b.toLowerCase()] ?? null;
    // Both are named sizes
    if (aOrder !== null && bOrder !== null) return aOrder - bOrder;
    // Named sizes before numeric
    if (aOrder !== null) return -1;
    if (bOrder !== null) return 1;
    // Both numeric
    const aNum = parseFloat(a);
    const bNum = parseFloat(b);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    return a.localeCompare(b);
  });
}

export async function fetchSearchResults(
  query: string,
  sort: "relevance" | "price_asc" | "price_desc" = "relevance"
): Promise<CollectionData | null> {
  const trimmed = query.trim().toLowerCase();
  if (trimmed.length < 2) return null;

  const { getProductCatalog: getCatalog } = await import("@/app/search/actions");
  const catalog = await getCatalog();
  const words = trimmed.split(/\s+/).filter(Boolean);

  type CatProduct = typeof catalog[0];
  let matched: { product: CatProduct; score: number }[] = catalog
    .map((p) => {
      const allMatch = words.every(
        (w) => p.nameLower.includes(w) || p.descriptionLower.includes(w)
      );
      if (!allMatch) return null;
      let score = 0;
      for (const w of words) {
        if (p.nameLower.includes(w)) score += 10;
        if (p.nameLower.startsWith(w)) score += 5;
        if (p.descriptionLower.includes(w)) score += 1;
      }
      return { product: p, score };
    })
    .filter(Boolean) as { product: CatProduct; score: number }[];

  // Sort
  if (sort === "price_asc") {
    matched.sort((a, b) => parseFloat(a.product.price) - parseFloat(b.product.price));
  } else if (sort === "price_desc") {
    matched.sort((a, b) => parseFloat(b.product.price) - parseFloat(a.product.price));
  } else {
    matched.sort((a, b) => b.score - a.score);
  }

  // Now fetch full product data for these IDs to get options (size/color)
  // We'll batch fetch from the Wix API
  const ids = matched.map((m) => m.product._id);
  const wix = getServerWixClient();

  const allSizes = new Set<string>();
  const colorMap = new Map<string, ColorOption>();
  let minPrice = Infinity;
  let maxPrice = 0;

  // Fetch in batches of 50
  const fullProducts: CollectionProduct[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const { items } = await wix.products
      .queryProducts()
      .hasSome("_id", batch)
      .limit(50)
      .find();

    for (const p of items) {
      // Skip out-of-stock products
      const stock = p.stock as { inventoryStatus?: string } | undefined;
      if (stock?.inventoryStatus === "OUT_OF_STOCK") continue;

      const price = p.priceData?.price ?? 0;
      if (price < minPrice) minPrice = price;
      if (price > maxPrice) maxPrice = price;

      const sizes: string[] = [];
      const colors: ColorOption[] = [];

      for (const opt of p.productOptions ?? []) {
        const optName = (opt.name ?? "").toLowerCase();
        for (const choice of opt.choices ?? []) {
          if (optName === "size") {
            const val = choice.description || choice.value || "";
            if (val) { sizes.push(val); allSizes.add(val); }
          } else if (optName === "color" || optName === "colour") {
            const name = choice.description || choice.value || "";
            const value = choice.value || "";
            if (name) {
              const colorOpt = { name, value };
              colors.push(colorOpt);
              if (!colorMap.has(name)) colorMap.set(name, colorOpt);
            }
          }
        }
      }

      fullProducts.push({
        _id: p._id ?? "",
        name: p.name ?? "",
        slug: p.slug ?? "",
        price,
        formattedPrice: p.priceData?.formatted?.price ?? "",
        imageUrl: getWixImageUrl(p.media?.mainMedia?.image?.url, 600, 800),
        sizes,
        colors,
      });
    }
  }

  // Preserve the sort order from the search scoring
  const idOrder = new Map(ids.map((id, idx) => [id, idx]));
  if (sort === "relevance") {
    fullProducts.sort((a, b) => (idOrder.get(a._id) ?? 0) - (idOrder.get(b._id) ?? 0));
  }

  return {
    name: `Search: "${query}"`,
    slug: "",
    products: fullProducts,
    availableSizes: sortSizes([...allSizes]),
    availableColors: [...colorMap.values()],
    priceRange: {
      min: minPrice === Infinity ? 0 : Math.floor(minPrice),
      max: Math.ceil(maxPrice),
    },
  };
}

export async function fetchCollectionProducts(
  slug: string,
  sort: "newest" | "price_asc" | "price_desc" = "newest"
): Promise<CollectionData | null> {
  const wix = getServerWixClient();

  const collectionResult = await wix.collections.getCollectionBySlug(slug);
  const collection = collectionResult.collection;
  if (!collection?._id) return null;

  // Paginate to get all products
  const allItems: unknown[] = [];
  let offset = 0;
  const PAGE_SIZE = 100;

  const sortField =
    sort === "price_asc" ? "price" :
    sort === "price_desc" ? "price" :
    "lastUpdated";
  const sortDir = sort === "price_asc" ? "asc" : "desc";

  while (true) {
    let query = wix.products
      .queryProducts()
      .hasSome("collectionIds", [collection._id])
      .limit(PAGE_SIZE)
      .skip(offset);

    if (sortDir === "asc") query = query.ascending(sortField);
    else query = query.descending(sortField);

    const { items } = await query.find();
    allItems.push(...items);

    if (items.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  type WixProduct = {
    _id?: string | null;
    name?: string | null;
    slug?: string | null;
    priceData?: { price?: number; formatted?: { price?: string | null } | null } | null;
    media?: { mainMedia?: { image?: { url?: string | null } | null } | null } | null;
    productOptions?: { name?: string | null; choices?: { value?: string | null; description?: string | null }[] | null }[] | null;
    stock?: { inventoryStatus?: string } | null;
  };

  const allSizes = new Set<string>();
  const colorMap = new Map<string, ColorOption>(); // name → { name, value }
  let minPrice = Infinity;
  let maxPrice = 0;

  const products: CollectionProduct[] = (allItems as WixProduct[])
  .filter((p) => p.stock?.inventoryStatus !== "OUT_OF_STOCK")
  .map((p) => {
    const price = p.priceData?.price ?? 0;
    if (price < minPrice) minPrice = price;
    if (price > maxPrice) maxPrice = price;

    const sizes: string[] = [];
    const colors: ColorOption[] = [];

    for (const opt of p.productOptions ?? []) {
      const optName = (opt.name ?? "").toLowerCase();
      for (const choice of opt.choices ?? []) {
        if (optName === "size") {
          const val = choice.description || choice.value || "";
          if (val) {
            sizes.push(val);
            allSizes.add(val);
          }
        } else if (optName === "color" || optName === "colour") {
          const name = choice.description || choice.value || "";
          const value = choice.value || "";
          if (name) {
            const colorOpt = { name, value };
            colors.push(colorOpt);
            if (!colorMap.has(name)) colorMap.set(name, colorOpt);
          }
        }
      }
    }

    return {
      _id: p._id ?? "",
      name: p.name ?? "",
      slug: p.slug ?? "",
      price,
      formattedPrice: p.priceData?.formatted?.price ?? "",
      imageUrl: getWixImageUrl(p.media?.mainMedia?.image?.url, 600, 800),
      sizes,
      colors,
    };
  });

  return {
    name: collection.name ?? "",
    slug: collection.slug ?? "",
    products,
    availableSizes: sortSizes([...allSizes]),
    availableColors: [...colorMap.values()],
    priceRange: {
      min: minPrice === Infinity ? 0 : Math.floor(minPrice),
      max: Math.ceil(maxPrice),
    },
  };
}
