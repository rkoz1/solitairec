export const revalidate = 600;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { unstable_cache } from "next/cache";
import { getServerWixClient } from "@/lib/wix-server-client";
import { fetchRetry } from "@/lib/fetch-retry";
import { getWixImageUrl } from "@/lib/wix-image";
import { getAllCollections, CATEGORY_HIERARCHY, displayName } from "@/lib/collections";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";

import ImageCarousel from "@/components/ImageCarousel";
import CompleteTheLook from "@/components/CompleteTheLook";
import ShippingInfo from "@/components/ShippingInfo";
import FreeShippingProgress from "@/components/FreeShippingProgress";
import Price from "@/components/Price";
import ProductInfo from "./ProductInfo";
import TrackView from "./TrackView";

interface Props {
  params: Promise<{ slug: string }>;
}

const getProduct = unstable_cache(
  async (slug: string) =>
    fetchRetry(async () => {
      const wix = getServerWixClient();
      const { items } = await wix.products
        .queryProducts()
        .eq("slug", slug)
        .limit(1)
        .find();
      return items[0] ?? null;
    }),
  ["product-by-slug"],
  { revalidate: 600, tags: ["product-catalog"] }
);

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

/** Clean Wix HTML: strip inline styles, fix missing spaces after colons */
function fixWixHtml(html: string): string {
  return html
    .replace(/\s*style="[^"]*"/gi, "")
    .replace(/\s*style='[^']*'/gi, "")
    .replace(/:([^\s/<])/g, ": $1");
}

interface RichContentNode {
  type: string;
  nodes?: RichContentNode[];
  textData?: { text?: string; decorations?: { type: string }[] };
  paragraphData?: Record<string, unknown>;
  tableCellData?: Record<string, unknown>;
  tableData?: { dimensions?: { colsWidthRatio?: number[] } };
}

function richContentToHtml(nodes: RichContentNode[]): string {
  return nodes.map((node) => {
    const children = node.nodes ? richContentToHtml(node.nodes) : "";
    switch (node.type) {
      case "TEXT":
        return node.textData?.text ?? "";
      case "PARAGRAPH":
        return `<p>${children}</p>`;
      case "TABLE":
        return `<table>${children}</table>`;
      case "TABLE_ROW":
        return `<tr>${children}</tr>`;
      case "TABLE_CELL":
        return `<td>${children}</td>`;
      default:
        return children;
    }
  }).join("");
}

const getFittingDefaults = unstable_cache(
  async (): Promise<Record<string, string>> => {
    const wix = getServerWixClient();
    const result = await wix.dataItems.query("Fitting").find();
    const map: Record<string, string> = {};
    for (const item of result.items) {
      const title = (item.title ?? item.title_fld) as string | undefined;
      const richContent = item.output as { nodes?: RichContentNode[] } | undefined;
      const html = richContent?.nodes
        ? richContentToHtml(richContent.nodes)
        : (item.description ?? item.description_fld) as string | undefined;
      if (title && html) map[title] = html;
    }
    return map;
  },
  ["fitting-defaults"],
  { revalidate: 3600, tags: ["product-catalog"] }
);

const SKIP_FITTING_CATEGORIES = new Set(["New Arrivals", "All Products", "Featured"]);

async function getProductCategories(collectionIds: string[]): Promise<string[]> {
  const allCollections = await getAllCollections();
  const collectionMap = new Map(allCollections.map((c) => [c._id, c]));
  const productCollections = collectionIds
    .map((id) => collectionMap.get(id))
    .filter(Boolean) as { name: string; slug: string; _id: string }[];

  for (const cat of CATEGORY_HIERARCHY) {
    if (SKIP_FITTING_CATEGORIES.has(cat.name)) continue;
    const matchedChild = cat.children?.find((child) =>
      productCollections.some((c) => c.name === child)
    );
    if (matchedChild) {
      // Return both raw Wix name and display name so fitting lookup works with either
      return [matchedChild, displayName(matchedChild), cat.name, displayName(cat.name)];
    }
    if (productCollections.some((c) => c.name === cat.name)) {
      return [cat.name, displayName(cat.name)];
    }
  }
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!VALID_SLUG.test(slug)) return {};
  const product = await getProduct(slug);
  if (!product) return {};

  // Extract SEO data from Wix if available
  const seoTags = (product.seoData as { tags?: { type?: string; children?: string; props?: Record<string, string> }[] })?.tags ?? [];
  const seoTitle = seoTags.find((t) => t.type === "title")?.children;
  const seoDesc = seoTags.find((t) => t.type === "meta" && t.props?.name === "description")?.props?.content;

  const title = seoTitle || product.name || "Product";
  const description = seoDesc || (product.description ? stripHtml(product.description).slice(0, 160) : "Shop at SOLITAIREC");
  const imageUrl = getWixImageUrl(product.media?.mainMedia?.image?.url, 1200, 630);

  return {
    title,
    description,
    alternates: {
      canonical: `${SITE_URL}/products/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/products/${slug}`,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      title,
      description,
      images: [imageUrl],
    },
  };
}

const VALID_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  if (!VALID_SLUG.test(slug)) notFound();
  const product = await getProduct(slug);
  if (!product) notFound();

  const mainImage = getWixImageUrl(
    product.media?.mainMedia?.image?.url,
    800,
    1067
  );

  const mainMediaUrl = product.media?.mainMedia?.image?.url;
  const additionalImages =
    product.media?.items
      ?.filter(
        (item) =>
          item.image && item.image.url !== mainMediaUrl
      )
      .map((item) => getWixImageUrl(item.image?.url, 800, 1067)) ?? [];

  const allImages = [mainImage, ...additionalImages.slice(0, 5)];

  // Inject CMS fitting fallback if product lacks a "Fitting" section
  const hasFitting = product.additionalInfoSections?.some(
    (s) => s.title?.toLowerCase() === "fitting"
  );
  if (!hasFitting) {
    const [fittingDefaults, categories] = await Promise.all([
      getFittingDefaults(),
      getProductCategories(product.collectionIds ?? []),
    ]);
    // Try most specific category first (e.g. "Skirts"), then parent (e.g. "Dresses")
    const fallbackDesc = categories.reduce<string | undefined>(
      (found, cat) => found ?? fittingDefaults[cat],
      undefined
    );
    if (fallbackDesc) {
      product.additionalInfoSections = [
        ...(product.additionalInfoSections ?? []),
        { title: "Fitting", description: fallbackDesc },
      ];
    }
  }

  // Build BreadcrumbList schema
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://solitairec.com";
  const breadcrumbItems: { name: string; url: string }[] = [
    { name: "Home", url: siteUrl },
  ];
  {
    const allCols = await getAllCollections();
    const colMap = new Map(allCols.map((c) => [c._id, c]));
    const prodCols = (product.collectionIds ?? [])
      .map((id) => colMap.get(id))
      .filter((c) => c && !SKIP_COLLECTIONS.has(c.name)) as { name: string; slug: string }[];

    for (const cat of CATEGORY_HIERARCHY) {
      const childCol = prodCols.find((c) => cat.children?.includes(c.name));
      if (childCol) {
        const parentSlug = allCols.find((c) => c.name === cat.name)?.slug;
        if (parentSlug) breadcrumbItems.push({ name: displayName(cat.name), url: `${siteUrl}/collections/${parentSlug}` });
        breadcrumbItems.push({ name: displayName(childCol.name), url: `${siteUrl}/collections/${childCol.slug}` });
        break;
      }
      const parentCol = prodCols.find((c) => c.name === cat.name);
      if (parentCol) {
        breadcrumbItems.push({ name: displayName(parentCol.name), url: `${siteUrl}/collections/${parentCol.slug}` });
        break;
      }
    }
  }
  breadcrumbItems.push({ name: product.name ?? "", url: `${siteUrl}/products/${product.slug}` });

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbItems.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  const stockStatus = (product.stock as { inventoryStatus?: string } | undefined)?.inventoryStatus;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description ? stripHtml(product.description).slice(0, 500) : undefined,
    image: mainImage,
    sku: product.sku || product._id,
    url: `${siteUrl}/products/${product.slug}`,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    offers: {
      "@type": "Offer",
      price: product.priceData?.price ?? 0,
      priceCurrency: product.priceData?.currency ?? "HKD",
      availability:
        stockStatus === "OUT_OF_STOCK"
          ? "https://schema.org/OutOfStock"
          : "https://schema.org/InStock",
      url: `${siteUrl}/products/${product.slug}`,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "SOLITAIREC" },
    },
  };

  return (
    <>
      <TrackView
        productId={product._id ?? ""}
        productName={product.name ?? ""}
        price={product.priceData?.price ?? 0}
        currency={product.priceData?.currency ?? "HKD"}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:max-w-6xl lg:mx-auto lg:px-8 lg:pt-8">
        {/* Image gallery */}
        <div className="relative">
          {/* Mobile: carousel */}
          <div className="lg:hidden">
            <ImageCarousel
              images={allImages}
              productName={product.name ?? "Product"}
            />
          </div>
          {/* Desktop: vertical image stack */}
          <div className="hidden lg:block space-y-4">
            {allImages.map((src, i) => (
              <div
                key={i}
                className="relative aspect-[3/4] bg-surface-container-low"
              >
                <Image
                  src={src}
                  alt={`${product.name ?? "Product"} ${i + 1}`}
                  fill
                  sizes="50vw"
                  className="object-cover"
                  priority={i === 0}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Product info — sticky on desktop, scrolls within if tall */}
        <div className="mt-12 px-6 lg:mt-0 lg:px-0 lg:py-8 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto no-scrollbar">
          <ProductBreadcrumb
            brand={product.brand}
            collectionIds={product.collectionIds ?? []}
          />
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-on-surface">
            {product.name}
          </h1>
          {product.ribbon && (
            <span className="mt-3 inline-block text-[10px] tracking-[0.2em] uppercase font-medium text-secondary border border-secondary px-3 py-1">
              {product.ribbon}
            </span>
          )}
          <div className="mt-3 text-lg tracking-tight text-on-surface-variant">
            <Price amount={product.priceData?.price ?? 0} />
          </div>
          <ProductInfo
            productId={product._id ?? ""}
            productName={product.name ?? ""}
            productPrice={String(product.priceData?.price ?? "0")}
            productOptions={product.productOptions ?? []}
            variants={(product.variants ?? []).map((v: { _id?: string; choices?: Record<string, string>; stock?: { inStock?: boolean; quantity?: number | null; trackQuantity?: boolean } }) => ({
              variantId: v._id ?? "",
              choices: v.choices ?? {},
              inStock: v.stock?.inStock ?? true,
              quantity: v.stock?.quantity ?? 0,
              trackQuantity: v.stock?.trackQuantity ?? false,
            }))}
            productInStock={(product.stock as { inventoryStatus?: string } | undefined)?.inventoryStatus !== "OUT_OF_STOCK"}
            productQuantity={(product.stock as { quantity?: number } | undefined)?.quantity ?? undefined}
            trackInventory={(product.stock as { trackInventory?: boolean } | undefined)?.trackInventory ?? false}
            manageVariants={product.manageVariants ?? false}
          />
          <ShippingInfo />
          <FreeShippingProgress />
          {product.description && (
            <div className="mt-16 space-y-10">
              <div className="pb-8 border-b border-outline-variant/30">
                <h3 className="font-serif italic text-xl tracking-tight text-on-surface mb-4">
                  Description
                </h3>
                <div
                  className="wix-rich-content text-sm leading-relaxed text-on-surface-variant"
                  dangerouslySetInnerHTML={{ __html: fixWixHtml(product.description) }}
                />
              </div>
              {(product.additionalInfoSections?.length ?? 0) > 0 ? (
                product.additionalInfoSections!.map((section) => (
                  <div key={section.title} className="pb-8 border-b border-outline-variant/30">
                    <h3 className="font-serif italic text-xl tracking-tight text-on-surface mb-4">
                      {section.title}
                    </h3>
                    <div
                      className="wix-rich-content text-sm leading-relaxed text-on-surface-variant"
                      dangerouslySetInnerHTML={{ __html: fixWixHtml(section.description ?? "") }}
                    />
                  </div>
                ))
              ) : (
                <div className="pb-8 border-b border-outline-variant/30">
                  <h3 className="font-serif italic text-xl tracking-tight text-on-surface mb-4">
                    Design Details
                  </h3>
                  <ul className="text-sm leading-relaxed text-on-surface-variant space-y-2">
                    <li>Crafted with premium materials</li>
                    <li>Designed for everyday elegance</li>
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Complete the Look — cross-sell */}
      <CompleteTheLook currentProductId={product._id ?? ""} />
    </>
  );
}

const SKIP_COLLECTIONS = new Set(["All Products", "Featured", "New Arrivals"]);

async function ProductBreadcrumb({
  brand,
  collectionIds,
}: {
  brand?: string | null;
  collectionIds: string[];
}) {
  const allCollections = await getAllCollections();
  const collectionMap = new Map(allCollections.map((c) => [c._id, c]));

  // Find the product's collections, excluding generic ones
  const productCollections = collectionIds
    .map((id) => collectionMap.get(id))
    .filter((c) => c && !SKIP_COLLECTIONS.has(c.name));

  // Match against hierarchy to find parent → child breadcrumb
  let parent: { name: string; slug: string } | null = null;
  let child: { name: string; slug: string } | null = null;

  for (const cat of CATEGORY_HIERARCHY) {
    const parentCol = productCollections.find((c) => c!.name === cat.name);
    if (cat.children) {
      const childCol = productCollections.find((c) =>
        cat.children!.includes(c!.name)
      );
      if (childCol) {
        parent = parentCol ?? { name: cat.name, slug: allCollections.find((c) => c.name === cat.name)?.slug ?? "" };
        child = childCol;
        break;
      }
    }
    if (parentCol && !child) {
      parent = parentCol;
    }
  }

  // Fallback: use first non-skipped collection
  if (!parent && !child && productCollections.length > 0) {
    parent = productCollections[0]!;
  }

  if (!parent && !child && !brand) return null;

  return (
    <div className="flex items-center gap-1.5 text-[10px] tracking-[0.25em] uppercase font-medium">
      {parent && (
        <Link
          href={`/collections/${parent.slug}`}
          className="text-secondary hover:text-on-surface transition-colors"
        >
          {displayName(parent.name)}
        </Link>
      )}
      {parent && child && (
        <span className="text-outline">›</span>
      )}
      {child && (
        <Link
          href={`/collections/${child.slug}`}
          className="text-secondary hover:text-on-surface transition-colors"
        >
          {displayName(child.name)}
        </Link>
      )}
      {brand && (parent || child) && (
        <span className="text-outline">›</span>
      )}
      {brand && (
        <span className="text-on-surface-variant">{brand}</span>
      )}
    </div>
  );
}
