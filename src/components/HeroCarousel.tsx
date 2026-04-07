"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";

import Price from "./Price";
import { trackAnalytics } from "@/lib/analytics";

interface HeroItem {
  slug: string;
  name: string;
  imageUrl: string;
  price: string;
  priceAmount?: number;
}

interface HeroCarouselProps {
  items: HeroItem[];
  interval?: number;
  children?: React.ReactNode;
}

export default function HeroCarousel({
  items,
  interval = 5000,
  children,
}: HeroCarouselProps) {
  const [active, setActive] = useState(0);
  const touchStartX = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>(null);

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const prev = useCallback(() => {
    setActive((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (items.length <= 1) return;
    timerRef.current = setInterval(next, interval);
  }, [next, interval, items.length]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startTimer]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) < 50) return;
    if (diff > 0) next();
    else prev();
    startTimer();
  }

  if (items.length === 0) return null;

  return (
    <>
      {/* Mobile: swipeable carousel */}
      <div className="lg:hidden relative">
        <div
          className="relative aspect-[3/4] sm:aspect-[4/5] bg-surface-container-low overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {items.map((item, i) => (
            <Link
              key={item.slug}
              href={`/products/${item.slug}`}
              onClick={() => trackAnalytics("hero_click", { product_slug: item.slug, slide_index: i })}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                i === active ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
            >
              <img
                src={item.imageUrl}
                alt={item.name}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "low"}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-white/80">
                  {item.priceAmount != null ? <Price amount={item.priceAmount} /> : item.price}
                </p>
                <h2 className="mt-1 font-serif italic text-xl tracking-tight text-white">
                  {item.name}
                </h2>
              </div>
            </Link>
          ))}
        </div>

        {items.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setActive(i);
                  startTimer();
                }}
                className={`h-[2px] transition-all duration-300 ${
                  i === active ? "w-6 bg-on-surface" : "w-3 bg-on-surface/30"
                }`}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Desktop: editorial split layout — image left, text right */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-2 gap-6 max-w-6xl mx-auto">
          {/* Main featured image — aspect ratio capped to viewport */}
          <Link
            href={`/products/${items[active].slug}`}
            onClick={() => trackAnalytics("hero_click", { product_slug: items[active].slug, slide_index: active })}
            className="group block"
          >
            <div className="relative aspect-[4/5] max-h-[calc(100vh-140px)] bg-surface-container-low overflow-hidden">
              <img
                src={items[active].imageUrl}
                alt={items[active].name}
                loading="eager"
                fetchPriority="high"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              />
            </div>
          </Link>

          {/* Right side: provenance pane + product info */}
          <div className="relative flex flex-col justify-between bg-surface-container-low p-8 xl:p-10 overflow-hidden">
            {/* Provenance — dominant content */}
            <div className="flex-1 flex flex-col justify-center min-h-0">
              {children}
            </div>

            {/* Active product info — compact, at bottom */}
            <div className="shrink-0 pt-5 border-t border-on-surface/10">
              <div className="flex items-start gap-4">
                <Link
                  href={`/products/${items[active].slug}`}
                  onClick={() => trackAnalytics("hero_click", { product_slug: items[active].slug, slide_index: active })}
                  className="group block flex-1 min-w-0"
                >
                  <h3 className="font-serif italic text-lg tracking-tight text-on-surface group-hover:text-secondary transition-colors leading-snug truncate">
                    {items[active].name}
                  </h3>
                  <p className="mt-0.5 text-sm tracking-tight text-on-surface-variant">
                    {items[active].priceAmount != null ? <Price amount={items[active].priceAmount!} /> : items[active].price}
                  </p>
                </Link>
              </div>

              {/* Thumbnail strip */}
              {items.length > 1 && (
                <div className="mt-3 flex gap-2">
                  {items.map((item, i) => (
                    <button
                      key={item.slug}
                      onClick={() => {
                        setActive(i);
                        startTimer();
                      }}
                      className={`relative w-11 h-[52px] bg-surface-container overflow-hidden transition-opacity ${
                        i === active ? "opacity-100 ring-1 ring-on-surface" : "opacity-50 hover:opacity-75"
                      }`}
                    >
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        loading="lazy"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
