"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { searchProducts, type SearchResult } from "@/app/search/actions";

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

  // Auto-focus input when overlay opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
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

  function handleResultClick() {
    setOpen(false);
  }

  const overlay = open ? (
    <div className="fixed inset-0 z-[60] bg-white flex flex-col">
      {/* Top bar — matches NavigationDrawer */}
      <div className="relative flex items-center justify-between px-5 h-14">
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
      <div className="px-6 pt-8">
        <div className="flex items-center gap-3 pb-3 border-b border-on-surface/20">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant">
            search
          </span>
          <input
            ref={inputRef}
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
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-6 pt-6">
        {loading && (
          <div className="flex justify-center pt-12">
            <span className="font-serif text-2xl text-on-surface animate-brand-pulse">
              S
            </span>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <p className="text-center text-sm text-on-surface-variant pt-12">
            No products found.
          </p>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-0">
            <p className="text-[10px] tracking-[0.2em] uppercase font-medium text-secondary mb-4">
              {results.length} {results.length === 1 ? "result" : "results"}
            </p>
            {results.map((product) => (
              <Link
                key={product._id}
                href={`/products/${product.slug}`}
                onClick={handleResultClick}
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
