"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

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
}

export default function HeroCarousel({
  items,
  interval = 5000,
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
              <Image
                src={item.imageUrl}
                alt={item.name}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                loading={i === 0 ? "eager" : "lazy"}
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
        <div className="grid grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Main featured image — contained, not stretched */}
          <Link
            href={`/products/${items[active].slug}`}
            onClick={() => trackAnalytics("hero_click", { product_slug: items[active].slug, slide_index: active })}
            className="group block"
          >
            <div className="relative aspect-[3/4] bg-surface-container-low overflow-hidden">
              <Image
                src={items[active].imageUrl}
                alt={items[active].name}
                fill
                sizes="50vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                loading="eager"
              />
            </div>
          </Link>

          {/* Right side: product info + thumbnails */}
          <div className="flex flex-col justify-center py-8">
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-secondary">
              Featured
            </p>
            <h2 className="mt-4 font-serif italic text-4xl tracking-tight text-on-surface">
              {items[active].name}
            </h2>
            <p className="mt-3 text-lg tracking-tight text-on-surface-variant">
              {items[active].price}
            </p>
            <Link
              href={`/products/${items[active].slug}`}
              className="mt-8 inline-block text-xs tracking-[0.15em] uppercase font-medium text-on-surface underline underline-offset-4 hover:text-secondary transition-colors"
            >
              View Product
            </Link>

            {/* Thumbnail strip for other featured items */}
            {items.length > 1 && (
              <div className="mt-16 flex gap-3">
                {items.map((item, i) => (
                  <button
                    key={item.slug}
                    onClick={() => {
                      setActive(i);
                      startTimer();
                    }}
                    className={`relative w-16 h-[85px] bg-surface-container-low overflow-hidden transition-opacity ${
                      i === active ? "opacity-100 ring-1 ring-on-surface" : "opacity-50 hover:opacity-75"
                    }`}
                  >
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
