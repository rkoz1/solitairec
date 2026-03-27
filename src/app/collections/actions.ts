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
  };

  const allSizes = new Set<string>();
  const colorMap = new Map<string, ColorOption>(); // name → { name, value }
  let minPrice = Infinity;
  let maxPrice = 0;

  const products: CollectionProduct[] = (allItems as WixProduct[]).map((p) => {
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
