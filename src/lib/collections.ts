import { unstable_cache } from "next/cache";
import { getServerWixClient } from "./wix-server-client";
import { fetchRetry } from "./fetch-retry";
import { getWixImageUrl } from "./wix-image";

/* ------------------------------------------------------------------ */
/*  Category hierarchy config                                         */
/*  Wix collections are flat — this defines the menu grouping.        */
/*  Names must match exactly what's in the Wix dashboard.             */
/* ------------------------------------------------------------------ */

// Display names for categories (when Wix name differs from what we want to show)
export const DISPLAY_NAMES: Record<string, string> = {
  Top: "Tops",
  Tee: "Tees",
  Blouse: "Blouses",
  "Vest & Camisoles": "Vests & Camisoles",
  Outer: "Outers",
  "Overalls & Jumpsuits": "Jumpsuits & Overalls",
  Belt: "Belts",
  Bags: "Handbags",
};

export function displayName(wixName: string): string {
  return DISPLAY_NAMES[wixName] ?? wixName;
}

export const CATEGORY_HIERARCHY: {
  name: string;
  children?: string[];
}[] = [
  { name: "New Arrivals" },
  { name: "Bags" },
  {
    name: "Top",
    children: [
      "Blouse",
      "Cardigans",
      "Knitwear",
      "Shirts & Polos",
      "Tee",
      "Vest & Camisoles",
    ],
  },
  {
    name: "Bottoms",
    children: [
      "Casual pants",
      "Formal trousers",
      "Denim trousers",
      "Shorts",
      "Overalls & Jumpsuits",
    ],
  },
  {
    name: "Dresses",
    children: ["Sleeveless dress", "Skirts", "Midi dress", "Slipdress"],
  },

  {
    name: "Outer",
    children: ["Cardigans", "Blazers & Jackets"],
  },

  {
    name: "Shoes",
    children: ["Mary Janes", "Sandals", "Loafers", "Heels", "Boots"],
  },
  {
    name: "Accessories",
    children: ["Necklaces", "Earrings", "Belt"],
  },
];

// Names to exclude from navigation (not product categories)
const EXCLUDED_NAMES = ["Shoe Size Chart"];

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export interface CollectionInfo {
  _id: string;
  name: string;
  slug: string;
  productCount: number;
  imageUrl?: string;
}

export interface NavCategory {
  name: string;
  slug: string;
  _id: string;
  children?: { name: string; slug: string; _id: string }[];
}

/* ------------------------------------------------------------------ */
/*  Data fetching                                                     */
/* ------------------------------------------------------------------ */

export const getAllCollections = unstable_cache(
  async (): Promise<CollectionInfo[]> =>
    fetchRetry(async () => {
      const wix = getServerWixClient();
      const { items } = await wix.collections.queryCollections().limit(100).find();

      return items
        .filter((c) => c.name && !EXCLUDED_NAMES.includes(c.name))
        .map((c) => ({
          _id: c._id ?? "",
          name: c.name ?? "",
          slug: c.slug ?? "",
          productCount: c.numberOfProducts ?? 0,
          imageUrl: c.media?.mainMedia?.image?.url
            ? getWixImageUrl(c.media.mainMedia.image.url, 800, 400)
            : undefined,
        }));
    }),
  ["all-collections"],
  { revalidate: 3600, tags: ["collections"] }
);

export const getCollectionProducts = unstable_cache(
  async (collectionId: string, limit: number = 20) =>
    fetchRetry(async () => {
      const wix = getServerWixClient();
      // Wix REST API supports createdDate sorting but SDK types are too restrictive — cast to bypass
      const { items } = await wix.products
        .queryProducts()
        .hasSome("collectionIds", [collectionId])
        .descending("createdDate" as any)
        .limit(limit)
        .find();
      return items;
    }),
  ["collection-products"],
  { revalidate: 600, tags: ["collection-products"] }
);

export const getCollectionBySlug = unstable_cache(
  async (slug: string) =>
    fetchRetry(async () => {
      const wix = getServerWixClient();
      const result = await wix.collections.getCollectionBySlug(slug);
      return result.collection ?? null;
    }),
  ["collection-by-slug"],
  { revalidate: 3600, tags: ["collections"] }
);

export async function getFeaturedCollection() {
  try {
    return await getCollectionBySlug("featured");
  } catch {
    return null;
  }
}

/**
 * Build the navigation menu structure by matching CATEGORY_HIERARCHY
 * against the actual collections from Wix.
 */
export async function getNavCategories(): Promise<NavCategory[]> {
  const all = await getAllCollections();
  const byName = new Map(all.map((c) => [c.name, c]));

  const nav: NavCategory[] = [];

  for (const cat of CATEGORY_HIERARCHY) {
    const parent = byName.get(cat.name);
    if (!parent) continue;

    const entry: NavCategory = {
      name: parent.name,
      slug: parent.slug,
      _id: parent._id,
    };

    if (cat.children && cat.children.length > 0) {
      entry.children = cat.children
        .map((childName) => {
          const child = byName.get(childName);
          if (!child) return null;
          return { name: child.name, slug: child.slug, _id: child._id };
        })
        .filter(Boolean) as { name: string; slug: string; _id: string }[];
    }

    nav.push(entry);
  }

  return nav;
}

/**
 * Get the top-level category names for home page sections.
 * Returns collections with their IDs so we can fetch products.
 */
export async function getHomeSections() {
  const all = await getAllCollections();
  const byName = new Map(all.map((c) => [c.name, c]));

  // Show these categories on the home page (in order)
  const HOME_SECTIONS = ["New Arrivals", "Top", "Bags", "Shoes", "Dresses"];

  return HOME_SECTIONS.map((name) => byName.get(name)).filter(
    Boolean,
  ) as CollectionInfo[];
}
