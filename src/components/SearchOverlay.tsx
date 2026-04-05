"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { searchProducts, type SearchResult } from "@/app/search/actions";
import { trackAnalytics } from "@/lib/analytics";
import { clarityTag } from "@/lib/clarity";

export default function SearchOverlay() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Focus input when it mounts (works on iOS because it's triggered by user gesture chain)
  const searchInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      inputRef.current = node;
      // requestAnimationFrame ensures DOM is painted before focusing
      requestAnimationFrame(() => node.focus());
    }
  }, []);

  // Reset state when overlay closes
  useEffect(() => {
    if (open) {
      // Focus handled by ref callback above
    } else {
      setQuery("");
      setResults([]);
      setSearched(false);
    }
  }, [open]);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const data = await searchProducts(q);
      setResults(data);
      setSearched(true);
      trackAnalytics("search_query", { query: q, result_count: data.length });
      clarityTag("search_query", q);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  function handleResultClick(productSlug?: string, position?: number) {
    if (productSlug !== undefined) {
      trackAnalytics("search_result_click", {
        query,
        product_slug: productSlug,
        position: position ?? 0,
      });
    }
    setOpen(false);
  }

  const overlay = open ? (
    <div className="fixed inset-0 z-[60] flex flex-col lg:items-center lg:justify-start lg:bg-black/20">
      {/* Desktop backdrop click */}
      <div className="hidden lg:block absolute inset-0" onClick={() => setOpen(false)} />

      {/* Panel — full screen on mobile, centered dropdown on desktop */}
      <div className="relative flex flex-col bg-white w-full h-full lg:h-auto lg:max-w-2xl lg:mt-16 lg:max-h-[80vh] lg:shadow-lg">
        {/* Top bar — mobile only */}
        <div className="relative flex lg:hidden items-center justify-between px-5 h-14">
          <button
            type="button"
            aria-label="Back"
            className="flex items-center justify-center w-10 h-10"
            onClick={() => setOpen(false)}
          >
            <span className="material-symbols-outlined text-on-surface">
              arrow_back
            </span>
          </button>

          <span className="absolute left-1/2 -translate-x-1/2 font-serif font-bold text-lg tracking-[0.3em] text-on-surface">
            SOLITAIREC
          </span>

          <button
            type="button"
            aria-label="Close search"
            className="flex items-center justify-center w-10 h-10"
            onClick={() => setOpen(false)}
          >
            <span className="material-symbols-outlined text-on-surface">
              close
            </span>
          </button>
        </div>

        {/* Search input */}
        <div className="px-6 pt-8 lg:pt-6">
          <div className="flex items-center gap-3 pb-3 border-b border-on-surface/20">
            <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
              search
            </span>
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              placeholder="Search products..."
              className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/60 outline-none tracking-wide"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  setSearched(false);
                  inputRef.current?.focus();
                }}
                className="flex items-center justify-center w-6 h-6"
              >
                <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
                  close
                </span>
              </button>
            )}
            {/* Desktop close button */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="hidden lg:flex items-center justify-center w-8 h-8 text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label="Close search"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 pt-6 lg:pb-2">
          {loading && (
            <div className="flex justify-center pt-12 lg:pt-8">
              <span className="font-serif text-2xl text-on-surface animate-brand-pulse">
                S
              </span>
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <p className="text-center text-sm text-on-surface-variant pt-12 lg:pt-8 lg:pb-8">
              No products found.
            </p>
          )}

          {!loading && results.length > 0 && (
            <div className="space-y-0">
              <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-secondary mb-4">
                Top results
              </p>
              {results.map((product, index) => (
                <Link
                  key={product._id}
                  href={`/products/${product.slug}`}
                  onClick={() => handleResultClick(product.slug, index)}
                  className="flex gap-4 py-3 group"
                >
                  <div className="shrink-0 w-16 h-[85px] bg-surface-container-low relative">
                    <Image
                      src={product.imageUrl}
                      alt={product.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 flex flex-col justify-center min-w-0">
                    <h3 className="text-[11px] tracking-[0.12em] uppercase font-medium text-on-surface truncate group-hover:text-secondary transition-colors">
                      {product.name}
                    </h3>
                    <p className="mt-1 text-[10px] tracking-widest text-on-surface-variant">
                      {product.price}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Fixed footer: View all results */}
        {!loading && searched && results.length > 0 && (
          <div className="shrink-0 border-t border-outline-variant/20 px-6">
            <Link
              href={`/search?q=${encodeURIComponent(query)}`}
              onClick={() => {
                trackAnalytics("search_view_all", { query, result_count: results.length });
                handleResultClick();
              }}
              className="flex items-center justify-center gap-2 py-4 text-xs tracking-[0.15em] uppercase font-medium text-on-surface hover:text-secondary transition-colors"
            >
              View all results
              <span className="material-symbols-outlined text-[16px]">
                arrow_forward
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        aria-label="Search"
        className="flex items-center justify-center w-10 h-10"
        onClick={() => {
          setOpen(true);
          trackAnalytics("search_open");
          window.dispatchEvent(new Event("overlay-opened"));
        }}
      >
        <span className="material-symbols-outlined text-[22px] text-on-surface">
          search
        </span>
      </button>

      {mounted && overlay && createPortal(overlay, document.body)}
    </>
  );
}
