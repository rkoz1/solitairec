"use client";

import { useEffect, useState, useMemo, use } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  fetchCollectionProducts,
  type CollectionData,
  type CollectionProduct,
} from "../actions";
import { displayName } from "@/lib/collections";
import CollectionFilters, {
  EMPTY_FILTERS,
  type FilterState,
} from "@/components/CollectionFilters";
import LoadingIndicator from "@/components/LoadingIndicator";

interface Props {
  params: Promise<{ slug: string }>;
}

export default function CollectionPage({ params }: Props) {
  const { slug } = use(params);
  const [data, setData] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<string>("newest");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  useEffect(() => {
    setLoading(true);
    fetchCollectionProducts(slug, sort as "newest" | "price_asc" | "price_desc")
      .then((result) => {
        setData(result);
        setLoading(false);
      });
  }, [slug, sort]);

  // Client-side filtering
  const filtered = useMemo(() => {
    if (!data) return [];
    return data.products.filter((p) => {
      // Size filter
      if (filters.sizes.length > 0) {
        if (!p.sizes.some((s) => filters.sizes.includes(s))) return false;
      }
      // Color filter
      if (filters.colors.length > 0) {
        if (!p.colors.some((c) => filters.colors.includes(c.name))) return false;
      }
      // Price filter
      if (filters.minPrice !== null && p.price < filters.minPrice) return false;
      if (filters.maxPrice !== null && p.price > filters.maxPrice) return false;
      return true;
    });
  }, [data, filters]);

  if (loading) return <LoadingIndicator />;

  if (!data) {
    return (
      <section className="px-5 pt-12 text-center">
        <p className="text-sm text-on-surface-variant">Collection not found.</p>
        <Link
          href="/"
          className="mt-6 inline-block text-xs tracking-[0.15em] uppercase font-medium text-on-surface underline underline-offset-4"
        >
          Continue Shopping
        </Link>
      </section>
    );
  }

  return (
    <section className="px-5">
      <div className="pt-12 pb-10">
        <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
          {displayName(data.name)}
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-secondary" />
      </div>

      <CollectionFilters
        availableSizes={data.availableSizes}
        availableColors={data.availableColors}
        priceRange={data.priceRange}
        filters={filters}
        onChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        resultCount={filtered.length}
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-on-surface-variant pt-8 text-center">
          No products match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((product, index) => (
            <div key={product._id} className={index % 2 === 1 ? "mt-8" : ""}>
              <Link href={`/products/${product.slug}`} className="group block">
                <div className="relative aspect-[3/4] overflow-hidden bg-surface-container-low">
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                </div>
                <div className="mt-4">
                  <h3 className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface">
                    {product.name}
                  </h3>
                  <p className="mt-1 text-[10px] tracking-widest text-on-surface-variant">
                    {product.formattedPrice}
                  </p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
