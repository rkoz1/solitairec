export const dynamic = "force-dynamic";

import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import HeroCarousel from "@/components/HeroCarousel";
import {
  getFeaturedCollection,
  getCollectionProducts,
  getHomeSections,
} from "@/lib/collections";
import { getWixImageUrl } from "@/lib/wix-image";

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="pt-28 pb-10">
      <h2 className="font-serif italic text-2xl tracking-tight text-on-surface">
        {title}
      </h2>
      <div className="mt-3 w-12 h-[2px] bg-secondary" />
    </div>
  );
}

function ProductGrid({
  products,
}: {
  products: {
    _id?: string | null;
    slug?: string | null;
    name?: string | null;
    priceData?: { formatted?: { price?: string | null } | null } | null;
    media?: {
      mainMedia?: { image?: { url?: string | null } | null } | null;
    } | null;
  }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product, index) => (
        <div key={product._id} className={index % 2 === 1 ? "mt-8" : ""}>
          <ProductCard
            slug={product.slug ?? product._id ?? ""}
            name={product.name ?? "Untitled"}
            price={product.priceData?.formatted?.price ?? "Price unavailable"}
            imageUrl={product.media?.mainMedia?.image?.url}
          />
        </div>
      ))}
    </div>
  );
}

export default async function HomePage() {
  // Fetch featured collection + home sections in parallel
  const [featured, sections] = await Promise.all([
    getFeaturedCollection(),
    getHomeSections(),
  ]);

  // Fetch featured products if collection exists
  const featuredProducts = featured?._id
    ? await getCollectionProducts(featured._id, 4)
    : [];

  // Fetch products for each home section in parallel
  const sectionData = await Promise.all(
    sections.map(async (section) => ({
      ...section,
      products: await getCollectionProducts(section._id, 6),
    }))
  );

  return (
    <section className="px-5">
      {/* Hero — Featured products carousel */}
      {featuredProducts.length > 0 && (
        <div className="pt-4">
          <HeroCarousel
            items={featuredProducts.map((p) => ({
              slug: p.slug ?? p._id ?? "",
              name: p.name ?? "Product",
              price: p.priceData?.formatted?.price ?? "",
              imageUrl: getWixImageUrl(
                p.media?.mainMedia?.image?.url,
                1200,
                1600
              ),
            }))}
          />
        </div>
      )}

      {/* Category sections */}
      {sectionData.map(
        (section) =>
          section.products.length > 0 && (
            <div key={section._id}>
              <SectionHeading title={section.name} />
              <ProductGrid products={section.products} />
              <div className="mt-8 text-center">
                <Link
                  href={`/collections/${section.slug}`}
                  className="text-xs tracking-[0.15em] uppercase font-medium text-on-surface underline underline-offset-4 hover:text-secondary transition-colors"
                >
                  View All {section.name}
                </Link>
              </div>
            </div>
          )
      )}

      {/* Fallback if nothing loaded */}
      {featuredProducts.length === 0 && sectionData.every((s) => s.products.length === 0) && (
        <div className="pt-12">
          <SectionHeading title="Welcome" />
          <p className="text-on-surface-variant text-sm">
            No products found. Make sure your Wix credentials are configured
            and you have products in your Wix store collections.
          </p>
        </div>
      )}
    </section>
  );
}
