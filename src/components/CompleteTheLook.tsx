import { getServerWixClient } from "@/lib/wix-server-client";
import { fetchRetry, safeCache } from "@/lib/fetch-retry";
import ProductCard from "@/components/ProductCard";
import { CATEGORY_HIERARCHY } from "@/lib/collections";

const WIX_STORES_APP_ID = "215238eb-22a5-4c36-9e7b-e7c08025e04e";
const MIN_ITEMS = 2;
const MAX_ITEMS = 8;

interface CompleteTheLookProps {
  currentProductId: string;
}

type Product = {
  _id?: string | null;
  slug?: string | null;
  name?: string | null;
  collectionIds?: string[];
  priceData?: { formatted?: { price?: string | null } | null } | null;
  media?: {
    mainMedia?: { image?: { url?: string | null } | null } | null;
  } | null;
};

export default async function CompleteTheLook({
  currentProductId,
}: CompleteTheLookProps) {
  try {
    const { products, heading } =
      await getCachedRecommendedProducts(currentProductId);
    if (products.length < MIN_ITEMS) return null;

    return (
      <section className="mt-28 px-6 lg:px-8 lg:max-w-6xl lg:mx-auto">
        <h2 className="font-serif italic text-2xl tracking-tight text-on-surface mb-8">
          {heading}
        </h2>
        <div className="flex gap-4 overflow-x-auto no-scrollbar">
          {products.slice(0, MAX_ITEMS).map((product) => (
            <div key={product._id} className="w-40 flex-shrink-0">
              <ProductCard
                slug={product.slug ?? ""}
                name={product.name ?? ""}
                price={product.priceData?.formatted?.price ?? ""}
                imageUrl={product.media?.mainMedia?.image?.url}
              />
            </div>
          ))}
        </div>
      </section>
    );
  } catch {
    return null;
  }
}

/**
 * Resolve which top-level category names the current product belongs to,
 * so we can exclude same-category items from "Complete the Look".
 */
async function getCurrentProductCategory(
  wix: ReturnType<typeof getServerWixClient>,
  product: Product,
): Promise<Set<string>> {
  const sameCategoryNames = new Set<string>();
  if (!product.collectionIds?.length) return sameCategoryNames;

  const allCollections = await fetchRetry(() => wix.collections
    .queryCollections()
    .limit(50)
    .find());
  const idToName = new Map(
    allCollections.items.map((c) => [c._id ?? "", c.name ?? ""]),
  );

  for (const colId of product.collectionIds) {
    const colName = idToName.get(colId);
    if (!colName) continue;
    for (const cat of CATEGORY_HIERARCHY) {
      if (cat.name === colName || cat.children?.includes(colName)) {
        sameCategoryNames.add(cat.name);
        cat.children?.forEach((c) => sameCategoryNames.add(c));
        break;
      }
    }
  }

  return sameCategoryNames;
}

/** All category names from the hierarchy (both parents and children) */
const ALL_CATEGORY_NAMES = new Set(
  CATEGORY_HIERARCHY.flatMap((cat) => [cat.name, ...(cat.children ?? [])]),
);

function filterOutSameCategory(
  products: Product[],
  sameCategoryNames: Set<string>,
  collectionIdToName: Map<string, string>,
): Product[] {
  if (sameCategoryNames.size === 0) return products;
  return products.filter((p) => {
    const names = (p.collectionIds ?? [])
      .map((id) => collectionIdToName.get(id))
      .filter(Boolean) as string[];

    // Get only the category-relevant collection names (ignore "All Products", "New Arrivals" etc.)
    const categoryNames = names.filter((name) => ALL_CATEGORY_NAMES.has(name));

    // Keep if the product belongs to at least one DIFFERENT category
    // If product has no recognized categories, exclude it (can't determine)
    if (categoryNames.length === 0) return false;
    return categoryNames.some((name) => !sameCategoryNames.has(name));
  });
}

const getCachedRecommendedProducts = safeCache(
  async (
    currentProductId: string,
  ): Promise<{ products: Product[]; heading: string }> => {
    return getRecommendedProducts(currentProductId);
  },
  ["recommended-products"],
  { revalidate: 1800, tags: ["recommendations"] }
);

async function getRecommendedProducts(
  currentProductId: string,
): Promise<{ products: Product[]; heading: string }> {
  const wix = getServerWixClient();

  // Fetch current product
  const { items: currentItems } = await fetchRetry(() => wix.products
    .queryProducts()
    .eq("_id", currentProductId)
    .limit(1)
    .find());
  const currentProduct = currentItems[0];
  if (!currentProduct) return { products: [], heading: "" };

  // Resolve category + collection name mapping
  const sameCategoryNames = await getCurrentProductCategory(
    wix,
    currentProduct,
  );
  const allCollections = await fetchRetry(() => wix.collections
    .queryCollections()
    .limit(50)
    .find());
  const collectionIdToName = new Map(
    allCollections.items.map((c) => [c._id ?? "", c.name ?? ""]),
  );
  // Tier 1: Wix Recommendations — filtered to exclude same category
  const recommended = await tryWixRecommendations(wix, currentProductId);
  const complementary = filterOutSameCategory(
    recommended,
    sameCategoryNames,
    collectionIdToName,
  );

  if (complementary.length >= MIN_ITEMS)
    return {
      products: complementary.slice(0, MAX_ITEMS),
      heading: "Complete the Look",
    };

  // Tier 1 had results but all same-category → show as "Frequently Bought Together"
  if (recommended.length >= MIN_ITEMS) {
    return {
      products: recommended.slice(0, MAX_ITEMS),
      heading: "Frequently Bought Together",
    };
  }

  // Tier 2: Cross-category collection matching
  const crossCategory = await tryCrossCategoryMatch(
    wix,
    currentProductId,
    complementary,
  );
  if (crossCategory.length >= MIN_ITEMS)
    return { products: crossCategory, heading: "Style It With" };

  // Tier 3: Same-collection products
  const sameCollection = await trySameCollectionMatch(
    wix,
    currentProductId,
    crossCategory,
  );
  return { products: sameCollection, heading: "You May Also Like" };
}

async function tryWixRecommendations(
  wix: ReturnType<typeof getServerWixClient>,
  productId: string,
): Promise<Product[]> {
  try {
    // Discover available algorithms
    const { availableAlgorithms } =
      await fetchRetry(() => wix.recommendations.listAvailableAlgorithms());

    if (!availableAlgorithms || availableAlgorithms.length === 0) return [];

    // Prefer RELATED_ITEMS algorithms, then any available
    const sorted = [...availableAlgorithms].sort((a, b) => {
      const aRelated = a.config?.algorithmType === "RELATED_ITEMS" ? 0 : 1;
      const bRelated = b.config?.algorithmType === "RELATED_ITEMS" ? 0 : 1;
      return aRelated - bRelated;
    });

    const algorithms = sorted
      .filter((a) => a.appId && a.config?.algorithmId)
      .map((a) => ({
        _id: a.config!.algorithmId!,
        appId: a.appId!,
      }));

    if (algorithms.length === 0) return [];

    const result = await fetchRetry(() => wix.recommendations.getRecommendation(algorithms, {
      items: [
        {
          catalogItemId: productId,
          appId: WIX_STORES_APP_ID,
        },
      ],
      minimumRecommendedItems: MIN_ITEMS,
    }));

    const recItems = result.recommendation?.items ?? [];
    if (recItems.length === 0) return [];

    // Fetch full product details for recommended IDs
    const ids = recItems
      .map((item) => item.catalogItemId)
      .filter(Boolean) as string[];

    const { items } = await fetchRetry(() => wix.products
      .queryProducts()
      .hasSome("_id", ids)
      .limit(MAX_ITEMS)
      .find());

    return items.filter((p) => p._id !== productId);
  } catch (err) {
    console.error("Wix recommendations failed, falling back:", err);
    return [];
  }
}

async function tryCrossCategoryMatch(
  wix: ReturnType<typeof getServerWixClient>,
  productId: string,
  existing: Product[],
): Promise<Product[]> {
  try {
    const { items: currentItems } = await fetchRetry(() => wix.products
      .queryProducts()
      .eq("_id", productId)
      .limit(1)
      .find());

    const current = currentItems[0];
    if (!current?.collectionIds?.length) return existing;

    const sameCategoryNames = await getCurrentProductCategory(wix, current);
    const allCollections = await fetchRetry(() => wix.collections
      .queryCollections()
      .limit(50)
      .find());
    const idToName = new Map(
      allCollections.items.map((c) => [c._id ?? "", c.name ?? ""]),
    );

    // Assertion safe: guarded by collectionIds.length check above; needed because fetchRetry closure breaks TS narrowing
    const colIds = current.collectionIds!;
    const { items } = await fetchRetry(() => wix.products
      .queryProducts()
      .hasSome("collectionIds", colIds)
      .limit(20)
      .find());

    const existingIds = new Set(existing.map((p) => p._id));
    const crossCat = items.filter((p) => {
      if (p._id === productId || existingIds.has(p._id)) return false;
      const names = (p.collectionIds ?? [])
        .map((id) => idToName.get(id))
        .filter(Boolean) as string[];
      return names.some((name) => !sameCategoryNames.has(name));
    });

    return [...existing, ...crossCat].slice(0, MAX_ITEMS);
  } catch (err) {
    console.error("Cross-category matching failed:", err);
    return existing;
  }
}

async function trySameCollectionMatch(
  wix: ReturnType<typeof getServerWixClient>,
  productId: string,
  existing: Product[],
): Promise<Product[]> {
  try {
    const { items: currentItems } = await fetchRetry(() => wix.products
      .queryProducts()
      .eq("_id", productId)
      .limit(1)
      .find());

    const current = currentItems[0];
    if (!current?.collectionIds?.length) return existing;

    // Assertion safe: guarded by collectionIds.length check above; needed because fetchRetry closure breaks TS narrowing
    const colIds = current.collectionIds!;
    const { items } = await fetchRetry(() => wix.products
      .queryProducts()
      .hasSome("collectionIds", colIds)
      .limit(MAX_ITEMS + 1)
      .find());

    const existingIds = new Set(existing.map((p) => p._id));
    const sameCol = items.filter(
      (p) => p._id !== productId && !existingIds.has(p._id),
    );

    return [...existing, ...sameCol].slice(0, MAX_ITEMS);
  } catch {
    return existing;
  }
}
