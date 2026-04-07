"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const MAX_DOTS = 7;

interface ImageCarouselProps {
  images: string[];
  mobileImages?: string[];
  productName: string;
}

export default function ImageCarousel({
  images,
  mobileImages,
  productName,
}: ImageCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const scrollTo = (index: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  };

  const total = images.length;
  let windowStart = 0;
  let windowEnd = total - 1;

  if (total > MAX_DOTS) {
    const half = Math.floor(MAX_DOTS / 2);
    let start = activeIndex - half;
    let end = start + MAX_DOTS - 1;

    if (start < 0) {
      start = 0;
      end = MAX_DOTS - 1;
    }
    if (end >= total) {
      end = total - 1;
      start = end - MAX_DOTS + 1;
    }

    windowStart = start;
    windowEnd = end;
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory overflow-x-auto no-scrollbar"
      >
        {images.map((src, i) => (
          <div key={i} className="w-full flex-shrink-0 snap-center">
            <div className="relative aspect-[3/4] bg-surface-container-low">
              <img
                src={mobileImages?.[i] ?? src}
                alt={`${productName} ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : undefined}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>
        ))}
      </div>
      {total > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4">
          {Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => {
            const imageIndex = windowStart + i;
            const isActive = imageIndex === activeIndex;
            const isOverflowStart = total > MAX_DOTS && imageIndex === windowStart && windowStart > 0;
            const isOverflowEnd = total > MAX_DOTS && imageIndex === windowEnd && windowEnd < total - 1;
            const isOverflow = isOverflowStart || isOverflowEnd;

            return (
              <button
                key={imageIndex}
                type="button"
                aria-label={`Go to image ${imageIndex + 1}`}
                className={`rounded-full transition-all duration-200 ${
                  isActive
                    ? "bg-on-surface w-1.5 h-1.5"
                    : isOverflow
                      ? "bg-on-surface/30 w-1 h-1"
                      : "bg-on-surface/20 w-1.5 h-1.5"
                }`}
                onClick={() => scrollTo(imageIndex)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
