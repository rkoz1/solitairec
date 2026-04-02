"use client";

import { useEffect, useState, useCallback } from "react";

interface FlyItem {
  id: number;
  imageUrl: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  productName: string;
}

export default function FlyToCart() {
  const [items, setItems] = useState<FlyItem[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const handleAdd = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail as {
      imageUrl: string;
      sourceX: number;
      sourceY: number;
      productName: string;
    };

    // Find the bag icon in the bottom nav
    const bagIcon = document.querySelector('[aria-label="Shopping bag"]');
    if (!bagIcon) {
      // No bag icon visible — just show toast
      setToast(detail.productName);
      setTimeout(() => setToast(null), 2000);
      return;
    }

    const bagRect = bagIcon.getBoundingClientRect();
    const endX = bagRect.left + bagRect.width / 2;
    const endY = bagRect.top + bagRect.height / 2;

    const item: FlyItem = {
      id: Date.now(),
      imageUrl: detail.imageUrl,
      startX: detail.sourceX,
      startY: detail.sourceY,
      endX,
      endY,
      productName: detail.productName,
    };

    setItems((prev) => [...prev, item]);

    // Remove after animation completes + trigger badge bounce
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      window.dispatchEvent(new Event("cart-badge-bounce"));
    }, 600);

    // Show toast
    setToast(detail.productName);
    setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    window.addEventListener("cart-item-added", handleAdd);
    return () => window.removeEventListener("cart-item-added", handleAdd);
  }, [handleAdd]);

  return (
    <>
      {/* Flying thumbnails */}
      {items.map((item) => (
        <FlyingThumbnail key={item.id} item={item} />
      ))}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-[5.5rem] left-1/2 -translate-x-1/2 z-[55] animate-[slideUp_200ms_ease-out]">
          <div className="bg-on-surface text-on-primary px-5 py-3 flex items-center gap-2.5 shadow-lg">
            <span className="material-symbols-outlined text-[16px] text-secondary">
              check_circle
            </span>
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase font-medium">
                Added to bag
              </p>
              <p className="text-[9px] tracking-widest text-on-primary/60 truncate max-w-[200px]">
                {toast}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function FlyingThumbnail({ item }: { item: FlyItem }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Trigger animation on next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setAnimated(true));
    });
  }, []);

  const dx = item.endX - item.startX;
  const dy = item.endY - item.startY;

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{
        left: item.startX,
        top: item.startY,
        transition: animated ? "all 600ms cubic-bezier(0.4, 0, 0.2, 1)" : "none",
        transform: animated
          ? `translate(${dx}px, ${dy}px) scale(0.3)`
          : "translate(0, 0) scale(1)",
        opacity: animated ? 0.6 : 1,
      }}
    >
      {item.imageUrl ? (
        <img
          src={item.imageUrl}
          alt=""
          className="w-12 h-16 object-cover shadow-lg"
        />
      ) : (
        <div className="w-12 h-16 bg-surface-container shadow-lg" />
      )}
    </div>
  );
}
