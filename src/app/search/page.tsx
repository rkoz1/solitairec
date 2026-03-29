"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  fetchSearchResults,
  type CollectionData,
} from "@/app/collections/actions";
import ProductCard from "@/components/ProductCard";
import CollectionFilters, {
  EMPTY_FILTERS,
  type FilterState,
} from "@/components/CollectionFilters";
import LoadingIndicator from "@/components/LoadingIndicator";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const [data, setData] = useState<CollectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<string>("relevance");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);

  const loadResults = useCallback(async () => {
    if (!query.trim()) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const result = await fetchSearchResults(
      query,
      sort as "relevance" | "price_asc" | "price_desc"
    );
    setData(result);
    setLoading(false);
  }, [query, sort]);

  useEffect(() => {
    loadResults();
  }, [loadResults]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.products.filter((p) => {
      if (filters.sizes.length > 0) {
        if (!p.sizes.some((s) => filters.sizes.includes(s))) return false;
      }
      if (filters.colors.length > 0) {
        if (!p.colors.some((c) => filters.colors.includes(c.name))) return false;
      }
      if (filters.minPrice !== null && p.price < filters.minPrice) return false;
      if (filters.maxPrice !== null && p.price > filters.maxPrice) return false;
      return true;
    });
  }, [data, filters]);

  if (loading) return <LoadingIndicator />;

  if (!query.trim()) {
    return (
      <section className="px-5 pt-12 text-center">
        <p className="text-sm text-on-surface-variant">Enter a search term to find products.</p>
      </section>
    );
  }

  return (
    <section className="px-5">
      <div className="pt-12 pb-10">
        <h1 className="font-serif italic text-2xl tracking-tight text-on-surface">
          Results for &ldquo;{query}&rdquo;
        </h1>
        <div className="mt-3 w-12 h-[2px] bg-secondary" />
      </div>

      {data && data.products.length > 0 ? (
        <>
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
                  <ProductCard
                    slug={product.slug}
                    name={product.name}
                    price={product.formattedPrice}
                    imageUrl={product.imageUrl}
                    productId={product._id}
                  />
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-on-surface-variant text-center pt-8">
          No products found for &ldquo;{query}&rdquo;.
        </p>
      )}
    </section>
  );
}
