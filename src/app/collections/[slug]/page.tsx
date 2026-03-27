export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getCollectionBySlug, getCollectionProducts, displayName } from "@/lib/collections";
import ProductCard from "@/components/ProductCard";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function CollectionPage({ params }: Props) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);

  if (!collection) notFound();

  const products = await getCollectionProducts(collection._id ?? "", 40);

  return (
    <section className="px-5">
      <div className="pt-12 pb-10">
        <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
          {displayName(collection.name ?? "")}
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-secondary" />
      </div>

      {products.length === 0 ? (
        <p className="text-sm text-on-surface-variant">
          No products in this collection yet.
        </p>
      ) : (
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
      )}
    </section>
  );
}
