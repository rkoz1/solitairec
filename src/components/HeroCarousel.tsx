"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

interface HeroItem {
  slug: string;
  name: string;
  imageUrl: string;
  price: string;
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

  const next = useCallback(() => {
    setActive((prev) => (prev + 1) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(next, interval);
    return () => clearInterval(timer);
  }, [next, interval, items.length]);

  if (items.length === 0) return null;

  return (
    <div className="relative">
      {/* Images */}
      <div className="relative aspect-[3/4] sm:aspect-[4/5] lg:aspect-[16/9] bg-surface-container-low overflow-hidden">
        {items.map((item, i) => (
          <Link
            key={item.slug}
            href={`/products/${item.slug}`}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              i === active ? "opacity-100 z-10" : "opacity-0 z-0"
            }`}
          >
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="100vw"
              className="object-cover"
              priority={i === 0}
            />

            {/* Product name + price overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 lg:p-10">
              <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-white/80">
                {item.price}
              </p>
              <h2 className="mt-1 font-serif italic text-xl lg:text-3xl tracking-tight text-white">
                {item.name}
              </h2>
            </div>
          </Link>
        ))}
      </div>

      {/* Dot indicators */}
      {items.length > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-[2px] transition-all duration-300 ${
                i === active
                  ? "w-6 bg-on-surface"
                  : "w-3 bg-on-surface/30"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
