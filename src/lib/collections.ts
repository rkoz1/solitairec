import { getServerWixClient } from "./wix-server-client";
import { getWixImageUrl } from "./wix-image";

/* ------------------------------------------------------------------ */
/*  Category hierarchy config                                         */
/*  Wix collections are flat — this defines the menu grouping.        */
/*  Names must match exactly what's in the Wix dashboard.             */
/* ------------------------------------------------------------------ */

export const CATEGORY_HIERARCHY: {
  name: string;
  children?: string[];
}[] = [
  { name: "New Arrivals" },
  {
    name: "Tops",
    children: [
      "Blouses",
      "Cardigans",
      "Knitwear",
      "Shirts & Polos",
      "Tees",
      "Vests & Camisoles",
    ],
  },
  {
    name: "Dresses",
    children: [
      "Sleeveless dress",
      "Skirts",
      "Midi dress",
      "Slipdress",
    ],
  },
  {
    name: "Trousers",
    children: [
      "Casual pants",
      "Formal trousers",
      "Denim trousers",
      "Shorts",
      "Jumpsuits & Overalls",
    ],
  },
  {
    name: "Outers",
    children: ["Cardigans", "Blazers & Jackets"],
  },
  { name: "Handbags" },
  {
    name: "Shoes",
    children: [
      "Mary Janes",
      "Sandals",
      "Loafers",
      "Heels",
      "Boots",
    ],
  },
  {
    name: "Accessories",
    children: ["Necklaces", "Earrings", "Belts"],
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

export async function getAllCollections(): Promise<CollectionInfo[]> {
  const wix = getServerWixClient();
  const { items } = await wix.collections.queryCollections().limit(50).find();

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
}

export async function getCollectionProducts(
  collectionId: string,
  limit: number = 20
) {
  const wix = getServerWixClient();
  const { items } = await wix.products
    .queryProducts()
    .hasSome("collectionIds", [collectionId])
    .limit(limit)
    .find();
  return items;
}

export async function getCollectionBySlug(slug: string) {
  const wix = getServerWixClient();
  const result = await wix.collections.getCollectionBySlug(slug);
  return result.collection ?? null;
}

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
  const HOME_SECTIONS = ["New Arrivals", "Tops", "Dresses", "Shoes", "Accessories"];

  return HOME_SECTIONS.map((name) => byName.get(name)).filter(Boolean) as CollectionInfo[];
}
