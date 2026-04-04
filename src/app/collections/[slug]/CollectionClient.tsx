"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  fetchCollectionProducts,
  type CollectionData,
} from "../actions";
import ProductCard from "@/components/ProductCard";
import { displayName } from "@/lib/collections";
import CollectionFilters, {
  EMPTY_FILTERS,
  type FilterState,
} from "@/components/CollectionFilters";
import LoadingIndicator from "@/components/LoadingIndicator";
import { trackAnalytics } from "@/lib/analytics";

interface Props {
  slug: string;
  initialData?: CollectionData | null;
}

export default function CollectionClient({ slug, initialData }: Props) {
  const [data, setData] = useState<CollectionData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [sort, setSort] = useState<string>("newest");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [tracked, setTracked] = useState(false);

  // Track initial view
  useEffect(() => {
    if (data && !tracked) {
      trackAnalytics("collection_view", {
        collection_slug: slug,
        collection_name: data.name,
        product_count: data.products.length,
      });
      setTracked(true);
    }
  }, [data, tracked, slug]);

  // Re-fetch on sort change (skip initial load if we have server data)
  useEffect(() => {
    if (sort === "newest" && initialData) return;
    if (!data && !initialData) setLoading(true);
    fetchCollectionProducts(slug, sort as "newest" | "price_asc" | "price_desc")
      .then((result) => {
        setData(result);
        setLoading(false);
      });
  }, [slug, sort]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <section className="px-5 lg:px-10 xl:max-w-7xl xl:mx-auto">
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
        onChange={(f) => {
          setFilters(f);
          // Determine which filter changed
          const changed = (["sizes", "colors"] as const).find(
            (k) => JSON.stringify(f[k]) !== JSON.stringify(filters[k])
          ) ?? (f.minPrice !== filters.minPrice || f.maxPrice !== filters.maxPrice ? "price" : null);
          if (changed) {
            trackAnalytics("filter_apply", {
              collection_slug: slug,
              filter_type: changed,
            });
          }
        }}
        sort={sort}
        onSortChange={(s) => {
          setSort(s);
          trackAnalytics("sort_change", { collection_slug: slug, sort_by: s });
        }}
        resultCount={filtered.length}
      />

      {filtered.length === 0 ? (
        <p className="text-sm text-on-surface-variant pt-8 text-center">
          No products match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-5 lg:grid-cols-3 lg:gap-x-6 xl:grid-cols-4 xl:gap-x-8">
          {filtered.map((product, index) => (
            <div key={product._id} className={index % 2 === 1 ? "mt-8" : ""}>
              <ProductCard
                slug={product.slug}
                name={product.name}
                price={product.formattedPrice}
                priceAmount={product.price}
                imageUrl={product.imageUrl}
                productId={product._id}
                productOptions={product.sizes.length > 0 || product.colors.length > 0
                  ? [
                      ...(product.colors.length > 0
                        ? [{ name: "Color", choices: product.colors.map((c) => ({ value: c.value, description: c.name })) }]
                        : []),
                      ...(product.sizes.length > 0
                        ? [{ name: "Size", choices: product.sizes.map((s) => ({ value: s, description: s })) }]
                        : []),
                    ]
                  : undefined
                }
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
